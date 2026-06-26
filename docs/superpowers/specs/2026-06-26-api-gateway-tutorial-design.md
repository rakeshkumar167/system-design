# API Gateway Tutorial — Design Spec

**Date:** 2026-06-26
**Status:** Approved for planning
**Curriculum slug:** `api-gateway` (sequence 6, Intermediate)

## Goal

Author the fourteenth complete curriculum tutorial — and the first **edge / control-point**
one: an interview-grade walkthrough of designing an **API Gateway**, the single front door that
fronts a fleet of backend microservices and centralizes the cross-cutting concerns every service
would otherwise reimplement — request routing and service discovery, authentication and
authorization, rate limiting and quotas, TLS termination, observability, and resilience — while
sitting on the critical path of *every* request.

This is a change of shape from the prior tutorials. It *looks* like a reverse proxy that forwards
requests, and the point is to show that being the one component every request must pass through
makes it the hardest, most critical box in the system. The gateway must add auth, routing, and
rate limiting in **single-digit milliseconds** (it's a tax on every call), stay **stateless** so
it scales horizontally, separate the **data plane** (the high-throughput proxies) from the
**control plane** (which manages routes, keys, and policies and pushes them out without
redeploys), cache auth/limit state so per-request overhead stays tiny, and **degrade gracefully**
because if the gateway is down, *everything* is down. It reuses the rate-limiting algorithms from
the Rate Limiter tutorial and the read-path/caching intuition from earlier ones, but centers them
on a *shared edge control point* rather than a single application.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is gateway-specific
content, a capacity module + wrapper, one architecture diagram, four flow-sequence diagrams, and
the registry/curriculum wiring.

## Framing & Scope

**What we design:** the edge service through which all client traffic enters a microservice
platform. The defining tensions are:

- **A transparent, low-latency control point on every request (latency budget + statelessness)**
  — the gateway intercepts every call to run a **filter/middleware chain** (authN → authZ →
  rate-limit → transform → route → forward), so its own overhead must be a small fraction of total
  latency; it holds no per-request state, so any instance can serve any request and the fleet
  scales horizontally behind a load balancer.
- **Control plane vs data plane (config distribution)** — the **data plane** forwards requests at
  high throughput; a separate **control plane** owns the configuration (routes, upstreams, API
  keys, rate-limit policies) and **pushes** it to the data-plane instances, which hold a cached
  in-memory copy — so operators change routing and policy **without redeploying** the proxies.
- **Centralized cross-cutting concerns without a single point of failure** — auth, rate limiting,
  and observability live once at the edge instead of in every service, but that makes the gateway
  critical, so it must be replicated, fail sensibly (fail-open vs fail-closed per concern), and
  protect backends with **timeouts, retries, and circuit breaking**.

**In scope:** the request lifecycle / filter chain, routing and service discovery, authentication
and authorization at the edge, rate limiting and quotas, the control-plane/data-plane split and
config distribution, and resilience + observability — plus scaling, failure modes, and trade-offs.
**Out of scope (mention, then set aside):** the backend services' own business logic (the gateway
routes to them; what they do is theirs), a full identity provider / OAuth authorization-server
implementation (we *verify* tokens, we don't mint them — that's a separate system), the service
mesh sidecar model beyond a comparison, GraphQL federation / response aggregation beyond a mention,
and the public developer portal / API marketplace.

