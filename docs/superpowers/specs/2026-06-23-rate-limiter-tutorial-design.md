# Rate Limiter Tutorial — Design Spec

**Date:** 2026-06-23
**Status:** Approved for planning
**Curriculum slug:** `rate-limiter` (sequence 2, Foundational)

## Goal

Author the second complete tutorial in the system-design curriculum: a rigorous,
interview-grade walkthrough of designing a **distributed rate-limiting service**.
The tutorial is **algorithm-first** — the five classic algorithms are the
centerpiece, illustrated with an interactive visualizer, and the rest of the
system design follows from the algorithm choice.

This reuses the existing tutorial infrastructure (App Router static routes, MDX,
typed registry, learning components, diagram primitives). The new work is
rate-limiter-specific content, three diagram components, a capacity module, and
the registry/curriculum wiring.

## Framing & Scope

**What we design:** a shared, distributed rate-limiting service that sits at the
API gateway / edge and that backend services consult to allow or throttle a
request. The defining tensions are:

- **Speed** — sub-millisecond enforcement overhead on the request path.
- **Accuracy** — consistent counting across a horizontally-scaled fleet, without
  a single coordination bottleneck.
- **Resilience** — defined behavior (fail-open vs fail-closed) when the counter
  store is degraded or unreachable.

**In scope:** limit policies and keys (per-user / per-IP / per-API-key / tiered),
the five algorithms, the allow/throttle API and response semantics, distributed
counting, consistency/races, scaling evolution, failure modes, and observability.

**Out of scope (mention, then set aside):** billing/quota productization, DDoS
mitigation at L3/L4, WAF rules, and per-tenant analytics dashboards.

## Section Outline (15 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `limit-policies` | Limit Policies & Keys | interview-ready |
| 4 | `algorithms` | Algorithms | interview-ready |
| 5 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 6 | `api-design` | API Design | interview-ready |
| 7 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 8 | `distributed-counting` | Distributed Counting | advanced |
| 9 | `consistency-races` | Consistency & Races | advanced |
| 10 | `scalability-evolution` | Scalability & Evolution | advanced |
| 11 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 12 | `observability` | Observability | advanced |
| 13 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 14 | `interview-summary` | Interview Summary | interview-ready |
| 15 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what rate limiting is, why (protect resources, fairness,
   cost, abuse), where it sits (edge/gateway/sidecar). Scope statement and a
   suggested 45-minute time allocation (`Callout variant="interview"`).
2. **Requirements** — `RequirementsTable`. Functional: enforce N requests per
   window per key; multiple named policies; tiered limits; return remaining quota.
   Non-functional targets: enforcement overhead p99 < 1 ms; availability 99.99%;
   accuracy tolerance; **fail-open** default with explicit justification; horizontal
   scalability.
3. **Limit Policies & Keys** — `EntityModel` for `RateLimitPolicy` (name, limit,
   window, algorithm, scope) and the composite counter **key** (policy + identity
   dimension). Explain per-user vs per-IP vs per-API-key vs global, and tiered
   plans. Cardinality matters for the capacity section.
4. **Algorithms (centerpiece)** — all five: **fixed window**, **sliding window
   log**, **sliding window counter**, **token bucket**, **leaky bucket**. Each with
   mechanism, memory cost, burst behavior, and accuracy. Embed the interactive
   **`RateLimitVisualizer`** and a `TradeoffTable` comparing them. Recommend
   **token bucket** (burst-friendly, cheap) and **sliding window counter**
   (smooths the fixed-window boundary spike) for the stated design.
5. **Capacity Estimates** — `CapacityModel` fed by `lib/rate-limiter-estimates.ts`.
   Derive counter ops/sec from request volume, counter memory from key cardinality,
   and Redis node count.
6. **API Design** — `ApiContract`. The synchronous `check`/allow contract (HTTP and
   a note on gRPC), `429 Too Many Requests`, `Retry-After`, and the
   `X-RateLimit-Limit` / `-Remaining` / `-Reset` headers. Idempotency and the cost
   of a network hop per request (and how a sidecar avoids it).
7. **High-Level Architecture** — `RateLimiterArchitecture` diagram: client → gateway
   / limiter middleware → central counter store (Redis), with the fail-open path.
   Component responsibilities and boundaries.
8. **Distributed Counting** — the core deep dive. Centralized counter (Redis
   `INCR` + TTL, atomic Lua script) vs local in-memory counters synced
   out-of-band; exact vs approximate counting; why naive read-modify-write races.
   Reference `RateLimitFlows` sequence diagrams.
9. **Consistency & Races** — atomic increment, the fixed-window boundary burst
   (2× limit across a boundary) and how the sliding window counter mitigates it,
   clock skew between nodes, and TTL/window alignment.
10. **Scalability & Evolution** — four stages: single-node in-memory → centralized
    Redis → sharded Redis (key-hashed) → local-token + global-reconciliation
    hybrid (cell-based). Trigger and cost at each stage. Reuse the
    `ScaleEvolution`-style presentation if generic enough, else a dedicated diagram.
