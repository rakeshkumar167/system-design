# Maps and Navigation Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the thirteenth complete curriculum tutorial — an Advanced, geospatial
graph-routing walkthrough of **Maps and Navigation**: the road network as a directed weighted
graph, shortest-path routing and why it doesn't scale, precomputation / contraction hierarchies
(the centerpiece), map matching & geocoding, live traffic & ETA, and map-tile serving —
reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like
the first twelve tutorials. New work is a pure capacity module + wrapper, one architecture SVG
diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The
distinguishing themes are **precomputation (contraction hierarchies / CRP)**, the **in-memory
routable graph**, **live-traffic re-weighting from GPS probes**, **map matching/geocoding**, and
**CDN tile serving**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest
4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the twelve existing tutorials.
- Invariants: the road network is a **directed, weighted graph** (weight = travel time); naive **Dijkstra/A\*** settle too much of a continental graph per query, so **precomputation** (contraction hierarchies / CRP) moves work offline for a ~**62,500×** per-query reduction; a **contraction hierarchy** adds distance-preserving **shortcut** edges and answers queries with an "**upward**" bidirectional search; **CRP** splits **metric-independent preprocessing** from cheap **metric customization** so changing traffic doesn't force a rebuild; the routable graph is held **in memory** on stateless replicas (~few GB); **traffic** comes from **GPS probes** fused with **historical/predictive** models (eventually consistent); **map matching** (HMM) snaps GPS to the graph and **geocoding** maps addresses ↔ coordinates; **tiles** are a **z/x/y pyramid**, static and **CDN-cached**, outnumbering routes ~**50×**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                          # MODIFY: register maps-navigation MDX
├── components/
│   ├── diagrams/
│   │   ├── maps-navigation-architecture.tsx           # NEW: HLD (client, routing gateway, map-matcher/geocoder, route engine, graph/CH store, traffic pipeline, live-weights store, tile service, CDN)
│   │   └── maps-navigation-flows.tsx                   # NEW: route-query / map-match / traffic-update / tile-fetch sequences
│   └── learning/
│       └── maps-navigation-capacity.tsx               # NEW: wrapper over CapacityTable
├── content/tutorials/maps-navigation.mdx              # NEW: full tutorial content
├── lib/
│   ├── maps-navigation-estimates.ts                   # NEW: pure capacity calc
│   ├── tutorial-registry.ts                           # MODIFY: add maps-navigation entry (18 sections)
│   └── curriculum.ts                                  # MODIFY: flip maps-navigation to available
├── mdx-components.tsx                                 # MODIFY: register new components
├── tests/
│   ├── maps-navigation-estimates.test.ts              # NEW
│   ├── maps-navigation-content.test.ts                # NEW
│   ├── diagrams.test.tsx                              # MODIFY: maps diagram assertions
│   ├── tutorial-registry.test.ts                      # MODIFY: thirteen tutorials
│   └── curriculum.test.ts                             # MODIFY: thirteen available problems (maps-navigation inserts at seq 24, between cloud-drive and distributed-job-scheduler)
└── e2e/pilot.spec.ts                                  # MODIFY: maps flow + coming-soon count 21→20
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Maps and Navigation capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/maps-navigation-estimates.ts`, `tests/maps-navigation-estimates.test.ts`, `components/learning/maps-navigation-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/maps-navigation-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateMapsNavigationCapacity } from "@/lib/maps-navigation-estimates";

