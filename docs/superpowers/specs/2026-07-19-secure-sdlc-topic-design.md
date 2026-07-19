# Secure SDLC Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `secure-sdlc` (category `security`)

## Goal

Author the next topic in the Security category (the ninth built; `secure-sdlc` in the taxonomy),
reusing the topic-content pipeline built with the eight prior Security topics. The topic is the
**Secure Software Development Lifecycle (Secure SDLC)** — how to build security *into every phase* of
software delivery rather than bolting it on at the end. It is the process/meta topic that ties the
whole Security category together: threat modeling at design, secure coding and **SAST** at
implementation, **DAST/IAST/SCA** at testing, **supply-chain** security in CI/CD, the **shift-left**
cost economics, secure deployment and runtime, and verification/response (**pen testing, bug bounty,
incident response, vulnerability management**).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout` chrome
and the learning components; nested route `/topics/security/secure-sdlc`). The pipeline exists, so the
new work is content + a registry entry + a capacity model + two diagrams + flipping the card to
`available`.

## Scope

**In scope:** what a **Secure SDLC** is (security woven through **every phase** — requirements, design,
implementation, testing, deployment, operations — not a final pentest gate) and the **shift-left**
principle (the earlier a flaw is found, the cheaper it is to fix); **requirements & design** — security
requirements, **threat modeling** (STRIDE/attack surface — cross-ref the forthcoming threat-modeling
topic), **abuse/misuse cases**, and secure design patterns (the OWASP **Insecure Design** answer);
**implementation** — secure coding standards, **code review**, **SAST** (static application security
testing — analyze source for flaws), and keeping secrets out of code (cross-ref the forthcoming
secrets-management topic); **security testing** — the tool taxonomy: **SAST** (white-box, source),
**DAST** (black-box, running app), **IAST** (instrumented, runtime), and **SCA** (software composition
analysis — scan dependencies for known CVEs, the [OWASP](/topics/security/owasp-top-10) vulnerable-
components answer), plus **fuzzing**; **CI/CD & supply-chain security** — securing the pipeline itself,
signing build artifacts, generating an **SBOM** (software bill of materials), provenance/**SLSA**, and
why a compromised pipeline is the **SolarWinds/A08** class; a **capacity model** for the **economics of
shifting left** (cost to fix a flaw rises steeply by phase — ~**100×** in production); **deployment,
runtime & operations** — secure configuration, secrets injection, hardening, DAST/scanning in staging,
runtime monitoring, **vulnerability management** and patching; **verification & response** —
**penetration testing**, **red teaming**, **bug bounty** programs, and **incident response**; the
whole thing as a **continuous loop** (DevSecOps), automated in the pipeline.

**Out of scope (cross-reference, don't duplicate):** the deep mechanics of each control live in their
own topics — threat modeling (its own forthcoming topic — *named* here), storing/rotating secrets
(forthcoming secrets-management topic), the specific risks ([OWASP Top 10](/topics/security/owasp-top-10),
[API Security](/topics/security/api-security)), and the crypto/identity/session mechanisms (their
topics); a tool-by-tool vendor comparison; language-specific linter configuration; a full incident-
response runbook; any change to other topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What a Secure SDLC Is | fundamentals |
| 2 | `requirements-design` | Requirements & Design: Threat Modeling | interview-ready |
| 3 | `secure-implementation` | Implementation: Secure Coding & SAST | interview-ready |
| 4 | `security-testing` | Testing: SAST, DAST, IAST & SCA | interview-ready |
| 5 | `supply-chain` | CI/CD & Supply-Chain Security | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Economics of Shifting Left | interview-ready |
| 7 | `deploy-runtime` | Deployment, Runtime & Operations | advanced |
| 8 | `verification-response` | Verification & Response | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What a Secure SDLC Is** — traditional development treats security as a **gate at the end** (a
   pentest days before launch), which finds flaws when they're most expensive and slowest to fix. A
   **Secure SDLC** instead **builds security into every phase** — requirements, design, implementation,
   testing, deployment, operations — so problems are caught where they're cheap. The governing idea is
   **shift-left**: move security activities as early as possible. `Callout variant="info"`: "security
   is a property you build in continuously, not a test you run at the end — the later a flaw is found,
   the more it costs." Introduce **DevSecOps** (security automated into the delivery pipeline). ≥1
   `<KnowledgeCheck>`.
2. **Requirements & Design: Threat Modeling** — security starts before any code. Capture **security
   requirements** (authn, authz, data protection, compliance) alongside functional ones, write
   **abuse/misuse cases** (how would an attacker misuse this feature?), and **threat model** the design
   — systematically enumerate what can go wrong (STRIDE, trust boundaries, data-flow diagrams) and
   design controls for it. This is the direct answer to OWASP's **Insecure Design** — a missing control
   is cheapest to add on a whiteboard. Cross-ref the forthcoming threat-modeling topic (named). ≥1
   `<KnowledgeCheck>`.
3. **Implementation: Secure Coding & SAST** — during coding, defend with **secure coding standards**
   (validate input, encode output, parameterize queries, least privilege — the recurring defenses),
   **peer code review** with security in mind, keeping **secrets out of source** (cross-ref secrets-
   management), and **SAST (Static Application Security Testing)** — automated white-box analysis of
   source code for vulnerable patterns, run in the IDE and CI so developers get feedback immediately.
   ≥1 `<KnowledgeCheck>`.
4. **Testing: SAST, DAST, IAST & SCA** — the security-testing tool taxonomy, and when each applies.
   **SAST** (white-box, analyzes source — finds flaws early but can't see runtime behavior, false
   positives). **DAST** (black-box, attacks the *running* app from outside — finds runtime/config
   issues, no source needed, but later and shallower). **IAST** (instruments the running app — combines
   both). **SCA (Software Composition Analysis)** — scans **dependencies** for known-vulnerable versions
   (the OWASP vulnerable-components answer; Log4Shell). Plus **fuzzing** (throw malformed input to find
   crashes). `TradeoffTable` over SAST/DAST/IAST/SCA. ≥1 `<KnowledgeCheck>`.
5. **CI/CD & Supply-Chain Security** — the pipeline is both the **enforcement point** (run SAST, SCA,
   secret-scanning, DAST as automated gates) and itself a **target**. **Supply-chain security**: a
   compromised build pipeline or a malicious dependency poisons everything downstream — the
   **SolarWinds / OWASP A08** class. Defenses: **sign build artifacts**, generate an **SBOM (software
   bill of materials)** to know exactly what you ship, verify **provenance** (SLSA), pin and verify
   dependencies, and lock down pipeline credentials. Embed `<SecureSdlcPipelineSequence />`. ≥1
   `<KnowledgeCheck>`.
6. **Capacity: The Economics of Shifting Left** — `SecureSdlcCapacity` fed by
   `lib/secure-sdlc-estimates.ts`. The quantitative case for the whole topic: the cost to remediate a
   flaw rises **steeply by phase** — a bug fixed on the design whiteboard is cheap; the same bug found
   in **production** (incident, emergency patch, breach) costs ~**100×** more. Headline: 100 flaws per
   release at ~$100 each to fix early vs ~$10,000 in production — finding them all in production costs
   **$1,000,000**, but catching **90%** early with a Secure SDLC drops the total to **$109,000**, a
   ~**89% saving** (~9× cheaper). The lesson: shift-left isn't just safer, it's dramatically
   **cheaper**, which is why security automation belongs in the earliest phases and the pipeline.
7. **Deployment, Runtime & Operations** — security continues after ship. **Secure configuration &
   hardening** (secure defaults, least functionality — the OWASP misconfiguration answer), **injecting
   secrets** at deploy (never baked into images), scanning in **staging** (DAST), and then **runtime**:
   **monitoring and logging** (detect what got through — OWASP A09), **vulnerability management**
   (continuously rescan dependencies and infra as *new* CVEs are disclosed against code that hasn't
   changed), and **timely patching**. `Callout` on the point that a dependency safe at ship time
   becomes vulnerable the day a new CVE drops — security is continuous, not a one-time checklist. ≥1
   `<KnowledgeCheck>` may live here or later.
8. **Verification & Response** — independent checks and closing the loop. **Penetration testing**
   (skilled humans actively try to break in), **red teaming** (adversary simulation against the whole
   org), and **bug bounty** programs (crowd-sourced external researchers) find what automation misses.
   When something is found — by a scan, a pentester, or a report — **incident response** and a
   **vulnerability-management loop** triage, prioritize, patch, verify, and learn. Embed
   `<VulnerabilityResponseSequence />`. ≥1 `<KnowledgeCheck>`.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **security as a last-minute gate**
   (found late = expensive), **no automation** (manual security doesn't scale — bake it into CI),
   **ignoring dependencies** (SCA gaps — most code is third-party), **secrets in code/images**, **no
   SBOM / unsigned artifacts** (supply-chain blindness), **scanning but never fixing** (findings
   without remediation SLAs), and **treating it as one-time** (new CVEs appear against unchanged code).
   A `DecisionRecord` on adopting a Secure SDLC / DevSecOps: threat model at design, automate SAST/SCA/
   secret-scanning/DAST as pipeline gates, sign + SBOM artifacts, monitor and manage vulnerabilities
   continuously, and verify with pentests/bug bounty. ≥1 `<KnowledgeCheck>` may live here.
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total, plus a `<Faq>` with **≥ 10** entries
    (what a secure SDLC is; shift-left & cost; threat modeling at design; SAST vs DAST vs IAST; SCA/
    dependencies; supply-chain/SBOM/signing; CI as enforcement point; runtime vuln management; pentest
    vs bug bounty; DevSecOps; why continuous not one-time; the cost economics).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. `TradeoffTable` for the
SAST/DAST/IAST/SCA testing taxonomy. (No `ApiContract`.)

### New, Secure-SDLC-specific
- `lib/secure-sdlc-estimates.ts` — pure capacity calc, typed `SecureSdlcCapacityAssumptions` /
  `SecureSdlcCapacityResults`.
- `components/learning/secure-sdlc-capacity.tsx` — wraps `CapacityTable`, registered as
  `SecureSdlcCapacity`.
- `components/diagrams/secure-sdlc-flows.tsx` — `SecureSdlcPipelineSequence` (a commit flowing through
  the pipeline gates: developer commit → SAST + secret scan → SCA dependency scan → build, sign & SBOM
  → DAST in staging → deploy + runtime monitoring) and `VulnerabilityResponseSequence` (a reported/
  discovered vulnerability moving through triage → prioritize → patch → test → deploy → verify/close).
  Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `secure-sdlc` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `SecureSdlcCapacity`, `SecureSdlcPipelineSequence`,
  `VulnerabilityResponseSequence`.
- `lib/topics.ts` — flip `secure-sdlc` to `available`.
- `content/topics/secure-sdlc.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic. The existing `getTopic` "returns
  undefined" check uses `rate-limiting` (still coming-soon, not being built) — **leave it unchanged**.

