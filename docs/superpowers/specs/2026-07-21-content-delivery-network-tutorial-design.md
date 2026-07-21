# Content Delivery Network Tutorial — Design Spec

**Date:** 2026-07-21
**Status:** Approved for planning
**Problem:** `content-delivery-network` (curriculum sequence 33, difficulty **Advanced**)

## Goal

Author the **Content Delivery Network** tutorial (`/learn/content-delivery-network`) — a Cloudflare /
Akamai / Fastly-class system. Many earlier tutorials *used* a CDN as a black box (Pastebin, Video
Streaming, Photo Sharing, Maps & Navigation all offload reads to "the CDN"); this tutorial **builds the
CDN itself**. The reframe: it *looks* like "just cache static files close to users," but the hard part is
running a **globally-distributed cache** correctly — (1) **request routing**: steering every user to the
right nearby edge out of hundreds of PoPs (Anycast/BGP vs GeoDNS); (2) **origin offload**: driving the
cache-hit ratio as high as possible *and* protecting a single origin from the thundering herd of misses
(cache hierarchy, origin shield, request coalescing); and (3) **cache invalidation**: keeping thousands of
independent cached copies correct when content changes (TTL revalidation vs active purge vs versioned
immutable URLs) — famously one of the two hard problems in computer science.

Concepts (from curriculum): **Edge caching, Cache invalidation, Origin shield, Geo-routing**.

## Section Outline (18 sections)

Standard spine + 6 deep dives (8–13). `id`s must match the MDX `<h2 id>` and registry.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `request-routing` | Request Routing to the Edge | advanced |
| 9 | `edge-cache` | The Edge Cache: Keys, TTLs & Hit Ratio | advanced |
| 10 | `origin-offload` | Origin Offload: Hierarchy & Shield | advanced |
| 11 | `cache-invalidation` | Cache Invalidation & Freshness | advanced |
| 12 | `dynamic-edge` | Beyond Static: Dynamic & Edge Compute | advanced |
| 13 | `edge-security` | Security at the Edge | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: a CDN isn't "put files on servers near people," it's operating a globally
   distributed cache: route each user to the nearest healthy edge, maximize hit ratio while shielding the
   origin from herds of misses, and keep thousands of cached copies correct. `Callout variant="interview"`
   45-min plan. Note this tutorial builds the CDN that Pastebin / Video Streaming / Photo Sharing / Maps
   consumed.
2. **Requirements** — functional: serve content from an edge near the user; cache origin content on the
   edge; route users to the nearest healthy PoP; invalidate/purge content on demand; support cache-control
   policies; terminate TLS at the edge. Non-func: **low global latency**, **high cache-hit ratio / origin
   offload**, **massive request + bandwidth scale**, **availability under PoP/origin failure**, **bounded
   staleness / freshness**, **DDoS resilience**. `RequirementsTable`.
3. **Capacity** — `CdnCapacity`. Lesson: **origin offload is the whole game and the cache-hit ratio is the
   master lever, non-linearly.** 20M edge req/s at 95% hit ⇒ origin sees only 1M req/s (**20× offload**),
   and 2000 GB/s served from the edge vs 100 GB/s from origin. Pushing the hit ratio 95% → 99% cuts origin
   load another **5×** (1M → 200k req/s) — the last few percent matter most.
4. **Entity Model** — the **cache entry** (cache key, cached bytes, TTL/expiry, ETag/last-modified, size),
   the **origin/distribution config** (origin URL, cache rules, TTL policy, cache-key spec), and the **edge
   PoP** (a node in the fleet). `EntityModel`.
5. **API Design** — three surfaces: (a) `GET` end-user content fetch with cache semantics (`Cache-Control`,
   `ETag`, conditional `If-None-Match` → `304`), (b) `POST /purge` control-plane invalidation (by URL,
   path/wildcard, or surrogate/cache tag), (c) `PUT` origin/distribution config (origin + cache behavior).
   Three `ApiContract`s.
