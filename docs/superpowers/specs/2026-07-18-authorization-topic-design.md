# Authorization Topic — Design Spec

**Date:** 2026-07-18
**Status:** Approved for planning
**Topic:** `authorization` (category `security`)

## Goal

Author the **third** topic in the Security category, reusing the topic-content pipeline built with
[Authentication](2026-06-27-authentication-topic-design.md) and
[TLS/HTTPS and Certificates](2026-06-27-tls-https-certificates-topic-design.md). The topic is
**Authorization** — deciding *what an authenticated principal is allowed to do*: the authz-vs-authn
split, the access-control models (ACL, **RBAC**, **ABAC**, ReBAC), the policy architecture that
separates *deciding* from *enforcing* (**PEP/PDP/PAP/PIP** and externalized policy engines), a
capacity model for the cost of permission checks at scale, relationship-based access control and
**Google Zanzibar**, how authorization is enforced in practice (gateway/service/data layers, OAuth
scopes vs authorization, object-level checks, multi-tenancy), and the pitfalls (deny-by-default,
least privilege, **broken object-level authorization / IDOR**).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout`
chrome and the learning components; nested route `/topics/security/authorization`). Since the
pipeline exists, the new work is content + a registry entry + a capacity model + two diagrams +
flipping the card to `available`.

## Scope

**In scope:** authorization vs authentication (authn = *who you are*, authz = *what you may do*;
authz always runs *after* a verified identity); the **access-control models** — **ACL** (per-object
lists), **RBAC** (users→roles→permissions), **ABAC** (policies over subject/resource/action/
environment attributes), **ReBAC** (permissions derived from a relationship graph) — and when each
fits; **RBAC** in depth (roles, permissions, role hierarchies, role explosion, separation of
duties); **ABAC** in depth (policy rules, attributes, context/environment, dynamic/fine-grained
decisions, policy languages); the **policy architecture** that decouples the decision from the
code — **PEP** (enforcement point), **PDP** (decision point), **PAP** (admin/policy authoring),
**PIP** (attribute/information source) — and **externalized authorization** with policy engines
(**OPA/Rego**, **AWS Cedar**), local sidecar vs central service; a **capacity model** for the CPU
cost of permission checks and how a **decision cache** amortizes it; **ReBAC & Zanzibar**
(relationship tuples, the `check(user, relation, object)` API, consistency via zookies); **enforcement
in practice** (authorize at the gateway *and* the service *and* the data/object layer; **OAuth
scopes are coarse authorization, not fine-grained**; multi-tenant isolation; deny-by-default);
pitfalls/best practices (**least privilege**, deny-by-default, **BOLA/IDOR**, confused deputy,
overly-broad roles, policy staleness vs caching).

**Out of scope (cross-reference, don't duplicate):** proving identity — login, passwords, JWT,
OAuth token issuance, MFA (the [Authentication](/topics/security/authentication) topic; OAuth
appears here only as *scopes are coarse authz*); transport security
([TLS/HTTPS](/topics/security/tls-https-certificates)); a full policy-language tutorial (Rego/Cedar
syntax is *named and shown minimally*, not taught); building a general
[rate limiter](/topics/security/rate-limiting) or [API gateway](/learn/api-gateway) (their own
pages); any change to other topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What Authorization Is | fundamentals |
| 2 | `access-control-models` | Access-Control Models | fundamentals |
| 3 | `rbac` | Role-Based Access Control (RBAC) | interview-ready |
| 4 | `abac` | Attribute-Based Access Control (ABAC) | interview-ready |
| 5 | `policy-architecture` | Policy Architecture: PEP, PDP & Engines | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Cost of Permission Checks | interview-ready |
| 7 | `relationship-based` | ReBAC & Google Zanzibar | advanced |
| 8 | `enforcement-in-practice` | Enforcement in Practice | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What Authorization Is** — authorization decides *what an authenticated principal may do*;
   authentication (a separate topic) decides *who they are*. Authz always runs **after** a verified
   identity — you can't authorize an unknown caller. Every request carries a **subject** (who),
   wants an **action** (verb) on a **resource** (object), in a **context** (time, IP, tenant); an
   authz decision is `allow | deny` for that tuple. `Callout variant="info"`: "authn = who you are;
   authz = what you may do — authz runs after authn."
2. **Access-Control Models** — the four models and when each fits: **ACL** (each object carries a
   list of who-can-do-what; simple, but scattered and hard to reason about at scale), **RBAC**
   (users get **roles**, roles grant **permissions** — the workhorse), **ABAC** (decisions computed
   from **attributes** + policy rules — fine-grained, dynamic), **ReBAC** (permissions follow a
   **relationship graph** — "editors of a folder can edit its docs"). `TradeoffTable` comparing
   ACL / RBAC / ABAC / ReBAC (granularity, admin cost, scale, typical use). ≥1 `<KnowledgeCheck>`.
3. **Role-Based Access Control (RBAC)** — the dominant model: **users → roles → permissions**.
   A **permission** is an action-on-resource-type (`invoice:read`); a **role** bundles permissions
   (`billing-admin`); users are assigned roles. **Role hierarchies** (admin inherits editor inherits
   viewer) reduce duplication. Strengths: easy to reason about, audit, and administer. Weaknesses:
   **role explosion** (a new role per fine-grained combination — e.g., "editor *of region X*"),
   and no per-object or contextual conditions. **Separation of duties** (no single role can both
   create and approve). ≥1 `<KnowledgeCheck>`.
4. **Attribute-Based Access Control (ABAC)** — decisions are computed by evaluating **policy rules**
   over **attributes** of the **subject** (department, clearance), **resource** (owner, tags,
   classification), **action**, and **environment** (time, IP, MFA-present). Example rule: *allow
   `read` if `subject.dept == resource.dept AND environment.time in business-hours`*. Strength:
   **fine-grained, dynamic, contextual** without a role per case (kills role explosion). Cost:
   policies + attribute sources are harder to author, test, and reason about; you need the
   attributes at decision time (PIP). RBAC and ABAC are often **combined** (roles as one attribute).
   ≥1 `<KnowledgeCheck>`.
5. **Policy Architecture: PEP, PDP & Engines** — separate **deciding** from **enforcing** so authz
   isn't `if` statements scattered through code. **PEP** (Policy **Enforcement** Point) intercepts
   the request and asks; **PDP** (Policy **Decision** Point) evaluates the policy and answers
   `allow/deny`; **PAP** (Policy **Administration** Point) is where policies are authored/managed;
   **PIP** (Policy **Information** Point) supplies attributes the PDP needs. **Externalized
   authorization**: a policy engine (**OPA/Rego**, **AWS Cedar**) evaluates declarative policy,
   deployed as a **local sidecar** (fast, no network hop — the common choice) or a **central
   service** (one source of truth, network latency). Embed `<AuthorizationDecisionSequence />`.
   ≥1 `<KnowledgeCheck>`.
6. **Capacity: The Cost of Permission Checks** — `AuthorizationCapacity` fed by
   `lib/authorization-estimates.ts`. Every request triggers **several** authz checks (gateway +
   service + object-level); at scale that's a huge decision volume. A **decision/permission cache**
   (short TTL, keyed on subject+action+resource) amortizes it — most checks are repeats. Headline:
   at 200k req/s × 3 checks = **600k checks/s**; evaluating all of them costs **~300 cores**, but a
   **90%-hit decision cache** drops it to 60k evaluations → **~30 cores** (**~10×**). So authz is
   sized by **checks per second**, and **local evaluation + caching** beat a network hop per check —
   at the cost of **staleness** (a revoked permission lingers until the TTL expires).
7. **ReBAC & Google Zanzibar** — when permissions follow **relationships** ("*viewers of a folder
   can view its files*", "*members of a group inherit its access*"), model them as a **graph of
   relationship tuples**: `(object, relation, subject)` e.g. `(doc:123, viewer, user:alice)` and
   `(doc:123, viewer, group:eng#member)`. **Google Zanzibar** (Google Drive/YouTube permissions,
   and OSS clones SpiceDB/OpenFGA) exposes a `check(user, relation, object)` API that **walks the
   graph** to answer, storing tuples centrally and using **zookies** (consistency tokens) so a
   permission change is read-your-writes consistent. Great for **hierarchical, shared-resource**
   products; the trade-off is a **central, consistent, hot** permission store. Embed
   `<RelationshipCheckSequence />`. ≥1 `<KnowledgeCheck>`.