## Capacity Model (exact)

`lib/secure-sdlc-estimates.ts`, pure & deterministic.

Assumptions (used in the MDX embed and the test):
```ts
{
  vulnsPerRelease: 100,
  costFixInDesign: 100,
  prodCostMultiplier: 100,
  shiftLeftCatchRate: 0.9,
}
```

Results (deterministic):
- `prodCostPerVuln` = 100 × 100 = **10,000**
- `baselineCostAllInProd` = 100 × 10,000 = **1,000,000**
- `shiftLeftTotalCost` = (90 × 100) + (10 × 10,000) = 9,000 + 100,000 = **109,000**
- `costSaved` = 1,000,000 − 109,000 = **891,000**

(counts derived as `reachProd = vulnsPerRelease − vulnsPerRelease × shiftLeftCatchRate = 10`,
`caughtEarly = 90`.)

Headline lesson: shifting left is not just safer, it's **far cheaper**. A flaw fixed early costs ~$100;
the same flaw found in **production** — emergency patch, incident, possible breach — costs ~**100×** more
(~$10,000). If a release's 100 flaws were all found in production that's **$1,000,000**; catching
**90%** early with a Secure SDLC cuts the total to **$109,000** — an ~**89% saving**. That steep cost
curve *is* the business case for threat modeling, SAST/SCA in the IDE and CI, and every other early
control: the earliest phase you can catch a flaw is the cheapest.

