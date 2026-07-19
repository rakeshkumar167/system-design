# OWASP Top 10 Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `owasp-top-10` (category `security`)

## Goal

Author the **sixth** topic in the Security category, reusing the topic-content pipeline built with
Authentication, TLS/HTTPS, Authorization, Password Hashing, and Encryption & Key Management. The topic
is the **OWASP Top 10** — the industry-standard awareness list of the most critical web-application
security risks. Unlike the prior topics (each a single mechanism), this is a **survey**: what the list
is and how to use it, the ten 2021 categories, the top three (**Broken Access Control**,
**Cryptographic Failures**, **Injection**) in depth, a **defense-in-depth capacity model**, the
remaining seven risks grouped, and the cross-cutting defenses. A major role of this topic is to act
as a **hub** that cross-references the other Security topics (access control → Authorization; crypto
failures → Encryption / Password Hashing / TLS; auth failures → Authentication).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout` chrome
and the learning components; nested route `/topics/security/owasp-top-10`). The pipeline exists, so the
new work is content + a registry entry + a capacity model + two diagrams + flipping the card to
`available`.

## Scope

**In scope:** what the **OWASP Top 10** is (a community-driven, **data-backed awareness document**
of the most critical web-app risks, refreshed roughly every 3–4 years; **2021** is current) and how
to use it (a **baseline and awareness tool**, categories of risk not a bug checklist, a *starting
point* for a real threat model — not a compliance box to tick); the **2021 list** — A01 **Broken
Access Control**, A02 **Cryptographic Failures**, A03 **Injection**, A04 **Insecure Design**, A05
**Security Misconfiguration**, A06 **Vulnerable and Outdated Components**, A07 **Identification and
Authentication Failures**, A08 **Software and Data Integrity Failures**, A09 **Security Logging and
Monitoring Failures**, A10 **Server-Side Request Forgery (SSRF)**; the **top three in depth** —
**Broken Access Control** (now #1: **IDOR/BOLA**, missing function-level checks, forced browsing;
cross-ref [Authorization](/topics/security/authorization)), **Cryptographic Failures** (plaintext /
weak hashing / bad TLS / hardcoded keys; cross-ref [Encryption](/topics/security/encryption-key-management),
[Password Hashing](/topics/security/password-hashing), [TLS](/topics/security/tls-https-certificates)),
**Injection** (**SQLi, XSS, command injection** — untrusted input executed as code; **parameterized
queries**, **output encoding**, validation); a **defense-in-depth capacity model** (no single control
is perfect; **layering independent controls multiplies** the risk reduction); the **remaining risks
grouped** — A04–A06 (insecure design & threat modeling, misconfiguration & secure defaults, vulnerable
components & **SCA/dependency scanning** — Log4Shell) and A07–A10 (auth failures → Authentication;
integrity failures → insecure deserialization / unsigned updates / CI-CD — SolarWinds; logging &
monitoring failures → "you can't respond to what you can't see"; **SSRF** → server tricked into
fetching an internal address, e.g. the **cloud metadata endpoint**, defended with an **allowlist**);
the **cross-cutting defenses** (validate input + encode output, least privilege + deny-by-default,
defense in depth, secure defaults, patch management, logging/monitoring, **shift-left / secure SDLC**).

**Out of scope (cross-reference, don't duplicate):** the mechanisms each risk maps to are covered by
their own topics — authorization models ([Authorization](/topics/security/authorization)), crypto and
key management ([Encryption](/topics/security/encryption-key-management),
[Password Hashing](/topics/security/password-hashing),
[TLS](/topics/security/tls-https-certificates)), identity ([Authentication](/topics/security/authentication)),
and the forthcoming threat-modeling, rate-limiting, and secure-SDLC topics (named, not taught here);
the **OWASP API Security Top 10** and **Mobile Top 10** (different lists — mention, don't cover);
exhaustive exploitation tutorials or tool walkthroughs; any change to other topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What the OWASP Top 10 Is | fundamentals |
| 2 | `the-list` | The 2021 Top 10 at a Glance | fundamentals |
| 3 | `broken-access-control` | A01: Broken Access Control | interview-ready |
| 4 | `cryptographic-failures` | A02: Cryptographic Failures | interview-ready |
| 5 | `injection` | A03: Injection | interview-ready |
| 6 | `capacity-estimates` | Capacity: Defense in Depth by the Numbers | interview-ready |
| 7 | `design-config-components` | A04–A06: Design, Configuration & Components | advanced |
| 8 | `remaining-risks` | A07–A10: Auth, Integrity, Logging & SSRF | interview-ready |
| 9 | `pitfalls-best-practices` | Cross-Cutting Defenses & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What the OWASP Top 10 Is** — a community-driven, **data-backed** standard awareness document
   listing the ten most critical web-application security risks, published by the **Open Worldwide
   Application Security Project** and refreshed every few years (**2021** current). It's an **awareness
   baseline**, not a complete checklist — categories of *risk*, ranked from real-world data plus a
   community survey. The right way to use it: as a **shared vocabulary** and a **floor** ("are we at
   least covered against these?"), the *start* of a threat model, never the finish. `Callout
   variant="info"`: "the Top 10 is a floor, not a ceiling — a baseline for awareness, not a
   compliance checklist or a substitute for threat modeling."
2. **The 2021 Top 10 at a Glance** — a table of all ten categories (id, name, essence) so the reader
   has the whole map before the deep dives. Note the **2021 shifts**: **Broken Access Control** rose
   to **#1**, **Cryptographic Failures** (renamed from "Sensitive Data Exposure") to #2, and three
   new/merged categories — **Insecure Design**, **Software and Data Integrity Failures**, and **SSRF**
   (community-voted in). Use a `TradeoffTable`-style table (columns: rank, category, what it is). ≥1
   `<KnowledgeCheck>`.
3. **A01: Broken Access Control** — the **#1** risk: the app fails to enforce what a user is allowed
   to do. **IDOR/BOLA** (change an id in the URL and read someone else's record), **missing
   function-level authorization** (calling an admin endpoint as a normal user), **forced browsing**,
   and privilege escalation. The fix is enforce authorization **server-side, on every request, at the
   object level**, deny-by-default — the whole [Authorization](/topics/security/authorization) topic.
   ≥1 `<KnowledgeCheck>`.
4. **A02: Cryptographic Failures** — anything that leaves sensitive data unprotected: **no encryption**
   (plaintext in transit or at rest), **weak or fast password hashing**, **broken/old TLS**, **hardcoded
   or mismanaged keys**, weak algorithms (MD5, ECB). Renamed in 2021 from "Sensitive Data Exposure" to
   emphasize the *cause* (the crypto failure) over the *symptom* (exposed data). Cross-ref the three
   crypto topics ([Encryption](/topics/security/encryption-key-management),
   [Password Hashing](/topics/security/password-hashing),
   [TLS](/topics/security/tls-https-certificates)). ≥1 `<KnowledgeCheck>`.
5. **A03: Injection** — untrusted input is interpreted as **code/commands** by an interpreter:
   **SQL injection** (input breaks out of a query), **cross-site scripting (XSS)** (input becomes
   script in a victim's browser), **OS command injection**, LDAP/NoSQL injection. The root cause is
   **mixing data with code**; the fix is to **keep them separate** — **parameterized queries /
   prepared statements**, **context-aware output encoding** for XSS, safe APIs, and input validation
   as defense in depth. Embed `<InjectionAttackSequence />`. ≥1 `<KnowledgeCheck>`.
6. **Capacity: Defense in Depth by the Numbers** — `OwaspRiskCapacity` fed by
   `lib/owasp-top-10-estimates.ts`. No single control catches everything, but **independent controls
   compound**: if each layer blocks 90% of attacks, two layers let 1% through, three let 0.1%. Model:
   1,000,000 automated attacks/day; one control → **100,000** get through; **three independent layers**
   → **1,000** get through — a **100×** improvement over a single control and a **1,000×** reduction
   overall. The lesson: security is **multiplicative layering**, not one silver bullet — which is why
   the Top 10 defenses stack (validate input *and* parameterize queries *and* least-privilege the DB
   *and* monitor), and why the residual (1,000/day) is why **A09 logging & monitoring** matters — you
   must detect what still gets through.
7. **A04–A06: Design, Configuration & Components** — three "whole-system" risks. **A04 Insecure
   Design** (a flaw in the design itself, not the code — missing a control that should have existed;
   the fix is **threat modeling** and secure design patterns, shifting security **left**). **A05
   Security Misconfiguration** (default credentials, verbose error messages leaking internals, an open
   S3 bucket, unnecessary features enabled; the fix is **secure defaults**, hardening, least
   functionality). **A06 Vulnerable and Outdated Components** (a known-vulnerable dependency — the
   **Log4Shell** class; the fix is **software composition analysis / dependency scanning** and prompt
   patching). `Callout` on the difference between an insecure *implementation* (a bug) and an insecure
   *design* (a missing control). ≥1 `<KnowledgeCheck>` may live here or later.
8. **A07–A10: Auth, Integrity, Logging & SSRF** — the last four. **A07 Identification and
   Authentication Failures** (weak passwords, no MFA, broken session management — the
   [Authentication](/topics/security/authentication) topic). **A08 Software and Data Integrity
   Failures** (trusting unverified code/data — **insecure deserialization**, unsigned auto-updates, a
   compromised **CI/CD** pipeline — the **SolarWinds** class; fix with signatures and integrity
   checks). **A09 Security Logging and Monitoring Failures** (you can't detect, respond to, or
   investigate what you never logged — breaches dwell for months). **A10 SSRF** (an attacker makes the
   **server** issue requests on their behalf — classically to reach an internal-only address like the
   **cloud metadata endpoint** and steal credentials; fix with an **allowlist** of destinations and
   blocking internal ranges). Embed `<SsrfAttackSequence />`. ≥1 `<KnowledgeCheck>`.
9. **Cross-Cutting Defenses & Best Practices** — `Callout variant="warning"` with the recurring
   mistakes (trusting client input, blocklists instead of allowlists, security by obscurity, "we'll
   add security later," no logging). Then the unifying defenses that knock out whole classes at once:
   **validate input + encode output**, **least privilege + deny-by-default**, **defense in depth**,
   **secure defaults**, **keep components patched**, **log and monitor**, and **shift security left
   (secure SDLC / threat modeling)**. A `DecisionRecord` on treating the Top 10 as a baseline woven
   into the SDLC rather than a pre-release checklist. ≥1 `<KnowledgeCheck>` may live here.
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total across the page, plus a `<Faq>` with
    **≥ 10** entries (what the list is / how to use it; why access control is #1; IDOR; crypto
    failures; injection & parameterized queries; XSS; defense in depth; insecure design vs bug;
    misconfiguration; vulnerable components / Log4Shell; SSRF & metadata endpoint; logging; is it a
    checklist).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. (No `ApiContract`.)

### New, OWASP-specific
- `lib/owasp-top-10-estimates.ts` — pure capacity calc, typed `OwaspRiskCapacityAssumptions` /
  `OwaspRiskCapacityResults`.
- `components/learning/owasp-top-10-capacity.tsx` — wraps `CapacityTable`, registered as
  `OwaspRiskCapacity`.
- `components/diagrams/owasp-top-10-flows.tsx` — `InjectionAttackSequence` (attacker sends malicious
  input → app concatenates it into a query → the database executes the injected commands → data
  exfiltrated; caption contrasts with parameterized queries) and `SsrfAttackSequence` (attacker
  supplies a crafted URL → the vulnerable server fetches it → it is steered to the internal cloud
  metadata endpoint → credentials returned to the attacker; caption explains the allowlist defense).
  Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `owasp-top-10` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `OwaspRiskCapacity`, `InjectionAttackSequence`, `SsrfAttackSequence`.
- `lib/topics.ts` — flip `owasp-top-10` to `available`.
- `content/topics/owasp-top-10.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing
  `getTopic` "returns undefined" check from `owasp-top-10` to a still-coming-soon slug
  (`api-security`).