6. **High-Level Architecture** — `CdnArchitecture` HLD: user → request routing (Anycast/GeoDNS) → nearest
   edge PoP (cache) → on miss → origin shield (mid-tier) → origin; a **control plane** pushes config +
   purges to every edge.
7. **Detailed Flows** — four sequences (below); show routing + cache lookup here, origin-shield and
   invalidation in their deep dives.
8. **Request Routing to the Edge** — how a user reaches the nearest of hundreds of PoPs. **Anycast**: the
   same IP is announced from every PoP and BGP routes the user to the network-nearest one (simple, fast
   failover; coarse; a route can flip mid-flow but stateless HTTP just re-establishes the TCP connection).
   **DNS-based / GeoDNS** (with EDNS client-subnet): the resolver returns the IP of the nearest/healthiest
   edge (more control, load- and health-aware; bounded by DNS TTL and resolver caching/location). Both use
   **health checks** to steer traffic away from failed or overloaded PoPs. `KnowledgeCheck`. Embed
   `<EdgeRequestRoutingSequence />` here (also shown in flows).
9. **The Edge Cache: Keys, TTLs & Hit Ratio** — inside a PoP. The **cache key** (normalized URL + a chosen
   subset of headers/query) decides what counts as "the same object"; including volatile fields
   (cookies, tracking query params) **fragments** the cache and destroys the hit ratio. **Cacheability** is
   driven by `Cache-Control` (`max-age`, `s-maxage`, `immutable`, `no-store`). A **hit** serves from edge
   RAM/SSD; a **miss** fetches from origin, stores with a TTL, then serves. Working sets exceed RAM, so
   caches are **tiered (RAM → SSD)** with **LRU-style eviction** (the [Distributed Cache](/learn/distributed-cache)
   eviction/hot-key problem). The **cache-hit ratio is the headline KPI**. `KnowledgeCheck`.
10. **Origin Offload: Hierarchy & Shield** — the danger case: a popular object goes cold or its TTL
    expires, and **thousands of edges stampede the origin at once** (a cache stampede / thundering herd,
    the [Distributed Cache](/learn/distributed-cache) stampede problem at global scale). Three defenses:
    **request coalescing / collapsed forwarding** (concurrent misses for the same key at one edge become a
    single origin fetch, the rest wait); an **origin shield / mid-tier parent cache** (edges fetch from one
    regional parent, not the origin, so the hierarchy funnels the whole fleet's misses down to a trickle);
    and **stale-while-revalidate** (serve the stale copy while one request refreshes in the background).
    `KnowledgeCheck`. Embed `<OriginShieldSequence />`.
11. **Cache Invalidation & Freshness** — the hard problem: content is cached across thousands of
    independent edges; when it changes at the origin, how does every copy update? Three strategies:
    **TTL-based expiry + revalidation** (the default — each entry expires after its TTL, then the edge
    revalidates with a conditional `GET`/`If-None-Match` and gets a cheap `304`; simple, eventually
    consistent, bounded staleness); **active purge/invalidation** (the control plane pushes a purge — by
    URL, by path/wildcard, or by **surrogate/cache tag** — to every edge, with real propagation latency
    across the fleet); and **versioned immutable URLs** (put a content hash in the filename so new content
    = a new URL that can be cached forever and *never* needs invalidation — the same trick as
    [Pastebin](/learn/pastebin) and [Photo Sharing](/learn/photo-sharing)). `KnowledgeCheck`. Embed
    `<CacheInvalidationSequence />`.
12. **Beyond Static: Dynamic & Edge Compute** — not everything is cacheable, but the CDN still helps.
    **Connection/route optimization**: terminate TLS and the user's TCP at the edge and reuse warm,
    optimized backbone connections to the origin, accelerating even uncacheable requests. **Micro-caching**:
    cache "dynamic" responses for even ~1 second to absorb enormous hot-endpoint load. **Edge compute**:
    run logic at the edge (personalization, auth, A/B, rewrites) and **edge-side includes** — cache the
    static shell of a page and compose the small dynamic fragments at the edge. `KnowledgeCheck` may live
    here.
13. **Security at the Edge** — because the CDN sits in front of everything with huge distributed capacity,
    it's the natural security perimeter. **TLS termination** near the user (fast handshakes, session
    resumption). **DDoS absorption**: the distributed edge and Anycast spread and soak volumetric floods
    that would flatten a single origin. **WAF / rate limiting / bot management** at the edge block malicious
    traffic before it ever reaches the origin (the [Rate Limiter](/learn/rate-limiter) applied at the
    edge). `Callout`.