11. **Resiliency & Failure Modes** — `FailureMatrix`: counter store outage
    (fail-open vs fail-closed), hot key, thundering herd on reset, network
    partition, clock skew, node loss — impact, signal, mitigation, recovery.
12. **Observability** — SLIs/SLOs, allowed/throttled counters, per-policy and
    per-key cardinality concerns, alerting on throttle-rate spikes.
13. **Trade-offs & Alternatives** — accuracy vs cost, centralized vs distributed,
    synchronous vs sidecar enforcement, exact vs approximate. `DecisionRecord`.
14. **Interview Summary** — concise spoken answer and likely follow-ups.
15. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `KnowledgeCheck`, `Faq`, `DepthSection`, `DecisionRecord`,
`DiagramFrame`, diagram primitives.

### Generalized
`components/learning/capacity-model.tsx` is currently hard-coupled to the URL
Shortener (imports `calculateUrlShortenerCapacity`, hard-codes labels and
consequences). **Refactor it into a data-driven presentational component** that
accepts pre-computed rows:

```ts
interface AssumptionRow { label: string; value: string; }
interface ResultRow { label: string; value: string; consequence: string; }
function CapacityModel(props: { assumptions: AssumptionRow[]; results: ResultRow[] }): JSX.Element
```

- The URL Shortener call site in `url-shortener.mdx` is updated to build its rows
  (via a small adapter that calls `calculateUrlShortenerCapacity` and formats),
  so the existing tutorial renders identically.
- No test references `CapacityModel` directly (verified), and the URL-shortener
  content test only asserts section ids and counts — so this refactor is safe.
- Pure calculation modules (`url-shortener-estimates.ts`,
  `rate-limiter-estimates.ts`) keep their own typed assumptions/results and
  deterministic unit tests.

### New, rate-limiter-specific
- `components/diagrams/rate-limit-visualizer.tsx` — **client component**. Animates
  the chosen algorithm (tokens refilling, window sliding, counter incrementing) as
  simulated requests arrive. Requirements: meaningful **static SVG fallback** so it
  works without JS; respects `prefers-reduced-motion` (no auto-animation, provide a
  step control); accessible (`role="img"` + description, labeled controls, visible
  focus). Progressive enhancement, never required for comprehension.
- `components/diagrams/rate-limiter-architecture.tsx` — distributed HLD with the
  fail-open path and counter-store boundary. `role="img"` + description.
- `components/diagrams/rate-limit-flows.tsx` — sequence diagrams: allow, throttle
  (`429` + `Retry-After`), and counter-store-outage fail-open fallback.
- `lib/rate-limiter-estimates.ts` — pure capacity calculation with typed
  `RateLimiterCapacityAssumptions` / `RateLimiterCapacityResults`.

### Wiring
- `lib/tutorial-registry.ts` — add the `rate-limiter` entry with the 15 sections.
- `lib/curriculum.ts` — flip `rate-limiter` status to `available`.
- `mdx-components.tsx` — register `RateLimitVisualizer`, `RateLimiterArchitecture`,
  `RateLimitFlows`.
- `content/tutorials/rate-limiter.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the second slug's MDX (mirror the
  url-shortener wiring; no runtime filesystem reads).

## Testing

Mirror the pilot's rigor (TDD where practical):

- `tests/rate-limiter-estimates.test.ts` — deterministic numeric assertions on the
  pure calculation.
- `tests/rate-limit-visualizer.test.tsx` — renders accessible static content
  without JS-dependent state; reveals/steps algorithm state on interaction;
  exposes an accessible name.
- `tests/diagrams.test.tsx` (extend) — `RateLimiterArchitecture` exposes
  `role="img"` and a description naming the fail-open behavior.
- `tests/rate-limiter-content.test.ts` — asserts every section id is present,
  `>= 6` `<KnowledgeCheck`, `>= 12` `question:` FAQ entries.
- `tests/tutorial-registry.test.ts` (update) — registry now has two tutorials;
  `rate-limiter` has 15 sections.
- `tests/curriculum.test.ts` (update) — two `available` problems:
  `["url-shortener", "rate-limiter"]`.
- `e2e/pilot.spec.ts` (extend) or `e2e/rate-limiter.spec.ts` — discover the
  rate-limiter tutorial from the curriculum, scroll to the algorithms section,
  see the visualizer, and interact with a knowledge check. The curriculum
  "Coming soon" count test drops from 24 to 23.

## Numerical & Terminology Invariants

Verify across prose, tables, diagrams, and the capacity module:

- Stated request volume matches the counter ops/sec derivation.
- Fixed window admits up to **2× the limit** across a window boundary; the
  sliding window counter is the cited mitigation.
- Token bucket is the recommended default for burst tolerance; leaky bucket
  produces a smooth/constant outflow.
- Counter increments are **atomic** (single Redis op / Lua script), never
  read-modify-write.
- The default failure posture is **fail-open**, stated explicitly with its risk.
- `429` carries `Retry-After`; responses expose `X-RateLimit-*` headers.

## Out of Scope

User accounts, synced progress, billing, multi-tenant dashboards, real Redis/
backend integration (this is a teaching artifact, not a running limiter), and any
change to tutorials other than the shared `CapacityModel` refactor.
