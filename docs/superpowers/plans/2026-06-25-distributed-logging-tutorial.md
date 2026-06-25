# Distributed Logging Platform Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the eleventh complete curriculum tutorial — an Advanced, write-firehose/observability walkthrough of a Distributed Logging Platform: the ingestion pipeline and durable buffer, parsing/structure, indexing for search, storage tiers and retention, query/search, and cost/sampling/cardinality control — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first ten tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are the **durable buffer / firehose ingestion**, **index-only-hot**, **storage tiering**, and **cost/cardinality control**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the ten existing tutorials.
- Invariants: the platform is **write-heavy** (a **firehose**); a **durable buffer** (Kafka-style) decouples producers from processing so producers are **never backpressured**; delivery is **at-least-once** with **load shedding/sampling** under overload; logs are **immutable, time-ordered, append-only**, written once and rarely read (reads are **recency-biased**); **indexing is the cost driver** — an **inverted index** is built over **hot** data only (index-everything vs index-labels-only is the central trade), the cold archive is **unindexed**; storage is **tiered hot → warm → cold** with a **retention lifecycle**; cost is controlled by **sampling**, dropping noise, and **capping high cardinality**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register distributed-logging MDX
├── components/
│   ├── diagrams/
│   │   ├── distributed-logging-architecture.tsx         # NEW: HLD (services+agent, collector, buffer, indexer, hot/cold store, query, lifecycle)
│   │   └── logging-flows.tsx                             # NEW: ingest / index-build / search / retention-tier sequences
│   └── learning/
│       └── distributed-logging-capacity.tsx             # NEW: wrapper over CapacityTable
├── content/tutorials/distributed-logging.mdx           # NEW: full tutorial content
├── lib/
│   ├── distributed-logging-estimates.ts                 # NEW: pure capacity calc
│   ├── tutorial-registry.ts                             # MODIFY: add distributed-logging entry (18 sections)
│   └── curriculum.ts                                    # MODIFY: flip distributed-logging to available
├── mdx-components.tsx                                   # MODIFY: register new components
├── tests/
│   ├── distributed-logging-estimates.test.ts            # NEW
│   ├── distributed-logging-content.test.ts              # NEW
│   ├── diagrams.test.tsx                                # MODIFY: distributed-logging diagram assertions
│   ├── tutorial-registry.test.ts                        # MODIFY: eleven tutorials
│   └── curriculum.test.ts                               # MODIFY: eleven available problems (distributed-logging inserts at seq 20, mid-list)
└── e2e/pilot.spec.ts                                   # MODIFY: distributed-logging flow + coming-soon count 23→22
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Distributed Logging capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/distributed-logging-estimates.ts`, `tests/distributed-logging-estimates.test.ts`, `components/learning/distributed-logging-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/distributed-logging-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateDistributedLoggingCapacity } from "@/lib/distributed-logging-estimates";