describe("calculateMapsNavigationCapacity", () => {
  const result = calculateMapsNavigationCapacity({
    nodes: 50_000_000,
    edges: 120_000_000,
    bytesPerEdge: 32,
    routeRequestsPerDay: 1_000_000_000,
    tilesPerRoute: 50,
    dijkstraSettledFraction: 0.5,
    chNodesPerQuery: 400,
  });

  it("derives average route QPS", () => {
    expect(result.avgRouteQps).toBeCloseTo(11574.07, 1);
  });
  it("derives average tile QPS (tiles dwarf routes)", () => {
    expect(result.avgTileQps).toBeCloseTo(578703.70, 1);
  });
  it("derives the in-RAM routable graph size in GB", () => {
    expect(result.graphSizeGb).toBe(3.84);
  });
  it("derives Dijkstra nodes settled per query", () => {
    expect(result.dijkstraNodesPerQuery).toBe(25_000_000);
  });
  it("derives naive settles per second in billions (the impossibility)", () => {
    expect(result.naiveSettlesPerSecBillions).toBeCloseTo(289.35, 1);
  });
  it("derives the contraction-hierarchy speed-up", () => {
    expect(result.chSpeedup).toBe(62_500);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/maps-navigation-estimates.test.ts`.

**Step 3: Implement** `lib/maps-navigation-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GB = 1_000_000_000;

export interface MapsNavigationCapacityAssumptions {
  /** Graph nodes (road intersections). */
  nodes: number;
  /** Directed graph edges (road segments). */
  edges: number;
  /** Bytes to store one directed edge (endpoints + weight + adjacency). */
  bytesPerEdge: number;
  /** Route (navigation) requests per day. */
  routeRequestsPerDay: number;
  /** Map tiles fetched per route request (the map view around a route). */
  tilesPerRoute: number;
  /** Fraction of graph nodes a plain Dijkstra settles per query (~half). */
  dijkstraSettledFraction: number;
  /** Nodes a contraction-hierarchy query settles (a few hundred). */
  chNodesPerQuery: number;
}

export interface MapsNavigationCapacityResults {
  avgRouteQps: number;
  avgTileQps: number;
  graphSizeGb: number;
  dijkstraNodesPerQuery: number;
  naiveSettlesPerSecBillions: number;
  chSpeedup: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: route QPS is modest, but naive
 * per-query Dijkstra settles ~half a continental graph — ~hundreds of billions of node-settles
 * per second across the fleet, which is impossible — so a precomputed contraction hierarchy
 * collapses per-query work ~62,500×, turning routing into a millisecond in-memory lookup; the
 * routable graph fits in RAM (a few GB); and tiles dominate request volume (~50× routes) but are
 * static and CDN-cacheable.
 */
export function calculateMapsNavigationCapacity(
  a: MapsNavigationCapacityAssumptions,
): MapsNavigationCapacityResults {
  const avgRouteQps = a.routeRequestsPerDay / SECONDS_PER_DAY;
  const avgTileQps = avgRouteQps * a.tilesPerRoute;
  const graphSizeGb = (a.edges * a.bytesPerEdge) / BYTES_PER_GB;
  const dijkstraNodesPerQuery = a.nodes * a.dijkstraSettledFraction;
  const naiveSettlesPerSecBillions =
    (avgRouteQps * dijkstraNodesPerQuery) / 1_000_000_000;
  const chSpeedup = dijkstraNodesPerQuery / a.chNodesPerQuery;

  return {
    avgRouteQps,
    avgTileQps,
    graphSizeGb,
    dijkstraNodesPerQuery,
    naiveSettlesPerSecBillions,
    chSpeedup,
  };
}
```

**Step 4: Run to verify it passes** (6 tests).

**Step 5: Create the wrapper** `components/learning/maps-navigation-capacity.tsx`, mirroring
`components/learning/distributed-job-scheduler-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateMapsNavigationCapacity,
  type MapsNavigationCapacityAssumptions,
} from "@/lib/maps-navigation-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function MapsNavigationCapacity({
  assumptions,
}: {
  assumptions: MapsNavigationCapacityAssumptions;
}) {
  const r = calculateMapsNavigationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Graph nodes", value: fmt(assumptions.nodes) },
    { label: "Graph edges", value: fmt(assumptions.edges) },
    { label: "Bytes / edge", value: `${fmt(assumptions.bytesPerEdge)} B` },
    { label: "Route requests / day", value: fmt(assumptions.routeRequestsPerDay) },
    { label: "Tiles / route", value: fmt(assumptions.tilesPerRoute) },
    { label: "Dijkstra settled fraction", value: `${fmt(assumptions.dijkstraSettledFraction * 100)}%` },
    { label: "CH nodes / query", value: fmt(assumptions.chNodesPerQuery) },
  ];

  const results: ResultRow[] = [
    { label: "Avg route QPS", value: fmt(r.avgRouteQps), consequence: "The steady-state navigation rate is modest — the difficulty is the per-query cost, not the request rate." },
    { label: "Avg tile QPS", value: fmt(r.avgTileQps), consequence: "Tiles outnumber routes ~50×, but they're static and CDN-cacheable — a delivery problem the edge absorbs, not a compute one." },
    { label: "Graph size (in RAM)", value: `${fmt(r.graphSizeGb, 2)} GB`, consequence: "The routable graph fits in memory, so route engines are stateless replicas serving from RAM — not a database queried per request." },
    { label: "Dijkstra nodes / query", value: fmt(r.dijkstraNodesPerQuery), consequence: "Plain Dijkstra settles ~half the continental graph for a single route — far too much work per query." },
    { label: "Naive settles / sec", value: `${fmt(r.naiveSettlesPerSecBillions, 2)} billion`, consequence: "Across the fleet that's hundreds of billions of node-settles per second — naive per-query routing is physically impossible." },
    { label: "Contraction-hierarchy speed-up", value: `${fmt(r.chSpeedup)}×`, consequence: "Precomputation cuts per-query work from 25M settles to a few hundred — routing becomes a millisecond in-memory lookup." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `MapsNavigationCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/maps-navigation-estimates.test.ts tests/distributed-job-scheduler-estimates.test.ts
npm run typecheck && npm run lint
git add lib/maps-navigation-estimates.ts tests/maps-navigation-estimates.test.ts components/learning/maps-navigation-capacity.tsx mdx-components.tsx
git commit -m "feat: add maps and navigation capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/distributed-job-scheduler-architecture.tsx` (HLD) and
`components/diagrams/job-scheduler-flows.tsx` (sequences) — do not invent new SVG conventions.
Copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `job-scheduler-flows.tsx` verbatim.

**Files:** Create `components/diagrams/maps-navigation-architecture.tsx`, `components/diagrams/maps-navigation-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { MapsNavigationArchitecture } from "@/components/diagrams/maps-navigation-architecture";
import {
  RouteQuerySequence,
  MapMatchSequence,
  TrafficUpdateSequence,
  TileFetchSequence,
} from "@/components/diagrams/maps-navigation-flows";

describe("MapsNavigationArchitecture", () => {
  it("exposes the maps and navigation architecture to non-visual readers", () => {
    render(<MapsNavigationArchitecture />);
    expect(
      screen.getByRole("img", { name: /maps (and )?navigation architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/contraction hierarch/i)).toBeInTheDocument();
  });
});

describe("maps and navigation flow sequences", () => {
  it("renders the route, map-match, traffic, and tile sequences", () => {
    render(<RouteQuerySequence />);
    expect(screen.getByRole("img", { name: /route/i })).toBeInTheDocument();
    render(<MapMatchSequence />);
    expect(screen.getByRole("img", { name: /match/i })).toBeInTheDocument();
    render(<TrafficUpdateSequence />);
    expect(screen.getByRole("img", { name: /traffic/i })).toBeInTheDocument();
    render(<TileFetchSequence />);
    expect(screen.getByRole("img", { name: /tile/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"contraction hierarchies"** in
the **caption only** (NOT in any node label and NOT in the `DiagramFrame` title). A node sublabel
may say "in-memory CH" — that does NOT match `/contraction hierarch/i`, so it's safe. Also: all
four flow titles render into the same test DOM in one test, so each regex must match exactly one
title — use distinct, mutually exclusive title keywords **"route" / "match" / "traffic" / "tile"**
and ensure NO title contains another flow's keyword (e.g. the route title must not contain
"tile"; the map-match title must not contain "route").

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `maps-navigation-architecture.tsx` exporting
`MapsNavigationArchitecture`, following the `distributed-job-scheduler-architecture.tsx` pattern (a
`const N` node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`,
edges before nodes, a `Legend`). It must show:
- `Client` (infra, sublabel "navigate / view map") → `Routing Gateway` (service, sublabel "API edge") via `ingress` ("GET /route").
- `Routing Gateway` → `Map Matcher` (service, sublabel "snap + geocode") via `create` ("snap origin/dest").
- `Map Matcher` → `Route Engine` (service, sublabel "in-memory CH") via `create` ("query path").
- `Graph / CH Store` (store, sublabel "graph + shortcuts") → `Route Engine` via `redirect` ("load graph") — the engine loads the precomputed graph into RAM.
- `Route Engine` → `Routing Gateway` via `redirect` ("path + ETA") (reply).
- `Probes` (external, sublabel "GPS pings") → `Traffic Pipeline` (queue, sublabel "aggregate") via `async` ("probe stream").
- `Traffic Pipeline` → `Live Weights` (store, sublabel "edge times") via `create` ("update weights").
- `Live Weights` → `Route Engine` via `control` ("re-customize") — CRP metric customization feeds new weights into the engine.
- `Client` → `CDN` (external, sublabel "edge cache") via `ingress` ("GET tile z/x/y").
- `CDN` → `Tile Service` (service, sublabel "z/x/y pyramid") via `redirect` ("miss → origin").
- `title` contains "Maps and Navigation architecture"; `caption` names the **contraction
  hierarchies** precomputation, the **in-memory** routable graph, **live-traffic re-weighting**
  from **GPS probes**, and **CDN tile** delivery, in prose. (Per the gotcha, keep "contraction
  hierarchies" in the caption only; distinct node labels.)
- Node kinds: `infra` for the client; `service` for the routing gateway, map matcher, route
  engine, tile service; `store` for the graph/CH store and live-weights store; `queue` for the
  traffic pipeline; `external` for the GPS probes and the CDN.
- Suggested geometry (viewBox `0 0 960 520`): lay routing left→right across the middle
  (client {24,232}, routingGateway {196,232}, mapMatcher {372,232}, routeEngine {560,232}),
  graphStore above the route engine ({560,90}), the traffic path along the bottom
  (probes {24,392}, trafficPipeline {196,392}, liveWeights {372,392}), and the tile path
  top-right (cdn {760,232}, tileService {760,90}). `w` ≈ 150, `h` ≈ 56 (store `h` ≈ 60). Adjust
  to avoid overlaps; keep the viewBox ≥ the rightmost/bottom-most node.

**Step 4: Implement the flow sequences** `maps-navigation-flows.tsx`, exporting four components.
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive
("route" / "match" / "traffic" / "tile"):
- `RouteQuerySequence` — title contains "route" (e.g. "Sequence: answer a route query"); actors Client, Map Matcher, Route Engine, Graph Store; steps: client requests a route between two coordinates, the matcher snaps origin/destination to the nearest graph nodes, the route engine runs a bidirectional upward search on the in-memory hierarchy, reads shortcuts from the graph, returns the path + ETA. Caption: a route is a bidirectional "upward" search over the precomputed hierarchy held in memory — a few hundred nodes settled, answered in milliseconds. (Do NOT use the word "tile" or "match" as a standalone title keyword here.)
- `MapMatchSequence` — title contains "match" (e.g. "Sequence: map-match a GPS trace"); actors Device, Map Matcher, Graph Store; steps: device sends a noisy GPS trace, the matcher fetches candidate nearby segments, runs an HMM balancing GPS proximity vs route plausibility, returns the snapped road path. Caption: map matching snaps jittery GPS points onto the most likely road path with a hidden Markov model, reconciling GPS noise against what roads actually connect.
- `TrafficUpdateSequence` — title contains "traffic" (e.g. "Sequence: ingest traffic and re-weight"); actors Probes, Traffic Pipeline, Live Weights, Route Engine; steps: probes stream GPS pings, the pipeline aggregates per segment and fuses with historical patterns, writes updated live edge times, the route engine re-customizes the hierarchy (CRP metric customization) with the new weights. Caption: a firehose of GPS probes is aggregated into live edge weights and applied via cheap CRP metric customization, so the hierarchy reflects current traffic without a full rebuild.
- `TileFetchSequence` — title contains "tile" (e.g. "Sequence: fetch a map tile"); actors Client, CDN, Tile Service; steps: client requests a z/x/y tile, on a CDN hit it returns immediately, on a miss the CDN fetches from the tile service, which returns the rendered tile and the CDN caches it. Caption: map tiles are a static z/x/y pyramid served from the CDN edge; only cache misses reach the origin tile service, so tiles scale as a caching problem. Use `redirect` for cache hits and `control`/`async` as appropriate for the miss path.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/maps-navigation-architecture.tsx components/diagrams/maps-navigation-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add maps and navigation architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton
with all 18 section ids, and update the two existing "twelve tutorials" tests to "thirteen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/maps-navigation.mdx` (skeleton).

IMPORTANT: there are currently TWELVE available tutorials. You add a THIRTEENTH. `maps-navigation`
is **sequence 24**, which sits **between `cloud-drive` (seq 23) and `distributed-job-scheduler`
(seq 30)** in the curriculum's available-by-sequence ordering — so it **inserts in the middle**,
not at the end. Read each test file BEFORE editing to match its exact phrasing. Do NOT change the
`getTutorial("api-gateway")` undefined test — api-gateway stays coming-soon. The curriculum total
is 33 — do NOT change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all THIRTEEN tutorials are registered. In
the sorted `Object.keys(tutorials)` array, `"maps-navigation"` sorts between `"distributed-logging"`
and `"notification-service"`. The new sorted array is:
`["cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "notification-service", "pastebin", "payment-system", "rate-limiter", "ticket-booking", "url-shortener", "video-streaming"]`.
Add `expect(getTutorial("maps-navigation")?.sections).toHaveLength(18);` to the section-length test.
Update the two descriptive `it(...)` strings to mention Maps and Navigation. Leave the
`getTutorial("api-gateway")` undefined test as-is.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(maps-navigation is seq 24 — it goes AFTER cloud-drive and BEFORE distributed-job-scheduler).
Add `expect(getProblem("maps-navigation")?.title).toBe("Maps and Navigation");`. Update the
descriptive `it(...)` string. Do NOT touch the 33 count/sequence assertions.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `maps-navigation` entry `status` from `"coming-soon"`
to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"maps-navigation": {
  slug: "maps-navigation",
  title: "Design Maps and Navigation",
  description:
    "An interview-grade walkthrough of a maps and navigation service: the road network as a directed weighted graph, why Dijkstra and A* don't scale, precomputation with contraction hierarchies and customizable route planning, map matching and geocoding, live traffic and ETA from GPS probes, CDN map-tile serving, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Graph routing", "Geospatial indexing", "Traffic modeling", "Precomputation"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "road-graph", label: "The Road Network as a Graph", depth: "advanced" },
    { id: "shortest-path", label: "Shortest-Path Routing", depth: "advanced" },
    { id: "precomputation", label: "Precomputation & Hierarchies", depth: "advanced" },
    { id: "map-matching", label: "Map Matching & Geocoding", depth: "advanced" },
    { id: "traffic-eta", label: "Live Traffic & ETA", depth: "advanced" },
    { id: "tile-serving", label: "Map Tile Serving", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import MapsNavigationContent from "@/content/tutorials/maps-navigation.mdx";` and `"maps-navigation": MapsNavigationContent,` to the content map.

**Step 7:** Create `content/tutorials/maps-navigation.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/maps-navigation
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/maps-navigation.mdx
git commit -m "feat: register maps and navigation tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3,
then installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered
the embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<MapsNavigationCapacity assumptions={{ nodes: 50000000, edges: 120000000, bytesPerEdge: 32, routeRequestsPerDay: 1000000000, tilesPerRoute: 50, dijkstraSettledFraction: 0.5, chNodesPerQuery: 400 }} />` then read off the impossible-naive-Dijkstra / precomputation-collapses-it / graph-fits-in-RAM / tiles-dominate lessons.
- `entity-model` — `EntityModel name="RoadSegment"` (segment_id, from_node, to_node, length_m, base_time_sec, road_class, restrictions, live_time_sec) + prose on Node/intersection, the adjacency graph, base vs live weight, the precomputed contraction hierarchy/shortcuts, and tiles.
- `api-design` — `ApiContract` for `GET /route`, `GET /geocode`, `GET /tiles/{z}/{x}/{y}`.
- `high-level-architecture` — `<MapsNavigationArchitecture />` + component prose.
- `detailed-flows` — `<RouteQuerySequence />`, `<MapMatchSequence />`, `<TrafficUpdateSequence />`, `<TileFetchSequence />` with prose.
- deep dives `road-graph`, `shortest-path`, `precomputation`, `map-matching`, `traffic-eta`, `tile-serving` per spec, with a `<KnowledgeCheck>` in road-graph, shortest-path, precomputation, map-matching, and traffic-eta.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/maps-navigation-content.test.ts` (mirror `tests/distributed-job-scheduler-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<MapsNavigationCapacity`, `<MapsNavigationArchitecture`, and the four sequences `<RouteQuerySequence`, `<MapMatchSequence`, `<TrafficUpdateSequence`, `<TileFetchSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real
embeds and generates `/learn/maps-navigation`) all green. Commit `content: complete maps and navigation tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 20), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 21 to 20 (thirteen
tutorials now available — verify the current value is 21 first) and add:
```ts
test("learner can open the maps and navigation tutorial", async ({ page }) => {
  await page.goto("/learn/maps-navigation");
  await expect(
    page.getByRole("heading", { name: /design maps and navigation/i }),
  ).toBeVisible();
  await page.goto("/learn/maps-navigation#precomputation");
  await expect(page.locator("#precomputation")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /maps (and )?navigation architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile
TOC link issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify maps and navigation tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/distributed-job-scheduler.mdx` and `video-streaming.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — snap / query / write weights), `redirect` (green — load graph / path+ETA / cache hit), `async` (violet dashed — probe stream), `control` (amber dashed — re-customize / cache miss), `muted` (telemetry dotted), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for routing gateway/map matcher/route engine/tile service, `store` for the graph/CH store and live-weights store, `queue` for the traffic pipeline, `external` for GPS probes and the CDN.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "contraction hierarchies" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "route"/"match"/"traffic"/"tile" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/maps-navigation-estimates.test.ts`.
- **maps-navigation is seq 24 — it INSERTS in the middle** of the curriculum available-by-sequence ordering (after cloud-drive seq 23, before distributed-job-scheduler seq 30). The curriculum total is 33 (unchanged); do not touch the 33 count assertions.
```
