# API Security Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `api-security` (category `security`)

## Goal

Author the **seventh** topic in the Security category, reusing the topic-content pipeline built with
the six prior Security topics. The topic is **API Security** — protecting the APIs that are now the
dominant attack surface of modern systems. It ties together several prior topics at the API layer:
authenticating machine clients (API keys, OAuth2 bearer tokens, mTLS), authorizing requests
(object-level **BOLA** and function-level **BFLA** — the #1 API risk), validating input and preventing
over-exposure of data (excessive data exposure, **mass assignment**), throttling resource consumption
(rate limits, quotas, payload/pagination caps), the **API gateway** as the edge enforcement point,
transport security, and the API-specific misconfigurations (CORS, error leakage, shadow/zombie APIs).
Anchored on the **OWASP API Security Top 10** (a list distinct from the web-app Top 10).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout` chrome
and the learning components; nested route `/topics/security/api-security`). The pipeline exists, so the
new work is content + a registry entry + a capacity model + two diagrams + flipping the card to
`available`.

## Scope

**In scope:** why **APIs are a distinct attack surface** (machine-to-machine, no human/browser in the
loop, they expose business logic and data directly, and each endpoint multiplies exposure) and the
**OWASP API Security Top 10** as the field's reference list; **authenticating API clients** — **API
keys** (identify an *application*, not a user; weak alone, must be secret + rotatable), **OAuth2 bearer
tokens / JWTs** (the standard for delegated user access), and **mTLS** for service-to-service (cross-ref
[Authentication](/topics/security/authentication) and [TLS](/topics/security/tls-https-certificates));
**authorizing requests** — **BOLA** (Broken Object-Level Authorization — the **#1** API risk: check that
*this* client owns *this* object) and **BFLA** (Broken Function-Level Authorization — don't expose admin
functions to normal users), scopes as coarse authz (cross-ref
[Authorization](/topics/security/authorization)); **data exposure** — **excessive data exposure**
(returning whole objects and filtering client-side), **mass assignment** (binding client-supplied fields
to internal object properties, e.g. `isAdmin=true`), and object-**property**-level authorization; **rate
limiting & resource consumption** — unrestricted resource consumption (API #4): rate limits, quotas,
**payload-size** and **pagination** caps, timeouts, and cost-based limiting (cross-ref forthcoming
rate-limiting topic); a **capacity model** for the per-request cost of edge security checks and how
rejecting abusive traffic early *saves* backend capacity; the **API gateway** as the centralized
enforcement point (authn, coarse authz, rate limiting, TLS termination, WAF, logging) *plus* defense in
depth (object-level authz still lives in the service — cross-ref the [API Gateway](/learn/api-gateway)
tutorial); **transport security & misconfiguration** — always **HTTPS/HSTS**, sane **CORS**, security
headers, **error handling** that doesn't leak internals/stack traces, and **API inventory management**
(shadow and zombie APIs — you can't secure endpoints you forgot exist).

**Out of scope (cross-reference, don't duplicate):** the mechanisms themselves — token formats/OAuth
flows ([Authentication](/topics/security/authentication)), access-control models
([Authorization](/topics/security/authorization)), TLS internals
([TLS](/topics/security/tls-https-certificates)), the general web-app risk list
([OWASP Top 10](/topics/security/owasp-top-10)); a full standalone rate-limiter build (the forthcoming
rate-limiting topic — algorithms are *named* here); building an API gateway from scratch (the
[API Gateway](/learn/api-gateway) tutorial); GraphQL/gRPC-specific depth beyond a mention; any change to
other topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What API Security Is | fundamentals |
| 2 | `authenticating-clients` | Authenticating API Clients | interview-ready |
| 3 | `authorizing-requests` | Object- & Function-Level Authorization | interview-ready |
| 4 | `data-exposure` | Data Exposure & Mass Assignment | interview-ready |
| 5 | `resource-consumption` | Rate Limiting & Resource Consumption | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Cost of Securing Every Request | interview-ready |
| 7 | `api-gateway` | The API Gateway as Enforcement Point | advanced |
| 8 | `transport-misconfig` | Transport Security & Misconfiguration | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What API Security Is** — APIs are now the primary attack surface: they're **machine-to-machine**
   (no browser, no human judgment, easy to script at scale), they **expose business logic and data
   directly**, and every endpoint is another door. Because the client is untrusted code, all the usual
   principles apply but the human-facing mitigations (CAPTCHAs, UI hiding) don't. The **OWASP API
   Security Top 10** is the reference list, distinct from the web-app Top 10, and its **#1 is BOLA**.
   `Callout variant="info"`: "an API endpoint is a promise to a machine — assume every client is
   hostile, scripted, and reading your docs." ≥1 `<KnowledgeCheck>`.
2. **Authenticating API Clients** — proving *who is calling*. **API keys**: a shared secret that
   identifies an **application** (not a user) — simple, but weak alone (bearer-style, no built-in
   expiry), so keep them secret, scope them, and rotate them. **OAuth2 bearer tokens / JWTs**: the
   standard for delegated **user** access — the client presents a token, the API verifies it (cross-ref
   [Authentication](/topics/security/authentication)). **mTLS**: both sides present certificates — strong
   mutual auth for **service-to-service** (cross-ref [TLS](/topics/security/tls-https-certificates)). The
   interview point: an **API key is identification, not strong authentication** — it says which app, not
   that the request is trustworthy. ≥1 `<KnowledgeCheck>`.
3. **Object- & Function-Level Authorization** — the top two API risks are both authorization. **BOLA**
   (Broken Object-Level Authorization, API #1): the endpoint authenticates the caller but doesn't check
   they **own the specific object** — `GET /orders/124` returns someone else's order. **BFLA** (Broken
   Function-Level Authorization): a normal user calls an **admin** endpoint (`DELETE /users/5`) that was
   only hidden, not protected. The fix is enforce **object-level and function-level authorization on the
   server, every request**, deny-by-default (cross-ref [Authorization](/topics/security/authorization)).
   Embed `<BolaAttackSequence />`. ≥1 `<KnowledgeCheck>`.
4. **Data Exposure & Mass Assignment** — two mirror-image data risks. **Excessive data exposure**:
   returning **whole objects** and trusting the client to filter — so the JSON includes fields
   (`ssn`, `passwordHash`, internal flags) the UI never shows but an attacker reads straight off the
   wire; fix by returning **only the fields needed** (explicit response schemas). **Mass assignment**:
   **binding client-supplied JSON straight onto internal objects**, so a request adding `"role":"admin"`
   or `"isVerified":true` silently escalates; fix by **allowlisting** which properties a client may set.
   Together these are **object property-level authorization** — control which fields can be read and
   written, not just which objects. ≥1 `<KnowledgeCheck>`.
5. **Rate Limiting & Resource Consumption** — **unrestricted resource consumption** (API #4): without
   limits, one client can exhaust CPU, memory, bandwidth, or a third-party billing quota. Controls:
   **rate limits** (requests per client per window), **quotas** (daily/monthly caps), **payload-size
   limits**, **pagination caps** (never return unbounded lists), **timeouts**, and **cost-based
   limiting** (weight expensive endpoints more). This is also the front line against brute-force and
   DoS (cross-ref the forthcoming rate-limiting topic — token bucket / sliding window are *named*). ≥1
   `<KnowledgeCheck>` may live here or later.
6. **Capacity: The Cost of Securing Every Request** — `ApiSecurityCapacity` fed by
   `lib/api-security-estimates.ts`. Every request pays a small **security tax** at the edge (verify the
   token, check the rate limit), but that cheap check *saves* capacity by rejecting abusive traffic
   before it reaches the expensive backend. Headline: at 200k req/s, edge security checks cost ~**50
   cores**; if **half** the traffic is abusive/unauthenticated, serving it all would need **1,000**
   backend cores, but rejecting it at the edge drops the backend to **500** — so even counting the 50
   gateway cores you **net ~450 cores saved**. The lesson: **authenticate and rate-limit early and
   cheaply at the gateway** (it's a capacity optimization, not just protection), while object-level
   authz stays deep in the service.
7. **The API Gateway as Enforcement Point** — centralizing edge security at the **API gateway**: TLS
   termination, authentication, coarse authorization / scope checks, rate limiting, request validation,
   a **WAF**, and consistent logging — one hardened front door instead of every service reinventing it.
   But the gateway is **necessary, not sufficient**: it can't know if *this* user owns *this* object, so
   **object-level authz must still run in the service** (defense in depth). Cross-ref the
   [API Gateway](/learn/api-gateway) tutorial. Embed `<GatewayEnforcementSequence />`. ≥1
   `<KnowledgeCheck>`.
8. **Transport Security & Misconfiguration** — the baseline hygiene: **always HTTPS** (+ **HSTS**), no
   plaintext endpoints (cross-ref [TLS](/topics/security/tls-https-certificates)); correct **CORS** (an
   allowlist of origins, not `*` with credentials); **security headers**; **error handling** that returns
   generic messages and never leaks stack traces, SQL, or internal hostnames; and **API inventory
   management** — **shadow APIs** (undocumented endpoints) and **zombie APIs** (old, unpatched versions
   still live) are unsecured because they're forgotten. You can't protect what you don't know you run.
   ≥1 `<KnowledgeCheck>` may live here or later.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **trusting the client** (hidden fields,
   client-side filtering, "the app won't send that"), **API keys as authentication** (identity ≠ trust;
   leaked keys in mobile apps/JS), **no object-level authz** (BOLA), **returning whole objects** /
   **mass assignment**, **no rate limits**, **verbose errors**, **HTTP endpoints**, and **forgotten
   versions** (zombie APIs). A `DecisionRecord` with the default posture (OAuth2/JWT or mTLS at a
   gateway, object- and property-level authz in the service, deny-by-default, strict schemas in and out,
   rate limits + quotas, always TLS, inventory + retire old versions). ≥1 `<KnowledgeCheck>` may live
   here.
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total, plus a `<Faq>` with **≥ 10** entries
    (why APIs differ; API keys vs tokens vs mTLS; BOLA; BFLA; excessive data exposure; mass assignment;
    rate limiting/resource consumption; gateway vs service authz; CORS; HTTPS/HSTS; shadow/zombie APIs;
    OWASP API Top 10 vs web Top 10).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. `TradeoffTable` for the
client-auth options (API key vs OAuth token vs mTLS). (No `ApiContract`.)

### New, API-Security-specific
- `lib/api-security-estimates.ts` — pure capacity calc, typed `ApiSecurityCapacityAssumptions` /
  `ApiSecurityCapacityResults`.
- `components/learning/api-security-capacity.tsx` — wraps `CapacityTable`, registered as
  `ApiSecurityCapacity`.
- `components/diagrams/api-security-flows.tsx` — `BolaAttackSequence` (authenticated client requests its
  own object, succeeds; then swaps the id to another user's object and the server returns it because it
  never checked ownership) and `GatewayEnforcementSequence` (a request flows through the gateway's TLS
  termination → token verification → rate-limit check → scope check → forwarded to the service, which
  performs the object-level authz the gateway can't). Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `api-security` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `ApiSecurityCapacity`, `BolaAttackSequence`,
  `GatewayEnforcementSequence`.
- `lib/topics.ts` — flip `api-security` to `available`.
- `content/topics/api-security.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing `getTopic`
  "returns undefined" check from `api-security` to a still-coming-soon slug (`session-management`).

## Capacity Model (exact)

`lib/api-security-estimates.ts`, pure & deterministic. Integer cores via `Math.ceil`.

Assumptions (used in the MDX embed and the test):
```ts
{
  requestsPerSec: 200_000,
  abusiveFraction: 0.5,
  gatewayCheckCpuMs: 0.25,
  backendCpuMs: 5,
  msPerCorePerSec: 1_000,
}
```

Results (deterministic):
- `gatewaySecurityCores` = ceil(200,000 × 0.25 / 1,000) = **50**
- `backendCoresWithoutFiltering` = ceil(200,000 × 5 / 1,000) = **1,000**
- `backendCoresWithFiltering` = ceil((200,000 × 0.5) × 5 / 1,000) = **500**
- `netCoresSaved` = 1,000 − (50 + 500) = **450**

Headline lesson: securing every request costs something, but the cheap edge check pays for itself.
Verifying a token and checking a rate limit runs ~**50 cores** at 200k req/s — a small security tax.
The payoff: if **half** the traffic is abusive or unauthenticated, letting it hit the backend would need
**1,000** cores; rejecting it at the gateway drops the backend to **500**, so even after the 50-core
gateway cost you **net ~450 cores saved**. So edge security is also a **capacity optimization** — reject
bad traffic early and cheaply — while the correctness-critical **object-level authorization** stays in
the service, where ownership can actually be checked (defense in depth).

## Numerical & Terminology Invariants

- APIs are **machine-to-machine**; assume every client is **hostile and scripted**. Reference list =
  **OWASP API Security Top 10** (distinct from the web-app Top 10); **#1 is BOLA**.
- Client auth: **API keys** (identify an *app*, weak alone — identity ≠ trust) · **OAuth2 bearer tokens /
  JWT** (delegated *user* access) · **mTLS** (service-to-service, mutual certs).
- **BOLA** = missing **object-level** authz (own *this* object?); **BFLA** = missing **function-level**
  authz (may call *this* admin function?). Enforce both **server-side, every request, deny-by-default**.
- **Excessive data exposure** = returning whole objects (filter server-side, explicit response schema);
  **mass assignment** = binding client fields onto internal objects (allowlist writable properties).
  Together = **property-level authorization**.
- **Unrestricted resource consumption** → **rate limits, quotas, payload-size & pagination caps,
  timeouts, cost-based limiting**.
- Gateway centralizes **TLS termination, authn, coarse authz, rate limiting, WAF, logging** — but
  **object-level authz stays in the service** (defense in depth).
- Capacity: edge checks ≈ **50 cores** at 200k req/s; filtering 50% abusive traffic cuts backend
  **1,000 → 500**, **net ~450 cores saved** — edge security is also a capacity optimization.
- Hygiene: **always HTTPS + HSTS**, allowlist **CORS**, generic errors (no stack traces), retire
  **shadow/zombie APIs** (inventory management).

## Testing

- `tests/topic-registry.test.ts` — add: `api-security` registered; 10 sections; unique ids + valid
  depths. **Update** the "`getTopic` returns undefined" assertion to `session-management` (still
  coming-soon). Prior topic assertions stay.
- `tests/api-security-content.test.ts` — all 10 required `h2` ids present; embeds `<ApiSecurityCapacity`,
  `<BolaAttackSequence`, `<GatewayEnforcementSequence`; capacity `assumptions` exactly match the
  estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/api-security-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the API Security card links through; navigate to
  `/topics/security/api-security#authorizing-requests` (direct `page.goto`) and assert the heading and a
  diagram `img` (assert the diagram first so layout settles before the in-viewport check). Curriculum
  assertions **untouched**. Run e2e with `--workers=1`.

## Out of Scope

Token/OAuth internals, access-control models, TLS internals, the web-app OWASP Top 10, a standalone
rate limiter, building an API gateway from scratch, GraphQL/gRPC depth, and any change to other
topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for API Security topic`
2. `feat: add API Security capacity model and wrapper`
3. `feat: add BOLA and gateway enforcement diagrams`
4. `feat: register API Security topic route and skeleton`
5. `content: complete API Security topic`
6. `test: verify API Security topic flow end-to-end`