## Section Outline (18 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `request-lifecycle` | Request Lifecycle & the Filter Chain | advanced |
| 9 | `routing-discovery` | Routing & Service Discovery | advanced |
| 10 | `auth` | Authentication & Authorization | advanced |
| 11 | `rate-limiting` | Rate Limiting & Quotas | advanced |
| 12 | `control-data-plane` | Control Plane & Data Plane | advanced |
| 13 | `resilience-observability` | Resilience & Observability | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what an API gateway is and why it exists (one front door so N services
   don't each reimplement auth, rate limiting, TLS, and routing). The reframe: it *looks* like a
   reverse proxy, but the hard part is being a transparent, low-latency, always-on control point on
   the critical path of every request — single-digit-ms overhead, stateless horizontal scale, a
   control/data-plane split so config changes without redeploys, and graceful degradation because
   if the gateway is down everything is down. Scope; a `Callout variant="interview"` 45-min
   allocation. Contrast gateway vs load balancer vs service mesh.
2. **Requirements** — `RequirementsTable`. Functional: route requests to the right upstream;
   authenticate & authorize; rate-limit / enforce quotas; terminate TLS; transform requests/
   responses (headers, protocol); emit logs/metrics/traces; manage routes & policies via an admin
   API. Non-functional: **low added latency** (single-digit ms), **very high throughput** (fronts
   all traffic), **stateless horizontal scalability**, **high availability / no SPOF**,
   **config changes without redeploy**, **secure by default**.
3. **Capacity Estimates** — `ApiGatewayCapacity` fed by `lib/api-gateway-estimates.ts`. Derive
   **avg & peak RPS** (the gateway sees the sum of all traffic), **gateway instances needed**
   (peak ÷ per-instance capacity), **latency-overhead %** (gateway overhead as a fraction of total
   request latency), **effective auth-lookup latency** (with a cached token check), and **auth-store
   QPS** (offloaded by the cache). Headline: the gateway carries aggregate traffic and is on every
   request's critical path, so its overhead must stay a small fraction of latency; statelessness
   lets it scale horizontally; and caching auth/limit state keeps per-request cost tiny and offloads
   the central store ~20×.
4. **Entity Model** — `EntityModel name="Route"` (route_id, match, upstream, filters, rate_limit,
   auth_policy, timeout_ms, retries). Prose on the **Consumer/API key** (identity + plan + quota),
   the **rate-limit counter** (transient, in a fast shared store), the **service-registry entry**
   (upstream instances + health), and that the **control plane owns the config** (source of truth)
   while the **data plane holds a cached in-memory copy** compiled into a fast match structure.
5. **API Design** — `ApiContract`: a **data-plane proxied request** (`GET /orders/{id}` with a
   bearer token → 200 forwarded / 401 / 429) showing request-time behavior; an **admin route**
   (`PUT /admin/routes/{id}`) declaring match → upstream + policies; and an **admin consumer**
   (`POST /admin/consumers`) registering an identity + credential + rate-limit plan. Emphasize the
   split between the (arbitrary) proxied client API and the gateway's own admin/control API.
6. **High-Level Architecture** — `ApiGatewayArchitecture`: client → gateway data-plane fleet (runs
   the filter chain) → backend services; an auth service / token introspection, a rate-limit
   counter store, a service registry for discovery, a control plane + config store pushing config
   to the data plane, and a telemetry sink. Caption names the data-plane/control-plane split, the
   filter chain, edge auth/rate-limiting, and that the gateway centralizes cross-cutting concerns.
7. **Detailed Flows** — `ProxyRequestSequence` (happy path: authN → rate-limit → route → forward →
   response), `AuthRejectSequence` (an unauthenticated or over-limit request rejected at the edge
   before any backend is touched), `ConfigPushSequence` (control plane validates and pushes new
   route/policy config to data-plane instances, which hot-reload it), `CircuitBreakSequence` (a
   failing upstream trips the circuit breaker so the gateway fails fast and sheds load instead of
   piling onto a sick backend).
8. **Request Lifecycle & the Filter Chain** — first deep dive: a request flows through an ordered
   pipeline of **filters/middleware** (a chain-of-responsibility): TLS termination, authN, authZ,
   rate-limit, request transform, route match, forward to upstream, response transform, and the
   observability hooks that wrap the whole thing. Pre-filters vs post-filters; short-circuiting
   (reject early before touching a backend); why ordering matters (auth before rate-limit before
   routing). Include a `<KnowledgeCheck>`.
9. **Routing & Service Discovery** — matching a request (host + path + method) to an upstream via a
   compiled **radix/trie** match structure; **service discovery** (a registry of healthy upstream
   instances) and **load balancing** across them; health checks and removing bad instances;
   blue-green / canary routing by rules. Include a `<KnowledgeCheck>`.
10. **Authentication & Authorization** — verifying identity at the edge so backends don't each do
    it: API keys, **JWT validation** (verify signature locally — no network call — vs **token
    introspection** for opaque tokens, which is a lookup you cache), OAuth2 bearer tokens; then
    **authorization** (scopes/roles). The trade-off: local JWT verification is fast but revocation
    is harder; introspection is authoritative but adds a lookup, so you cache it. Include a
    `<KnowledgeCheck>`.
11. **Rate Limiting & Quotas** — protecting backends and enforcing per-consumer plans; reuse the
    **token-bucket / sliding-window** algorithms from the Rate Limiter tutorial, but emphasize the
    gateway angle: **distributed counters** in a shared fast store (so all instances agree), local
    pre-checks to avoid a round-trip per request, fail-open vs fail-closed when the counter store is
    unavailable, and per-plan quotas. Cross-reference the Rate Limiter tutorial. Include a
    `<KnowledgeCheck>`.
12. **Control Plane & Data Plane** — the centerpiece: separate the **data plane** (stateless proxies
    forwarding traffic at high throughput, holding config in memory) from the **control plane**
    (manages routes/keys/policies, validates changes, and **pushes** config out — push vs poll,
    versioned config, hot reload without dropping connections). Why this split exists: change routing
    and policy **without redeploying** the data plane, and keep the data plane simple and fast.
    Include a `<KnowledgeCheck>`.
13. **Resilience & Observability** — protecting backends and seeing what's happening: **timeouts**,
    **retries** (with budgets so retries don't amplify load), **circuit breakers** (trip on an
    unhealthy upstream and fail fast), **bulkheading** (isolate one bad upstream from the rest); and
    **observability** — structured logs, the **RED metrics** (rate/errors/duration), and
    **distributed tracing** with a correlation id injected at the edge. The gateway is the natural
    place for all of this because every request passes through it.
14. **Scalability & Evolution** — `TradeoffTable`: per-service libraries (no gateway) → single
    gateway instance → stateless replicated data plane + control plane + shared counter/auth caches →
    multi-region edge gateways (or service-mesh sidecars for east-west traffic).
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): gateway instance dies (stateless
    replicas), control-plane outage (data plane keeps serving last-good config), auth-store/IdP
    down (cached tokens / fail-open or fail-closed by policy), rate-limit store down (fail-open with
    local fallback), upstream service down/slow (circuit breaker + timeouts), config push of a bad
    route (validation + versioned rollback), traffic spike / thundering herd (autoscale +
    load-shed).
