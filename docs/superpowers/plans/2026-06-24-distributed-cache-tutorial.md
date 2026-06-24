# Distributed Cache Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the eighth complete curriculum tutorial — an Intermediate, partitioned-in-memory-data-plane walkthrough of a Distributed Cache: consistent hashing, eviction, replication/consistency, hot keys, cache stampede, and write policies — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first seven tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **consistent hashing**, **eviction**, **replication/consistency**, and the **hot-key + stampede** failure modes.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the seven existing tutorials.
- Invariants: keys are partitioned by **consistent hashing** (ring + **virtual nodes**), never `hash%N`, so churn moves a minimal slice; the cache is **bounded** and **evicts** (LRU/LFU/TTL), is **lossy/derived** state with the **backing store as source of truth**, and may be **slightly stale**; the signature failures are **hot keys** and **stampede**, mitigated by replication/near-cache and **request coalescing / single-flight + TTL jitter**; a high **hit ratio** is the cache's reason to exist.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register distributed-cache MDX
├── components/
│   ├── diagrams/
│   │   ├── distributed-cache-architecture.tsx           # NEW: HLD (client, cache router, cache nodes, replicas, backing store, membership)
│   │   └── cache-flows.tsx                               # NEW: hit / miss / node-rebalance / stampede sequences
│   └── learning/
│       └── distributed-cache-capacity.tsx               # NEW: wrapper over CapacityTable
├── content/tutorials/distributed-cache.mdx              # NEW: full tutorial content
├── lib/
│   ├── distributed-cache-estimates.ts                   # NEW: pure capacity calc
│   ├── tutorial-registry.ts                             # MODIFY: add distributed-cache entry (18 sections)
│   └── curriculum.ts                                    # MODIFY: flip distributed-cache to available
├── mdx-components.tsx                                   # MODIFY: register new components
├── tests/
│   ├── distributed-cache-estimates.test.ts              # NEW
│   ├── distributed-cache-content.test.ts                # NEW
│   ├── diagrams.test.tsx                                # MODIFY: distributed-cache diagram assertions
│   ├── tutorial-registry.test.ts                        # MODIFY: eight tutorials; CHANGE the "unregistered" slug away from distributed-cache
│   └── curriculum.test.ts                               # MODIFY: eight available problems (distributed-cache inserts at seq position 5)
└── e2e/pilot.spec.ts                                    # MODIFY: distributed-cache flow + count 18→17
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Distributed Cache capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/distributed-cache-estimates.ts`, `tests/distributed-cache-estimates.test.ts`, `components/learning/distributed-cache-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/distributed-cache-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateDistributedCacheCapacity } from "@/lib/distributed-cache-estimates";