14. **Scalability & Evolution** — staged `TradeoffTable` (single reverse-proxy cache in front of origin →
    multi-PoP CDN with GeoDNS/Anycast routing → cache hierarchy + origin shield → global edge platform with
    edge compute & security).
15. **Resiliency & Failure Modes** — `FailureMatrix` (PoP/edge failure, origin unreachable, cache stampede
    on hot expiry, poisoned/incorrect cache entry, config/purge push failure, DDoS flood, cold-cache
    thundering herd).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (Anycast vs DNS routing; TTL vs active purge vs
    immutable URLs; pull/lazy fill vs push/pre-warm; origin shield vs direct-to-origin).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `EdgeRequestRoutingSequence` — user → routing → nearest edge: the user's request is steered (Anycast BGP
  or GeoDNS) to the network-nearest healthy PoP, which accepts the connection. Caption: Anycast/GeoDNS
  steers each user to the nearest healthy edge PoP, routing around a failed one.
- `EdgeCacheLookupSequence` — client → edge cache → origin: the edge looks up the cache key; a **hit**
  serves immediately without touching the origin, a **miss** fetches from the origin, stores the object
  with a TTL, and serves it. Caption: on a hit the edge answers without contacting the origin; the hit
  ratio is what offloads the origin.
- `OriginShieldSequence` — edges → shield → origin: concurrent misses from several edges are funneled to a
  single origin-shield parent cache, which makes one origin fetch and fans the result back. Caption:
  request coalescing at an origin shield collapses a thundering herd of concurrent misses into one origin
  fetch. (Asserted keyword "coalescing"/"thundering herd" **caption-only**; node labels distinct.)
- `CacheInvalidationSequence` — publisher → control plane → edges: a content change triggers a purge that
  the control plane propagates to every edge, which evicts the stale entry so the next request refetches
  fresh. Caption: a purge propagates from the control plane to every edge to invalidate stale content;
  versioned immutable URLs avoid invalidation entirely.

## Capacity Model (exact)

`lib/content-delivery-network-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`. All integer
math (hit ratios expressed as integer percents to avoid float drift).

Assumptions (MDX embed and test):
```ts
{
  dailyRequests: 1_728_000_000_000,
  cacheHitPercent: 95,
  improvedHitPercent: 99,
  avgObjectBytes: 100_000,
}
```

Results:
- `edgeRequestsPerSec` = 1,728,000,000,000 / 86,400 = **20,000,000**
- `originRequestsPerSec` = 20,000,000 × (100 − 95) / 100 = **1,000,000**
- `offloadFactor` = 100 / (100 − 95) = **20**
- `originRequestsAtImprovedHitRatio` = 20,000,000 × (100 − 99) / 100 = **200,000**
- `originReductionFactor` = 1,000,000 / 200,000 = **5**
- `edgeEgressGbPerSec` = 20,000,000 × 100,000 / 1e9 = **2000**
- `originEgressGbPerSec` = 1,000,000 × 100,000 / 1e9 = **100**