## Capacity Model (exact)

`lib/owasp-top-10-estimates.ts`, pure & deterministic. Attack counts rounded to integers via
`Math.round` (they're discrete attacks; rounding removes float noise from `0.1**3`).

Assumptions (used in the MDX embed and the test):
```ts
{
  attackAttemptsPerDay: 1_000_000,
  blockRatePerLayer: 0.9,
  layers: 3,
}
```

Results (deterministic):
- `singleControlBreaches` = round(1,000,000 × (1 − 0.9)) = **100,000** /day
- `layeredBreaches` = round(1,000,000 × (1 − 0.9)³) = **1,000** /day
- `defenseInDepthFactor` = round(100,000 / 1,000) = **100**
- `overallReductionFactor` = round(1,000,000 / 1,000) = **1,000**

Headline lesson: no single control is perfect, but **independent controls multiply**. Against a
million automated attacks a day, one 90%-effective control still lets **100,000** through; **three
independent 90% layers** cut that to **1,000** — **100×** better than one control, **1,000×** better
than none. Security is **multiplicative layering** (validate input *and* parameterize *and*
least-privilege *and* monitor), not a single silver bullet — and the residual that still gets through
(1,000/day) is exactly why **logging & monitoring (A09)** is itself a Top 10 item: you must be able to
see and respond to what the layers miss.

## Numerical & Terminology Invariants

- The **OWASP Top 10** is a community-driven, **data-backed awareness baseline** (2021 current),
  **categories of risk**, refreshed every few years — a **floor, not a checklist or a threat model**.
- 2021 order: **A01 Broken Access Control** (rose to #1) · A02 **Cryptographic Failures** (renamed
  from Sensitive Data Exposure) · A03 **Injection** · A04 **Insecure Design** (new) · A05 **Security
  Misconfiguration** · A06 **Vulnerable and Outdated Components** · A07 **Identification and
  Authentication Failures** · A08 **Software and Data Integrity Failures** (new) · A09 **Security
  Logging and Monitoring Failures** · A10 **SSRF** (new, community-voted).
- **Injection** = untrusted input executed as code; fix = **separate code from data** (parameterized
  queries, output encoding). **Broken Access Control** #1 = enforce authz server-side, object-level,
  deny-by-default. **SSRF** = server tricked into fetching an internal address (e.g. **cloud metadata
  endpoint**); fix = **allowlist**.
- Capacity: 1,000,000 attacks/day; one 90% control → **100,000** through; three layers → **1,000**
  (**100×** vs one, **1,000×** vs none). Security is **multiplicative defense in depth**.
- Cross-cutting defenses: validate input + encode output, least privilege + deny-by-default, defense
  in depth, secure defaults, patch components, log & monitor, **shift-left / secure SDLC**.

## Testing

- `tests/topic-registry.test.ts` — add: `owasp-top-10` registered; 10 sections; unique ids + valid
  depths. **Update** the "`getTopic` returns undefined" assertion to use `api-security` (still
  coming-soon). Prior topic assertions stay.
- `tests/owasp-top-10-content.test.ts` — all 10 required `h2` ids present; embeds `<OwaspRiskCapacity`,
  `<InjectionAttackSequence`, `<SsrfAttackSequence`; capacity `assumptions` exactly match the estimates
  test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/owasp-top-10-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the OWASP card links through; navigate to
  `/topics/security/owasp-top-10#injection` (direct `page.goto`) and assert the heading and a diagram
  `img` (assert the diagram first so layout settles before the in-viewport check). Curriculum
  assertions **untouched**. Run e2e with `--workers=1`.

## Out of Scope

The mechanisms behind each risk (their own topics), the API/Mobile Top 10 lists, exploitation
tutorials, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for OWASP Top 10 topic`
2. `feat: add OWASP Top 10 capacity model and wrapper`
3. `feat: add injection and SSRF attack diagrams`
4. `feat: register OWASP Top 10 topic route and skeleton`
5. `content: complete OWASP Top 10 topic`
6. `test: verify OWASP Top 10 topic flow end-to-end`