describe("calculateDistributedCacheCapacity", () => {
  const result = calculateDistributedCacheCapacity({
    totalItems: 10_000_000_000,
    avgItemBytes: 1_000,
    cacheableFraction: 0.2,
    memoryPerNodeGb: 64,
    peakReadsPerSecond: 50_000_000,
    hitRatio: 0.95,
  });

  it("derives the total dataset size in TB", () => {
    expect(result.totalDatasetTb).toBe(10);
  });
  it("derives the cached working set in GB", () => {
    expect(result.workingSetGb).toBeCloseTo(2000, 5);
  });
  it("derives the number of cache nodes (rounded up)", () => {
    expect(result.nodesNeeded).toBe(32);
  });
  it("derives backing-store reads per second after the hit ratio", () => {
    expect(result.backingStoreReadsPerSecond).toBeCloseTo(2_500_000, 0);
  });
  it("derives per-node read throughput", () => {
    expect(result.readsPerNodePerSecond).toBe(1_562_500);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/distributed-cache-estimates.test.ts`.

**Step 3: Implement** `lib/distributed-cache-estimates.ts`:
```ts
const BYTES_PER_GB = 1_000_000_000;
const BYTES_PER_TB = 1_000_000_000_000;

export interface DistributedCacheCapacityAssumptions {
  /** Total distinct items in the backing store. */
  totalItems: number;
  /** Average serialized size of one item, in bytes. */
  avgItemBytes: number;
  /** Fraction of the dataset kept hot in cache (the working set). */
  cacheableFraction: number;
  /** RAM available for cache data per node, in GB. */
  memoryPerNodeGb: number;
  /** Peak read requests per second hitting the cache. */
  peakReadsPerSecond: number;
  /** Fraction of reads served from cache (0..1). */
  hitRatio: number;
}

export interface DistributedCacheCapacityResults {
  totalDatasetTb: number;
  workingSetGb: number;
  nodesNeeded: number;
  backingStoreReadsPerSecond: number;
  readsPerNodePerSecond: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a cache holds only a
 * fraction of the dataset (so eviction quality decides the hit ratio), node count comes
 * from memory, and a high hit ratio is the whole point — it shields the slow backing
 * store from the bulk of reads.
 */
export function calculateDistributedCacheCapacity(
  a: DistributedCacheCapacityAssumptions,
): DistributedCacheCapacityResults {
  const totalBytes = a.totalItems * a.avgItemBytes;
  const totalDatasetTb = totalBytes / BYTES_PER_TB;
  const workingSetGb = (totalBytes * a.cacheableFraction) / BYTES_PER_GB;
  const nodesNeeded = Math.ceil(workingSetGb / a.memoryPerNodeGb);
  const backingStoreReadsPerSecond = a.peakReadsPerSecond * (1 - a.hitRatio);
  const readsPerNodePerSecond = a.peakReadsPerSecond / nodesNeeded;

  return {
    totalDatasetTb,
    workingSetGb,
    nodesNeeded,
    backingStoreReadsPerSecond,
    readsPerNodePerSecond,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/distributed-cache-capacity.tsx`, mirroring
`components/learning/collaborative-doc-editor-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateDistributedCacheCapacity,
  type DistributedCacheCapacityAssumptions,
} from "@/lib/distributed-cache-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedCacheCapacity({
  assumptions,
}: {
  assumptions: DistributedCacheCapacityAssumptions;
}) {
  const r = calculateDistributedCacheCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Total items", value: fmt(assumptions.totalItems) },
    { label: "Avg item size", value: `${fmt(assumptions.avgItemBytes)} B` },
    { label: "Cacheable fraction", value: `${fmt(assumptions.cacheableFraction * 100)}%` },
    { label: "Memory / node", value: `${fmt(assumptions.memoryPerNodeGb)} GB` },
    { label: "Peak reads / sec", value: fmt(assumptions.peakReadsPerSecond) },
    { label: "Hit ratio", value: `${fmt(assumptions.hitRatio * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Total dataset", value: `${fmt(r.totalDatasetTb)} TB`, consequence: "The full keyspace — far larger than any single node, so the cache must be sharded." },
    { label: "Cached working set", value: `${fmt(r.workingSetGb)} GB`, consequence: "Only the hot fraction is kept; the cache is deliberately smaller than the data, so eviction quality decides the hit ratio." },
    { label: "Cache nodes needed", value: fmt(r.nodesNeeded), consequence: "Node count is set by memory to hold the working set — partition the keyspace across them with consistent hashing." },
    { label: "Backing-store reads / sec", value: fmt(r.backingStoreReadsPerSecond), consequence: "After a 95% hit ratio, only the miss fraction reaches the slow store — the cache's entire reason to exist." },
    { label: "Reads / node / sec", value: fmt(r.readsPerNodePerSecond), consequence: "Each node serves over a million reads a second — sub-ms in-memory access and hot-key spreading matter." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `DistributedCacheCapacity` in `mdx-components.tsx`.

**Step 7: Verify and commit**
```bash
npm test -- tests/distributed-cache-estimates.test.ts tests/collaborative-doc-editor-estimates.test.ts
npm run typecheck && npm run lint
git add lib/distributed-cache-estimates.ts tests/distributed-cache-estimates.test.ts components/learning/distributed-cache-capacity.tsx mdx-components.tsx
git commit -m "feat: add distributed cache capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/distributed-cache-architecture.tsx`'s sibling pattern in
`components/diagrams/collaborative-doc-editor-architecture.tsx` (HLD) and
`components/diagrams/collab-editor-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/distributed-cache-architecture.tsx`, `components/diagrams/cache-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { DistributedCacheArchitecture } from "@/components/diagrams/distributed-cache-architecture";
import {
  CacheHitSequence,
  CacheMissSequence,
  NodeRebalanceSequence,
  StampedeSequence,
} from "@/components/diagrams/cache-flows";

describe("DistributedCacheArchitecture", () => {
  it("exposes the distributed cache architecture to non-visual readers", () => {
    render(<DistributedCacheArchitecture />);
    expect(
      screen.getByRole("img", { name: /distributed cache architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/consistent hashing/i)).toBeInTheDocument();
  });
});

describe("cache flow sequences", () => {
  it("renders the hit, miss, rebalance, and stampede sequences", () => {
    render(<CacheHitSequence />);
    expect(screen.getByRole("img", { name: /hit/i })).toBeInTheDocument();
    render(<CacheMissSequence />);
    expect(screen.getByRole("img", { name: /miss/i })).toBeInTheDocument();
    render(<NodeRebalanceSequence />);
    expect(screen.getByRole("img", { name: /rebalance|ring|node|hash/i })).toBeInTheDocument();
    render(<StampedeSequence />);
    expect(screen.getByRole("img", { name: /stampede|herd|coalesc/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"consistent hashing"** in
the **caption only** (and NOT in the `DiagramFrame` title, which renders as an SVG
`<title>` that `getByText` also matches), and give nodes distinct labels (e.g. node "Cache
Router", caption text "…consistent hashing…"). Also ensure the hit/miss titles don't
accidentally contain the other keyword.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `distributed-cache-architecture.tsx` exporting
`DistributedCacheArchitecture`, following the `collaborative-doc-editor-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Client` (infra) → `Cache Router` (service) via `ingress` ("get / set key").
- `Cache Router` → three cache shards `Cache Node A/B/C` (cache) via `redirect` ("route by hash").
- `Cache Node A` → `Replica A` (cache) via `async` ("replicate").
- `Cache Router` (or a cache node) → `Backing Store` (store) via `create`/`redirect` ("load on miss").
- `Membership` (service) ↔ cache nodes via `control` or `muted` ("gossip / heartbeat").
- `title` contains "Distributed cache architecture"; `caption` names **consistent
  hashing**, **eviction**, **replication**, and **hot keys**, and explains the
  shard-by-hash + evict + replicate + miss-loads-from-store story in prose. (Per the
  gotcha, keep "consistent hashing" in the caption only; distinct node labels.)

**Step 4: Implement the flow sequences** `cache-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `collab-editor-flows.tsx`).
Each `title` contains the keyword the test matches; keep "hit" and "miss" out of each
other's titles:
- `CacheHitSequence` — title contains "hit" (e.g. "Sequence: cache hit — served from the owning shard"); actors Client, Cache Router, Cache Node; steps: GET key, router hashes to the owning node, node returns the value (sub-ms). Caption: a hit is one hop to the shard the key hashes to.
- `CacheMissSequence` — title contains "miss" (e.g. "Sequence: cache miss — read-through and populate"); actors Client, Cache Node, Backing Store; steps: GET key, node misses, load from backing store, populate the cache with a TTL, return. Caption: a miss reads through to the store and populates the cache so the next read hits.
- `NodeRebalanceSequence` — title contains "rebalance" (or "ring"/"node"/"hash"); actors Cache Router, Membership, Cache Nodes; steps: a node fails (membership detects), the ring reassigns only that node's key arc to the next node, other nodes' keys are untouched, affected keys reload on miss. Use `control` for the failure/reassign. Caption: consistent hashing moves only the failed node's slice of keys, not the whole keyspace.
- `StampedeSequence` — title contains "stampede" (or "herd"/"coalesc"); actors Clients (many), Cache Node, Backing Store; steps: a hot key expires, many concurrent GETs miss, the node coalesces them into a single backing-store load (single-flight), one load fills the cache, all waiters get the result. Caption: request coalescing collapses a thundering herd into one backing-store load; TTL jitter spreads expiries.

**Step 5: Register** all five in `mdx-components.tsx`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/distributed-cache-architecture.tsx components/diagrams/cache-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add distributed cache architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "seven tutorials" tests to
"eight".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/distributed-cache.mdx` (skeleton).

IMPORTANT: there are currently SEVEN available tutorials (url-shortener, rate-limiter, pastebin, notification-service, video-streaming, ticket-booking, collaborative-doc-editor). You add an EIGHTH. `distributed-cache` is **sequence 5**, so in the curriculum's available-by-sequence ordering it inserts **after notification-service (seq 4) and before video-streaming (seq 11)** — NOT at the end. Read each test file BEFORE editing to match its exact phrasing.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all EIGHT tutorials are registered and `distributed-cache` has 18 sections. **CRITICAL:** the "returns undefined for unregistered tutorials" test currently uses `getTutorial("distributed-cache")` — since distributed-cache is now registered, CHANGE that slug to a still-coming-soon one, e.g. `api-gateway`.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "collaborative-doc-editor"]` (distributed-cache is seq 5, so it goes in 5th, before video-streaming). Add an assertion that `getProblem("distributed-cache")?.title === "Distributed Cache"`.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `distributed-cache` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add:
```ts
"distributed-cache": {
  slug: "distributed-cache",
  title: "Design a Distributed Cache",
  description:
    "An interview-grade walkthrough of a sharded, replicated in-memory distributed cache: consistent hashing and virtual nodes, eviction policies, replication and tunable consistency, hot-key mitigation, cache stampede protection, write policies and invalidation, scaling, and failure modes.",
  difficulty: "Intermediate",
  readingMinutes: 34,
  concepts: ["Consistent hashing", "Eviction", "Replication", "Hot keys"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "consistent-hashing", label: "Consistent Hashing", depth: "advanced" },
    { id: "eviction-policies", label: "Eviction Policies", depth: "advanced" },
    { id: "replication-consistency", label: "Replication & Consistency", depth: "advanced" },
    { id: "hot-keys", label: "Hot Keys & Hotspots", depth: "advanced" },
    { id: "cache-stampede", label: "Cache Stampede", depth: "advanced" },
    { id: "write-policies", label: "Write Policies & Invalidation", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import DistributedCacheContent from "@/content/tutorials/distributed-cache.mdx";` and `"distributed-cache": DistributedCacheContent,` to the content map.

**Step 7:** Create `content/tutorials/distributed-cache.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/distributed-cache
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/distributed-cache.mdx
git commit -m "feat: register distributed cache tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus, orchestrator)

Replace the skeleton's first nine sections (framing → consistent hashing) with complete
content embedding the components from Tasks 1–2. Authored by the orchestrator. Per spec
section notes 1–9, in particular:
- `capacity-estimates` — `<DistributedCacheCapacity assumptions={{ totalItems: 10000000000, avgItemBytes: 1000, cacheableFraction: 0.2, memoryPerNodeGb: 64, peakReadsPerSecond: 50000000, hitRatio: 0.95 }} />` then read off the working-set / nodes / hit-ratio lessons.
- `entity-model` — `EntityModel name="CacheEntry"` + prose on the hash ring/node, replica set, backing store as source of truth.
- `api-design` — `ApiContract` for `GET /cache/{key}` and `PUT /cache/{key}` (+ DELETE note); note the client-library consistent-hash routing.
- `high-level-architecture` — `<DistributedCacheArchitecture />` + component prose.
- `detailed-flows` — `<CacheHitSequence />`, `<CacheMissSequence />`, `<NodeRebalanceSequence />`, `<StampedeSequence />` with prose.
- `consistent-hashing` — the centerpiece: hash%N catastrophe, the ring, virtual nodes; include a `<KnowledgeCheck>`.

End: `npm run build` compiles; `npm test` green. Commit `content: author distributed cache sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus, orchestrator)

Complete the tutorial (replication → FAQ) and add the structural content test. Per spec
notes 10–18, including a `TradeoffTable` for scaling stages, a `FailureMatrix` with ≥ 6
rows, a `DecisionRecord`, ≥ 6 `<KnowledgeCheck>` total (distributed through the deep-dive
sections too), and one `<Faq items={[...]} />` with ≥ 12 entries.

Then create `tests/distributed-cache-content.test.ts` (mirror `tests/collaborative-doc-editor-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<DistributedCacheCapacity`, `<DistributedCacheArchitecture`, and the four sequences `<CacheHitSequence`, `<CacheMissSequence`, `<NodeRebalanceSequence`, `<StampedeSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test -- tests/distributed-cache-content.test.ts` and `npm run build` pass.
Commit `content: complete distributed cache tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 17), and run
full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 18 to 17 (eight tutorials now available) and add:
```ts
test("learner can open the distributed cache tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-cache");
  await expect(
    page.getByRole("heading", { name: /design a distributed cache/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-cache#consistent-hashing");
  await expect(page.locator("#consistent-hashing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed cache architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Verify the actual current count in the file and decrement by one if it differs from 18.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify distributed cache tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/collaborative-doc-editor.mdx` and `notification-service.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — populate/load write), `redirect` (green — read / route / hit), `async` (violet dashed — replication), `control` (amber dashed — failure / rebalance / eviction), `muted` (telemetry dotted — gossip/heartbeat), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for the cache router and membership, `cache` for the cache nodes and replicas, `store` for the backing store.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "consistent hashing" in the caption only; distinct node labels; don't put it in the title).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/distributed-cache-estimates.test.ts`.