describe("calculateDistributedLoggingCapacity", () => {
  const result = calculateDistributedLoggingCapacity({
    dailyLogEvents: 500_000_000_000,
    avgEventBytes: 500,
    peakFactor: 3,
    compressionRatio: 0.1,
    indexFraction: 0.3,
    hotRetentionDays: 7,
    coldRetentionDays: 365,
  });

  it("derives average events per second", () => {
    expect(result.avgEventsPerSecond).toBeCloseTo(5787037.04, 1);
  });
  it("derives peak events per second", () => {
    expect(result.peakEventsPerSecond).toBeCloseTo(17361111.11, 1);
  });
  it("derives daily raw volume in TB", () => {
    expect(result.dailyRawTb).toBe(250);
  });
  it("derives index storage over the hot window in TB", () => {
    expect(result.indexStorageTb).toBeCloseTo(525, 5);
  });
  it("derives cold-tier storage over the retention window in PB", () => {
    expect(result.coldStoragePb).toBeCloseTo(9.125, 3);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/distributed-logging-estimates.test.ts`.

**Step 3: Implement** `lib/distributed-logging-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const TB_PER_PB = 1000;

export interface DistributedLoggingCapacityAssumptions {
  /** Log events ingested per day. */
  dailyLogEvents: number;
  /** Average serialized size of one event, in bytes. */
  avgEventBytes: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Stored size as a fraction of raw after compression (0..1). */
  compressionRatio: number;
  /** Index size as a fraction of raw data indexed (0..1). */
  indexFraction: number;
  /** Days kept in the hot (indexed) tier. */
  hotRetentionDays: number;
  /** Days kept in the cold (archived) tier. */
  coldRetentionDays: number;
}

export interface DistributedLoggingCapacityResults {
  avgEventsPerSecond: number;
  peakEventsPerSecond: number;
  dailyRawTb: number;
  indexStorageTb: number;
  coldStoragePb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a logging platform is the most
 * write-heavy system in the curriculum (millions of events/sec, reads rare), indexing costs
 * more than the logs themselves (so index only hot data), and multi-year retention forces
 * cheap tiered object storage for the cold archive.
 */
export function calculateDistributedLoggingCapacity(
  a: DistributedLoggingCapacityAssumptions,
): DistributedLoggingCapacityResults {
  const avgEventsPerSecond = a.dailyLogEvents / SECONDS_PER_DAY;
  const peakEventsPerSecond = avgEventsPerSecond * a.peakFactor;
  const dailyRawTb = (a.dailyLogEvents * a.avgEventBytes) / BYTES_PER_TB;
  const indexStorageTb = dailyRawTb * a.indexFraction * a.hotRetentionDays;
  const coldStoragePb =
    (dailyRawTb * a.compressionRatio * a.coldRetentionDays) / TB_PER_PB;

  return {
    avgEventsPerSecond,
    peakEventsPerSecond,
    dailyRawTb,
    indexStorageTb,
    coldStoragePb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/distributed-logging-capacity.tsx`, mirroring
`components/learning/payment-system-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateDistributedLoggingCapacity,
  type DistributedLoggingCapacityAssumptions,
} from "@/lib/distributed-logging-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedLoggingCapacity({
  assumptions,
}: {
  assumptions: DistributedLoggingCapacityAssumptions;
}) {
  const r = calculateDistributedLoggingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily log events", value: fmt(assumptions.dailyLogEvents) },
    { label: "Avg event size", value: `${fmt(assumptions.avgEventBytes)} B` },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Compression", value: `${fmt(assumptions.compressionRatio * 100)}%` },
    { label: "Index fraction", value: `${fmt(assumptions.indexFraction * 100)}%` },
    { label: "Hot retention", value: `${fmt(assumptions.hotRetentionDays)} d` },
    { label: "Cold retention", value: `${fmt(assumptions.coldRetentionDays)} d` },
  ];

  const results: ResultRow[] = [
    { label: "Avg events / sec", value: fmt(r.avgEventsPerSecond), consequence: "A firehose of writes — the most write-heavy system in the curriculum; reads are rare by comparison." },
    { label: "Peak events / sec", value: fmt(r.peakEventsPerSecond), consequence: "Spikes are large, so a durable buffer must absorb them and never backpressure the producing services." },
    { label: "Daily raw volume", value: `${fmt(r.dailyRawTb)} TB`, consequence: "Enormous ingest — the pipeline, not query latency, is the design's center of gravity." },
    { label: "Index size (hot)", value: `${fmt(r.indexStorageTb)} TB`, consequence: "A full index over just the hot window costs more than the compressed logs — so index only hot data, or only labels." },
    { label: "Cold storage (1 yr)", value: `${fmt(r.coldStoragePb, 3)} PB`, consequence: "Even compressed 10×, a year of logs is petabytes — cold data lives in cheap, unindexed object storage." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `DistributedLoggingCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/distributed-logging-estimates.test.ts tests/payment-system-estimates.test.ts
npm run typecheck && npm run lint
git add lib/distributed-logging-estimates.ts tests/distributed-logging-estimates.test.ts components/learning/distributed-logging-capacity.tsx mdx-components.tsx
git commit -m "feat: add distributed logging capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/distributed-cache-architecture.tsx` (HLD) and
`components/diagrams/cache-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/distributed-logging-architecture.tsx`, `components/diagrams/logging-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { DistributedLoggingArchitecture } from "@/components/diagrams/distributed-logging-architecture";
import {
  LogIngestSequence,
  IndexBuildSequence,
  SearchQuerySequence,
  RetentionTierSequence,
} from "@/components/diagrams/logging-flows";

describe("DistributedLoggingArchitecture", () => {
  it("exposes the distributed logging architecture to non-visual readers", () => {
    render(<DistributedLoggingArchitecture />);
    expect(
      screen.getByRole("img", { name: /distributed logging architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/firehose/i)).toBeInTheDocument();
  });
});

describe("logging flow sequences", () => {
  it("renders the ingest, index-build, search, and retention sequences", () => {
    render(<LogIngestSequence />);
    expect(screen.getByRole("img", { name: /ingest/i })).toBeInTheDocument();
    render(<IndexBuildSequence />);
    expect(screen.getByRole("img", { name: /index/i })).toBeInTheDocument();
    render(<SearchQuerySequence />);
    expect(screen.getByRole("img", { name: /search/i })).toBeInTheDocument();
    render(<RetentionTierSequence />);
    expect(screen.getByRole("img", { name: /retention|tier/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"firehose"** in the
**caption only** (NOT in any node label and NOT in the `DiagramFrame` title). Also: all four
flow titles render into the same test DOM in one test, so each regex must match exactly one
title — use distinct, mutually exclusive title keywords ("ingest", "index", "search",
"retention"/"tier") and ensure NO title contains another flow's keyword (e.g. the word
"ingest" must not appear in the index/search/retention titles; "index" only in the
index-build title).

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `distributed-logging-architecture.tsx` exporting
`DistributedLoggingArchitecture`, following the `distributed-cache-architecture.tsx` pattern (a
`const N` node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`,
edges before nodes, a `Legend`). It must show:
- `Services + Agent` (infra, sublabel "log producers") → `Ingest Collector` (service, sublabel "receive + batch") via `ingress` ("ship logs").
- `Ingest Collector` → `Log Buffer` (queue, sublabel "durable (Kafka)") via `create` ("append").
- `Log Buffer` → `Indexer` (service, sublabel "parse + index") via `redirect` ("consume recent").
- `Log Buffer` → `Archiver` (service, sublabel "compress") via `redirect` ("consume archive").
- `Indexer` → `Hot Store` (store, sublabel "indexed / SSD") via `create` ("index + store").
- `Archiver` → `Cold Store` (store, sublabel "object storage") via `create` ("compress + store").
- `Hot Store` → `Cold Store` via `async` ("age out / tier down").
- `Query Service` (service, sublabel "search API") → `Hot Store` via `redirect` ("search recent") and `Query Service` → `Cold Store` via `muted` ("fetch archived (rare)").
- `title` contains "Distributed logging architecture"; `caption` names the durable buffer that
  decouples the write **firehose** from indexing (so producers are never backpressured),
  at-least-once delivery, indexing **only hot** data, and **tiering** hot→cold, in prose. (Per
  the gotcha, keep "firehose" in the caption only; distinct node labels.)
- Node kinds: `infra` for the services/agent, `service` for collector/indexer/archiver/query,
  `queue` for the buffer, `store` for the hot and cold stores.
- Suggested geometry (viewBox `0 0 880 500`): services {24,230}, collector {196,230},
  buffer {380,230}, indexer {560,120}, archiver {560,340}, hotStore {740,120}, coldStore
  {740,340}, queryService {380,420} — `w` ≈ 140, `h` ≈ 56 (store `h` ≈ 60). Adjust to avoid
  overlaps.

**Step 4: Implement the flow sequences** `logging-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `cache-flows.tsx` verbatim).
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive:
- `LogIngestSequence` — title contains "ingest" (e.g. "Sequence: log ingest — batch, ship, buffer"); actors Service + Agent, Ingest Collector, Log Buffer; steps: app emits log, agent batches and ships, collector validates/enriches, append to durable buffer, ack to agent. Caption: agents batch and ship; the collector writes to a durable buffer that decouples producers from the slow indexing path, so a spike never backpressures the apps (at-least-once).
- `IndexBuildSequence` — title contains "index" (e.g. "Sequence: index build — consume, parse, index"); actors Log Buffer, Indexer, Hot Store; steps: indexer consumes a batch from the buffer, parses fields, builds the inverted index, writes to the hot store, commits the consumer offset. Caption: the indexer consumes from the buffer at its own pace and indexes recent logs into the hot tier; committing the offset only after a durable write gives at-least-once.
- `SearchQuerySequence` — title contains "search" (e.g. "Sequence: search — time-bounded scatter-gather"); actors Query Service, Hot Store, Cold Store; steps: user query with a time range, query service prunes to relevant time segments, scatter to hot shards, gather + merge, fall back to cold store for old ranges. Caption: queries are time-bounded; recent ranges hit the indexed hot tier via scatter-gather, old ranges fall back to slow cold storage — and most queries are recent. Use `muted` for the cold fallback.
- `RetentionTierSequence` — title contains "retention" (e.g. "Sequence: retention — age hot data down to cold"); actors Hot Store, Lifecycle, Cold Store; steps: lifecycle policy detects data past the hot window, compress and copy to cold object storage, drop the index, delete from hot, expire past the retention limit. Caption: a lifecycle policy ages data from indexed hot storage to compressed cold object storage and finally deletes it past retention — tiering is what makes the cost sustainable. Use `control` for the expire/delete.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/distributed-logging-architecture.tsx components/diagrams/logging-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add distributed logging architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "ten tutorials" tests to "eleven".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/distributed-logging.mdx` (skeleton).

IMPORTANT: there are currently TEN available tutorials. You add an ELEVENTH. `distributed-logging` is **sequence 20**, so in the curriculum's available-by-sequence ordering it inserts **between `payment-system` (seq 18) and `collaborative-doc-editor` (seq 22)** — NOT at the end. Read each test file BEFORE editing to match its exact phrasing. Do NOT change the `getTutorial("api-gateway")` undefined test — api-gateway stays coming-soon.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all ELEVEN tutorials are registered. In the sorted `Object.keys(tutorials)` array, `"distributed-logging"` sorts between `"distributed-cache"` and `"notification-service"`. Add `expect(getTutorial("distributed-logging")?.sections).toHaveLength(18);`. Update the two descriptive `it(...)` strings to mention Distributed Logging. Leave the `getTutorial("api-gateway")` undefined test as-is.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive"]` (distributed-logging is seq 20, inserted after payment-system and before collaborative-doc-editor). Add `expect(getProblem("distributed-logging")?.title).toBe("Distributed Logging Platform");`. Update the descriptive `it(...)` string. NOTE: the count assertions in this file are now 33 (do not change those).

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `distributed-logging` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the sorted-keys test; keep it tidy, e.g. after the `payment-system` entry or at the end before `};`):
```ts
"distributed-logging": {
  slug: "distributed-logging",
  title: "Design a Distributed Logging Platform",
  description:
    "An interview-grade walkthrough of a distributed logging platform: the firehose ingestion pipeline and durable buffer, parsing and structured logs, indexing for search, storage tiers and retention, query and search over huge time ranges, cost and cardinality control, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Ingestion pipeline", "Indexing", "Search", "Retention"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "ingestion-pipeline", label: "Ingestion Pipeline & Buffering", depth: "advanced" },
    { id: "parsing-structure", label: "Parsing & Structured Logs", depth: "advanced" },
    { id: "indexing", label: "Indexing for Search", depth: "advanced" },
    { id: "storage-tiers", label: "Storage Tiers & Retention", depth: "advanced" },
    { id: "query-search", label: "Query & Search", depth: "advanced" },
    { id: "cost-cardinality", label: "Cost, Sampling & Cardinality", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import DistributedLoggingContent from "@/content/tutorials/distributed-logging.mdx";` and `"distributed-logging": DistributedLoggingContent,` to the content map.

**Step 7:** Create `content/tutorials/distributed-logging.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence. Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/distributed-logging
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/distributed-logging.mdx
git commit -m "feat: register distributed logging tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks
1–3, then installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have
registered the embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<DistributedLoggingCapacity assumptions={{ dailyLogEvents: 500000000000, avgEventBytes: 500, peakFactor: 3, compressionRatio: 0.1, indexFraction: 0.3, hotRetentionDays: 7, coldRetentionDays: 365 }} />` then read off the write-firehose / index-cost / tiering lessons.
- `entity-model` — `EntityModel name="LogEvent"` (timestamp, service, level, message, fields, trace_id) + prose on LogStream/source, Index (inverted), Segment/Shard (time-partitioned immutable), Tier.
- `api-design` — `ApiContract` for `POST /logs` (batched at-least-once ingest) and `GET /search` (time-bounded query), plus an agent-push note.
- `high-level-architecture` — `<DistributedLoggingArchitecture />` + component prose.
- `detailed-flows` — `<LogIngestSequence />`, `<IndexBuildSequence />`, `<SearchQuerySequence />`, `<RetentionTierSequence />` with prose.
- deep dives `ingestion-pipeline`, `parsing-structure`, `indexing`, `storage-tiers`, `query-search`, `cost-cardinality` per spec, with a `<KnowledgeCheck>` in ingestion-pipeline, indexing, storage-tiers, query-search, and cost-cardinality.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/distributed-logging-content.test.ts` (mirror `tests/payment-system-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<DistributedLoggingCapacity`, `<DistributedLoggingArchitecture`, and the four sequences `<LogIngestSequence`, `<IndexBuildSequence`, `<SearchQuerySequence`, `<RetentionTierSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with
real embeds and generates `/learn/distributed-logging`) all green. Commit `content: complete distributed logging tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 22), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 23 to 22 (eleven tutorials now available — verify the current value is 23 first) and add:
```ts
test("learner can open the distributed logging tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-logging");
  await expect(
    page.getByRole("heading", { name: /design a distributed logging platform/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-logging#indexing");
  await expect(page.locator("#indexing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed logging architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify distributed logging tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/payment-system.mdx` and `notification-service.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — write / append / store), `redirect` (green — consume / read / search), `async` (violet dashed — tier-down / age-out), `control` (amber dashed — expire / delete / shed), `muted` (telemetry dotted — cold fallback / rare read), `ingress` (plain — log shipping). Node kinds: `infra` for the services/agent, `service` for collector/indexer/archiver/query, `queue` for the durable buffer, `store` for the hot and cold stores.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "firehose" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "ingest"/"index"/"search"/"retention" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/distributed-logging-estimates.test.ts`.
- **distributed-logging is seq 20 — it inserts MID-LIST** (after payment-system, before collaborative-doc-editor) in the curriculum available-by-sequence ordering. Do NOT append it at the end. The curriculum total is 33 (unchanged); do not touch the 33 count assertions.