## Numerical & Terminology Invariants

- A **Secure SDLC** builds security into **every phase**, not a final gate; the principle is
  **shift-left** (earlier = cheaper); the culture is **DevSecOps** (security automated in the pipeline).
- Phases & activities: **design** → threat modeling / abuse cases (answers OWASP Insecure Design);
  **implementation** → secure coding, code review, **SAST**, secrets out of code; **testing** →
  **SAST** (white-box source) · **DAST** (black-box running app) · **IAST** (instrumented) · **SCA**
  (dependency CVEs) · fuzzing; **CI/CD** → automated gates + **supply-chain** security (**sign
  artifacts, SBOM, SLSA/provenance** — the A08/SolarWinds class); **deploy/runtime** → hardening,
  secret injection, monitoring, **vulnerability management**, patching; **verify/respond** → **pen
  testing, red team, bug bounty, incident response**.
- **SAST** = static/source/early; **DAST** = dynamic/running/later; **SCA** = dependencies.
- Capacity: 100 flaws; ~$100 early vs ~$10,000 (**100×**) in prod ⇒ all-in-prod **$1,000,000**, 90%
  shift-left **$109,000**, saving **$891,000** (~**89%**).
- Security is **continuous** — a dependency safe at ship becomes vulnerable when a new CVE drops.

## Testing

- `tests/topic-registry.test.ts` — add: `secure-sdlc` registered; 10 sections; unique ids + valid
  depths. Leave the existing "`getTopic` returns undefined" assertion (`rate-limiting`) unchanged.
  Prior topic assertions stay.
- `tests/secure-sdlc-content.test.ts` — all 10 required `h2` ids present; embeds `<SecureSdlcCapacity`,
  `<SecureSdlcPipelineSequence`, `<VulnerabilityResponseSequence`; capacity `assumptions` exactly match
  the estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/secure-sdlc-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the Secure SDLC card links through; navigate to
  `/topics/security/secure-sdlc#supply-chain` (direct `page.goto`) and assert the heading and a diagram
  `img` (assert the diagram first so layout settles before the in-viewport check). Curriculum
  assertions **untouched**. Run e2e with `--workers=1`.

## Out of Scope

Deep threat-modeling method, secrets storage/rotation internals, the specific risk lists, crypto/
identity mechanics, vendor tool comparisons, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for Secure SDLC topic`
2. `feat: add Secure SDLC capacity model and wrapper`
3. `feat: add secure pipeline and vulnerability-response diagrams`
4. `feat: register Secure SDLC topic route and skeleton`
5. `content: complete Secure SDLC topic`
6. `test: verify Secure SDLC topic flow end-to-end`
