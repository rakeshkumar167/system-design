# Maps and Navigation Tutorial — Design Spec

**Date:** 2026-06-26
**Status:** Approved for planning
**Curriculum slug:** `maps-navigation` (sequence 24, Advanced)

## Goal

Author the thirteenth complete curriculum tutorial — and the first **geospatial graph-routing**
one: an interview-grade walkthrough of designing **Maps and Navigation** (a "design Google
Maps / route planner" problem) that computes driving routes and live ETAs across a
continent-sized road network, serves the map itself as tiles, and keeps every route fast even
though the graph has tens of millions of nodes and its edge weights change minute to minute
with traffic.

This is a deliberate change of shape from the prior tutorials. It *looks* like a textbook
graph algorithm — run Dijkstra over the road network and return the shortest path — and the
point is to show why that naive framing collapses at scale. Dijkstra over a 50-million-node
continental graph settles ~half the graph per query and is **physically impossible** at the
required QPS, so the real work is **precomputing a hierarchy of the road network** (contraction
hierarchies / customizable route planning) that turns a route into a few-hundred-node,
millisecond lookup. And because the answer must reflect *current* conditions, a firehose of GPS
probes continuously **re-weights** that graph, which the precomputation must absorb without a
full rebuild. Two more subsystems round out the design: **map matching / geocoding** (snapping
noisy GPS and addresses onto the graph) and **tile serving** (the map imagery itself, which
dwarfs route traffic but is static and CDN-cacheable). It reuses CDN/caching intuition from the
Pastebin and Video Streaming tutorials and read-heavy scaling from the URL Shortener, but
centers them on a *routable graph* and *geospatial* data.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is maps-specific
content, a capacity module + wrapper, one architecture diagram, four flow-sequence diagrams,
and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a service where users ask for a driving route between two points and get a
path, turn-by-turn directions, and a live ETA, plus the map tiles to render it. The defining
tensions are:

- **Routing is a graph-search problem that doesn't scale naively (precomputation)** — Dijkstra
  and A* are correct but settle a large fraction of a continental graph per query; at billions
  of requests a day that is impossible. The fix is **precomputation**: build a **contraction
  hierarchy** (or CRP) offline so a query is a bidirectional search over a few hundred nodes —
  a ~10,000×+ reduction in work — answered from an **in-memory graph**, not a per-query database.
- **The graph is alive (dynamic weights + traffic)** — edge weights are travel times that change
  constantly with congestion, so the system ingests a firehose of **GPS probes**, fuses them
  with historical/predictive models into live edge weights, and re-customizes the hierarchy (the
  CRP split of *metric-independent preprocessing* vs cheap *metric customization* exists for
  exactly this) without rebuilding it from scratch.
- **Two supporting subsystems: map matching/geocoding and tiles** — noisy GPS and human
  addresses must be **snapped/geocoded** onto graph nodes before routing; and the map imagery is
  served as **tiles** that outnumber route requests ~50× but are static, pyramidal, and
  **CDN-cacheable**, so they're a delivery problem, not a compute problem.

**In scope:** the road-network graph model, shortest-path routing and why it doesn't scale,
precomputation / contraction hierarchies, map matching and geocoding, live traffic and ETA, and
map-tile serving — plus scaling, failure modes, and trade-offs. **Out of scope (mention, then
set aside):** turn-by-turn voice guidance and the client UX, multi-modal routing (transit,
walking, cycling get a paragraph but the deep dive is driving), the cartography/styling pipeline
that *produces* tiles (we serve them), real-time re-routing mechanics beyond a mention, and the
satellite/imagery stack.

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
| 8 | `road-graph` | The Road Network as a Graph | advanced |
| 9 | `shortest-path` | Shortest-Path Routing | advanced |
| 10 | `precomputation` | Precomputation & Hierarchies | advanced |
| 11 | `map-matching` | Map Matching & Geocoding | advanced |
| 12 | `traffic-eta` | Live Traffic & ETA | advanced |
| 13 | `tile-serving` | Map Tile Serving | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a maps/navigation service is and why it exists. The reframe: it
   *looks* like "run Dijkstra on the road graph," but Dijkstra settles half a continent per
   query and is impossible at scale, and the weights change with traffic — so the hard part is
   **precomputing a hierarchy** so routing is a millisecond in-memory lookup, and continuously
   **re-weighting** that graph from GPS probes. Scope; a `Callout variant="interview"` 45-min
   allocation.
2. **Requirements** — `RequirementsTable`. Functional: compute a fastest/shortest route between
   two points; turn-by-turn directions; live ETA; geocode addresses ↔ coordinates; serve map
   tiles; reflect current traffic. Non-functional: **low query latency** (a route in tens of
   ms), **massive read-heavy scale** (billions of route + tile requests/day), **fresh traffic**
   (weights updated continuously), **high availability**, **global coverage**, eventual
   consistency of traffic is fine (a route need not reflect a jam from one second ago).
3. **Capacity Estimates** — `MapsNavigationCapacity` fed by `lib/maps-navigation-estimates.ts`.
   Derive **route QPS**, **tile QPS** (≈50× routes), **in-RAM graph size**, **Dijkstra nodes
   settled per query**, **naive settles/sec (the impossibility)**, and **CH speed-up**. Headline:
   route QPS is modest but naive per-query Dijkstra is ~10^11 node-settles/sec (impossible), the
   precomputed hierarchy cuts per-query work ~62,500×, the routable graph fits in RAM (few GB),
   and tiles dominate request volume but are CDN-cacheable.
4. **Entity Model** — `EntityModel name="RoadSegment"` (segment_id, from_node, to_node, length_m,
   base_time_sec, road_class, restrictions, live_time_sec). Prose on the **Node/intersection**,
   the **adjacency graph**, the **base (free-flow) vs live (traffic) weight**, the **precomputed
   contraction hierarchy / shortcuts**, and **tiles** as a separate read-only geometry rendering.
   Key point: the directed weighted graph is the source of truth; base_time is static, live_time
   is dynamic, and the hierarchy is a derived acceleration structure.
5. **API Design** — `ApiContract`: `GET /route` (origin/destination coords, departure time →
   path geometry + ETA + steps), `GET /geocode` (address ↔ coordinate), `GET /tiles/{z}/{x}/{y}`
   (a vector/raster map tile). Emphasize that routes are GET/cacheable-ish but
   traffic-sensitive, while tiles are aggressively cacheable and pyramidal (z/x/y).
6. **High-Level Architecture** — `MapsNavigationArchitecture`: client → API/routing gateway →
   map-matching/geocoder → **route engine holding the in-memory CH graph** ← graph/CH store; a
   **traffic pipeline** ingesting GPS probes that updates a live-weights store and re-customizes
   the hierarchy; a **tile service fronted by a CDN**. Caption names the precomputed contraction
   hierarchy, the in-memory graph, live-traffic re-weighting, and CDN tile delivery.
7. **Detailed Flows** — `RouteQuerySequence` (snap origin/dest → bidirectional CH search on the
   in-memory graph → path + ETA), `MapMatchSequence` (a noisy GPS trace snapped to road segments
   via an HMM), `TrafficUpdateSequence` (GPS probes → aggregate → update live weights →
   re-customize the hierarchy), `TileFetchSequence` (client requests z/x/y tile → CDN hit, or
   miss → tile service → cache).
8. **The Road Network as a Graph** — first deep dive: model intersections as **nodes** and road
   segments as **directed weighted edges**; edge weight = traversal time (not just distance);
   one-way streets, turn restrictions (turn costs / expanded graph), road classes. Scale of a
   continental graph (tens of millions of nodes). Why the weight is *time*, and why it must be
   directed. Include a `<KnowledgeCheck>`.
9. **Shortest-Path Routing** — Dijkstra (settles nodes in increasing distance) and **A*** (adds a
   goal-directed heuristic — straight-line distance — to settle fewer nodes); why both are
   correct but still settle far too much of a continental graph per query to hit the latency/QPS
   bar; bidirectional search. The motivation for precomputation: queries are many and the graph
   is (mostly) static, so **move the work offline**. Include a `<KnowledgeCheck>`.
10. **Precomputation & Hierarchies** — the centerpiece. **Contraction Hierarchies**: order nodes
    by importance, contract them one by one adding **shortcut** edges that preserve distances, so
    a query is a **bidirectional search that only ever moves "upward"** in the hierarchy, touching
    a few hundred nodes instead of millions. **Customizable Route Planning (CRP)** and the split
    of expensive **metric-independent preprocessing** from cheap **metric customization** — the
    key to absorbing changing traffic weights without a full rebuild. The trade: heavy offline
    preprocessing and re-customization cost buys ~millisecond queries. Include a `<KnowledgeCheck>`.
11. **Map Matching & Geocoding** — routing needs graph nodes, but inputs are noisy GPS traces and
    human addresses. **Geocoding** (address ↔ coordinate) via a geospatial index; **map matching**
    snapping a sequence of jittery GPS points onto the most likely road path, typically a **hidden
    Markov model** balancing GPS proximity against route plausibility; snapping the origin/
    destination of a route to the nearest routable edge. Include a `<KnowledgeCheck>`.
12. **Live Traffic & ETA** — edge weights are travel times that change with congestion. Ingest a
    firehose of **GPS probes** from devices, aggregate per segment, fuse with **historical/
    predictive** patterns (time-of-day, day-of-week) into live weights; recompute ETA along the
    route (accounting for predicted conditions at the time you'll *reach* each segment, not now);
    feed the live weights into CRP customization. Eventual consistency is acceptable. Include a
    `<KnowledgeCheck>`.
13. **Map Tile Serving** — the map imagery is a **pyramid of tiles** addressed by zoom/x/y;
    vector vs raster tiles; tiles are static, immutable per version, and **massively
    CDN-cacheable**, so this is a delivery/caching problem (origin offload, edge caching) rather
    than a compute one — contrast with the compute-bound route engine. Tiles dominate request
    volume but are cheap to serve.
14. **Scalability & Evolution** — `TradeoffTable`: single-server Dijkstra → A* + in-memory graph
    → precomputed contraction hierarchy + CRP customization + sharded/replicated read fleet →
    global multi-region with regional graph partitions and edge tile CDNs.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): route-engine node loss (stateless
    replicas from the graph store), stale/missing traffic feed (fall back to base/historical
    weights), graph/CH rebuild or bad map data (versioned graph, canary, rollback), map-matching
    failure on poor GPS (snap to nearest / degrade), tile CDN/origin issues (serve stale tiles),
    traffic-pipeline overload (sample/aggregate, shed load), region/zone outage (multi-region
    replicas).
16. **Trade-offs & Alternatives** — `DecisionRecord`: precomputed contraction hierarchy / CRP over
    an in-memory graph + GPS-probe traffic re-weighting + CDN tiles; axes: Dijkstra/A* vs
    precomputed hierarchies (CH vs CRP), accuracy/freshness vs query cost, vector vs raster tiles,
    monolithic global graph vs regional partitions.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared
`CapacityTable`.

### New, maps-specific
- `lib/maps-navigation-estimates.ts` — pure capacity calc with typed
  `MapsNavigationCapacityAssumptions` / `MapsNavigationCapacityResults`.
- `components/learning/maps-navigation-capacity.tsx` — wrapper over `CapacityTable`, registered
  as `MapsNavigationCapacity`.
- `components/diagrams/maps-navigation-architecture.tsx` — `MapsNavigationArchitecture`.
  `role="img"` + caption naming the contraction hierarchy, the in-memory graph, live-traffic
  re-weighting, and CDN tile delivery.
- `components/diagrams/maps-navigation-flows.tsx` — `RouteQuerySequence`, `MapMatchSequence`,
  `TrafficUpdateSequence`, `TileFetchSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `maps-navigation` entry (18 sections).
- `lib/curriculum.ts` — flip `maps-navigation` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/maps-navigation.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the thirteenth slug's MDX.

## Capacity Model (exact)

`lib/maps-navigation-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`,
`BYTES_PER_GB = 1e9`. Float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  nodes: 50_000_000,
  edges: 120_000_000,
  bytesPerEdge: 32,
  routeRequestsPerDay: 1_000_000_000,
  tilesPerRoute: 50,
  dijkstraSettledFraction: 0.5,
  chNodesPerQuery: 400,
}
```

Results (deterministic):
- `avgRouteQps` = 1,000,000,000 / 86,400 ≈ **11,574.07** /sec
- `avgTileQps` = avgRouteQps × 50 ≈ **578,703.70** /sec
- `graphSizeGb` = 120,000,000 × 32 / 1e9 = **3.84** GB
- `dijkstraNodesPerQuery` = 50,000,000 × 0.5 = **25,000,000** nodes settled
- `naiveSettlesPerSecBillions` = avgRouteQps × dijkstraNodesPerQuery / 1e9 ≈ **289.35** billion/sec
- `chSpeedup` = dijkstraNodesPerQuery / chNodesPerQuery = 25,000,000 / 400 = **62,500**×

Headline lesson: **route QPS is modest** (~**11.6k/sec** on average) but **naive per-query
Dijkstra is impossible** — settling ~**25 million** nodes per query is ~**289 billion**
node-settles per second across the fleet. **Precomputation collapses this**: a contraction
hierarchy answers a query by settling a few hundred nodes, a ~**62,500×** reduction, turning
routing into a millisecond in-memory lookup. The **routable graph fits in RAM** (~**3.84 GB** of
edges), so route engines are stateless replicas serving from memory, not a database per query.
And **tiles dominate request volume** (~**579k/sec**, ~50× routes) but are static and
CDN-cacheable, so they're a delivery problem the edge absorbs. The hard part is the *query-time
graph search*, which precomputation moves offline.

## Numerical & Terminology Invariants

- The road network is a **directed, weighted graph**: nodes = intersections, edges = road
  segments, weight = **travel time** (not raw distance), with one-way and turn restrictions.
- Naive **Dijkstra/A\*** are correct but settle too much of a continental graph per query;
  **precomputation** (contraction hierarchies / CRP) moves work offline so a query settles a few
  hundred nodes — a ~**62,500×** reduction in this model.
- A **contraction hierarchy** adds distance-preserving **shortcut** edges and answers queries with
  an "**upward**" bidirectional search; **CRP** separates expensive **metric-independent
  preprocessing** from cheap **metric customization** so changing **traffic** weights don't force
  a full rebuild.
- The routable graph is held **in memory** on stateless route-engine replicas (~few GB), not
  queried from a database per request.
- **Traffic** weights come from a firehose of **GPS probes** fused with **historical/predictive**
  models; freshness is **eventually consistent**. ETA accounts for predicted conditions when you
  *reach* a segment.
- **Map matching** snaps noisy GPS to the graph (often an **HMM**); **geocoding** maps addresses ↔
  coordinates. **Tiles** are a **z/x/y pyramid**, static and **CDN-cached**, and outnumber routes
  ~**50×**.

## Out of Scope

Turn-by-turn voice guidance and client UX, multi-modal/transit routing internals, the cartography
pipeline that produces tiles, satellite imagery, detailed re-routing mechanics, and any change to
other tutorials.