16. **Trade-offs & Alternatives** — `DecisionRecord`: stateless data plane + separate control plane +
    cached auth/limit state + circuit breaking; axes: centralized gateway vs per-service libraries,
    control/data-plane split vs monolithic gateway, local JWT verification vs token introspection,
    gateway (north-south) vs service mesh (east-west), fail-open vs fail-closed.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared
`CapacityTable`.

### New, gateway-specific
- `lib/api-gateway-estimates.ts` — pure capacity calc with typed
  `ApiGatewayCapacityAssumptions` / `ApiGatewayCapacityResults`.
- `components/learning/api-gateway-capacity.tsx` — wrapper over `CapacityTable`, registered as
  `ApiGatewayCapacity`.
- `components/diagrams/api-gateway-architecture.tsx` — `ApiGatewayArchitecture`. `role="img"` +
  caption naming the data/control-plane split, the filter chain, and edge cross-cutting concerns.
- `components/diagrams/api-gateway-flows.tsx` — `ProxyRequestSequence`, `AuthRejectSequence`,
  `ConfigPushSequence`, `CircuitBreakSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `api-gateway` entry (18 sections).
- `lib/curriculum.ts` — flip `api-gateway` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/api-gateway.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the fourteenth slug's MDX.
- `tests/tutorial-registry.test.ts` — the "returns undefined for unregistered" slug must change
  from `api-gateway` (now registered) to `web-crawler` (still coming-soon).

## Capacity Model (exact)

`lib/api-gateway-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`. Integer
`instancesNeeded` uses `Math.ceil`; float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  requestsPerDay: 10_000_000_000,
  peakFactor: 3,
  gatewayOverheadMs: 4,
  avgBackendLatencyMs: 80,
  instanceCapacityRps: 5_000,
  authCacheHitRate: 0.95,
  authStoreLatencyMs: 10,
}
```

Results (deterministic):
- `avgRps` = 10,000,000,000 / 86,400 ≈ **115,740.74** /sec
- `peakRps` = avgRps × 3 ≈ **347,222.22** /sec
- `instancesNeeded` = ceil(peakRps / 5,000) = ceil(69.44) = **70**
- `latencyOverheadPct` = 4 / (4 + 80) × 100 ≈ **4.76** %
- `effectiveAuthLatencyMs` = (1 − 0.95) × 10 = **0.5** ms
- `authStoreQps` = peakRps × (1 − 0.95) ≈ **17,361.11** /sec

Headline lesson: the gateway **sees the sum of all traffic** (~**116k/sec** average, ~**347k/sec**
peak), so it must be sized for aggregate load — but because it's **stateless**, it just scales
horizontally to ~**70 instances** at peak. The defining constraint is **latency overhead**: the
gateway is on every request's critical path, so its ~4 ms of work must stay a small fraction
(~**4.8%**) of total request latency — any heavier and it becomes a tax on the whole platform.
That's why auth and rate-limit state are **cached locally**: a 95%-hit token cache turns a 10 ms
introspection into ~**0.5 ms** average, and offloads the central auth store from peak RPS down to
~**17k/sec** (~20× less). The gateway is hard not because of clever computation but because it
must do cross-cutting work for *everyone* at almost no added latency.

## Numerical & Terminology Invariants

- The gateway is on the **critical path of every request**, running an ordered **filter/middleware
  chain** (authN → authZ → rate-limit → transform → route → forward) and **short-circuiting**
  rejects before any backend is touched.
- The gateway is **stateless** (no per-request state), so it scales **horizontally**; shared state
  (rate counters, token cache) lives in a fast external store / local cache.
- **Data plane** (high-throughput proxies, config held in memory) is separated from the **control
  plane** (owns routes/keys/policies, **pushes** versioned config out) so config changes **without
  redeploying** the data plane.
- **Auth** is offloaded to the edge: **local JWT verification** (fast, no network call) vs **token
  introspection** (authoritative, a cached lookup); then **authorization** by scope/role.
- **Rate limiting** uses distributed counters in a shared store with local pre-checks; each
  cross-cutting concern picks **fail-open or fail-closed** when its dependency is down.
- Backends are protected with **timeouts, retries (budgeted), and circuit breakers**; the gateway is
  the natural home for **observability** (RED metrics, structured logs, distributed tracing with an
  edge-injected correlation id).

## Out of Scope

The backend services' business logic, a full IdP / OAuth authorization-server implementation
(we verify tokens, not mint them), the service-mesh sidecar model beyond a comparison, GraphQL
federation/aggregation beyond a mention, the developer portal, and any change to other tutorials.