Lesson: a CDN's entire economic and architectural point is **origin offload**, and the **cache-hit ratio
is the master lever**. At 20M requests/sec and a 95% hit ratio, the origin sees only **1M requests/sec** —
a **20× reduction** — and supplies **100 GB/s** instead of the **2000 GB/s** the edge serves. Crucially the
lever is **non-linear**: raising the hit ratio from 95% to 99% (a "small" 4 points) cuts origin load
another **5×**, from 1M to 200k requests/sec, because origin traffic scales with the *miss* ratio (5% → 1%
is a fifth). So the design obsesses over hit ratio — cache-key hygiene, long TTLs, immutable URLs, and an
origin shield — because every fraction of a percent of hits is worth far more at the origin than it looks.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/content-delivery-network-estimates.ts` + test; `components/learning/content-delivery-network-capacity.tsx`
(`CdnCapacity`); `components/diagrams/content-delivery-network-architecture.tsx` (`CdnArchitecture`);
`components/diagrams/content-delivery-network-flows.tsx` (`EdgeRequestRoutingSequence`,
`EdgeCacheLookupSequence`, `OriginShieldSequence`, `CacheInvalidationSequence`). Register all in
`mdx-components.tsx`. **Collision check done — all six new export names are unused** (existing
`CdnDeliverySequence`, `CacheHitSequence`, `CacheMissSequence`, `ReadCache*` are all distinct).

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `content-delivery-network` →
`available`; `app/learn/[slug]/page.tsx` import + map (`ContentDeliveryNetworkContent`);
`content/tutorials/content-delivery-network.mdx`; `tests/tutorial-registry.test.ts` (add the 18-section
assertion; **the "returns undefined" slug stays `food-delivery`** — still coming-soon, untouched);
`tests/curriculum.test.ts` (**append `"content-delivery-network"` at the end** of the available list —
seq 33, last); `tests/content-delivery-network-content.test.ts`; extend `e2e/pilot.spec.ts` (with
`scrollIntoViewIfNeeded` before the viewport check) and **decrement the "coming soon" count by one
(10 → 9)**. Leave "showing 1 of 33" untouched.

## Invariants

- A CDN = **operating a globally-distributed cache**: route to the nearest edge, maximize hit ratio while
  shielding the origin, keep copies correct.
- Routing: **Anycast (BGP)** or **DNS-based (GeoDNS/ECS)** to the nearest **healthy** PoP; health checks
  route around failures.
- Edge cache: a **cache key** (normalized URL + chosen headers/query) defines identity; volatile fields
  fragment the cache and wreck the hit ratio; tiered **RAM→SSD** with **LRU eviction**; **hit ratio is the
  KPI**.
- Origin offload: defend the origin with **request coalescing**, an **origin shield / mid-tier hierarchy**,
  and **stale-while-revalidate** against the cache-stampede thundering herd.
- Invalidation: **TTL + conditional revalidation (304)** by default; **active purge** by URL/tag with fleet
  propagation latency; **versioned immutable URLs** avoid invalidation entirely (Pastebin/Photo-Sharing
  trick).
- Dynamic: even uncacheable requests benefit from **edge TLS/TCP termination + warm backbone**,
  **micro-caching**, and **edge compute / ESI**.
- Security: the edge is the perimeter — **TLS termination**, **DDoS absorption** (distributed + Anycast),
  **WAF / edge rate limiting**.
- Capacity: 20M edge req/s, 95% hit ⇒ **1M origin req/s (20× offload)**, 2000 vs 100 GB/s; 95→99% cuts
  origin **5×** more (non-linear, scales with miss ratio).

## Commit sequence

1. `docs: design spec and plan for Content Delivery Network tutorial`
2. `feat: add Content Delivery Network capacity model and wrapper`
3. `feat: add Content Delivery Network architecture and flow diagrams`
4. `feat: register Content Delivery Network tutorial route and skeleton`
5. `content: complete Content Delivery Network tutorial`
6. `test: verify Content Delivery Network tutorial flow end-to-end`