8. **Enforcement in Practice** — authorize in **depth**, not once: coarse checks at the **API
   gateway** (is the token scoped for this API?), business rules at the **service**, and — critically
   — **object-level** checks at the **data layer** (does *this* user own *this* row?). **OAuth
   scopes are coarse authorization** (what an app may do on your behalf), **not** a substitute for
   per-object authz. **Multi-tenancy**: every query must be tenant-scoped (a `tenant_id` filter is
   an authorization control). Default **deny**: unknown → denied. ≥1 `<KnowledgeCheck>` may live
   here or later.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **BOLA/IDOR** (Broken Object-Level
   Authorization — the #1 API vulnerability: checking authn but not "is this *your* object", so
   `GET /orders/124` returns someone else's order), **deny-by-default** (fail closed), **least
   privilege** (grant the minimum; time-bound elevation), **role explosion** (reach for ABAC/ReBAC
   before minting the 500th role), **confused deputy** (a privileged service acting on
   attacker-controlled input), and **decision-cache staleness** vs revocation latency. A
   `DecisionRecord` with the default recommendation (RBAC as the baseline; add ABAC for context and
   ReBAC for shared hierarchies; externalize and default-deny).
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total across the page, plus a `<Faq>` with
    **≥ 10** entries (authz vs authn; RBAC vs ABAC vs ReBAC; where to enforce; OAuth scopes vs
    authz; Zanzibar; caching vs staleness; IDOR; least privilege; deny-by-default; OPA/Cedar).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. (No `ApiContract` —
authorization is a cross-cutting decision, not a REST API; `TradeoffTable` for the models fits.)

### New, Authorization-specific
- `lib/authorization-estimates.ts` — pure capacity calc, typed `AuthorizationCapacityAssumptions`
  / `AuthorizationCapacityResults`.
- `components/learning/authorization-capacity.tsx` — wraps `CapacityTable`, registered as
  `AuthorizationCapacity`.
- `components/diagrams/authorization-flows.tsx` — `AuthorizationDecisionSequence` (request → PEP →
  PDP evaluates policy against attributes → allow/deny → enforce) and `RelationshipCheckSequence`
  (`check(user, relation, object)` → walk relationship tuples → allowed → serve). Both via
  `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `authorization` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `AuthorizationCapacity`, `AuthorizationDecisionSequence`,
  `RelationshipCheckSequence`.
- `lib/topics.ts` — flip `authorization` to `available`.
- `content/topics/authorization.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing
  `getTopic` "returns undefined" check from `authorization` to a still-coming-soon slug
  (`password-hashing`).

## Capacity Model (exact)

`lib/authorization-estimates.ts`, pure & deterministic. Integer core counts via `Math.ceil`.

Assumptions (used in the MDX embed and the test):
```ts
{
  requestsPerSec: 200_000,
  checksPerRequest: 3,
  decisionCpuMs: 0.5,
  cacheHitRate: 0.9,
  msPerCorePerSec: 1_000,
}
```

Results (deterministic):
- `totalChecksPerSec` = 200,000 × 3 = **600,000** /s
- `cachedChecksPerSec` = 600,000 × 0.9 = **540,000** /s
- `evaluatedChecksPerSec` = 600,000 × (1 − 0.9) = **60,000** /s
- `decisionCpuMsPerSec` = 60,000 × 0.5 = **30,000** ms/s
- `coresWithCache` = ceil(30,000 / 1,000) = **30**
- `coresWithoutCache` = ceil(600,000 × 0.5 / 1,000) = **300**

Headline lesson: authorization runs on **every** request, often **several times** (gateway,
service, object level), so a busy API makes far more authz checks than it serves requests. Fully
**evaluating** every check is expensive (~300 cores here); a **decision cache** — most checks repeat
the same subject/action/resource — turns 600k checks/s into 60k evaluations, ~**300 → 30 cores**
(~**10×**). So authz capacity is sized by **checks per second**, and the dominant optimizations are
**local (sidecar) evaluation** to avoid a network hop and **decision caching** — traded against
**staleness** (a revoked grant lingers until the cache TTL expires, which is why the TTL is short
and sensitive actions bypass the cache).

## Numerical & Terminology Invariants

- **authn = who you are; authz = what you may do** — authz runs **after** a verified identity.
- A decision is `allow | deny` over a **(subject, action, resource, context)** tuple.
- Models: **ACL** (per-object lists) · **RBAC** (users→roles→permissions) · **ABAC** (policy over
  attributes) · **ReBAC** (relationship graph). RBAC is the baseline; ABAC adds context; ReBAC fits
  shared hierarchies. RBAC's weakness is **role explosion**.
- Architecture: **PEP** enforces, **PDP** decides, **PAP** authors, **PIP** supplies attributes.
  **Externalized authorization** = a policy engine (**OPA/Rego**, **AWS Cedar**), sidecar vs central.
- Capacity: 200k req/s × 3 = **600k checks/s**; a 90% decision cache cuts **~300 cores → ~30**
  (~**10×**); trade-off is **staleness**.
- **ReBAC/Zanzibar**: relationship tuples `(object, relation, subject)`, `check(user, relation,
  object)` walks the graph; **zookies** give consistency; OSS = SpiceDB/OpenFGA.
- Enforcement is **defense in depth** (gateway + service + **object-level** data layer); **OAuth
  scopes are coarse authz, not per-object**; multi-tenant queries must be **tenant-scoped**.
- Top pitfall: **BOLA/IDOR** (broken object-level authorization). Defaults: **deny-by-default** +
  **least privilege**.

## Testing

- `tests/topic-registry.test.ts` — add: `authorization` registered; 10 sections; unique ids + valid
  depths. **Update** the existing "`getTopic` returns undefined" assertion to use `password-hashing`
  (still coming-soon) since `authorization` is now registered. Authentication + TLS assertions stay.
- `tests/authorization-content.test.ts` — all 10 required `h2` ids present; embeds
  `<AuthorizationCapacity`, `<AuthorizationDecisionSequence`, `<RelationshipCheckSequence`; capacity
  `assumptions` exactly match the estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/authorization-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the Authorization card links through; navigate to
  `/topics/security/authorization#policy-architecture` (direct `page.goto`) and assert the heading
  and the decision-flow diagram `img`. The curriculum "showing 1 of 33" assertion is **untouched**
  (a topic is not a curriculum problem).

## Out of Scope

Identity/login (Authentication topic), transport security (TLS topic), full Rego/Cedar language
tutorials, standalone rate limiting / API gateway builds, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for Authorization topic`
2. `feat: add Authorization capacity model and wrapper`
3. `feat: add Authorization decision and relationship-check diagrams`
4. `feat: register Authorization topic route and skeleton`
5. `content: complete Authorization topic`
6. `test: verify Authorization topic flow end-to-end`
