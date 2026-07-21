# Unique ID Generator Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Mirror the
> `content-delivery-network` / `ride-hailing` tutorial files for structure and voice.

**Goal:** Author the **Unique ID Generator** tutorial at `/learn/unique-id-generator` (curriculum seq 27,
**Intermediate**), reusing the tutorial pipeline.

## Global Constraints

- Slug `unique-id-generator`, difficulty **Intermediate**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test
  `requiredIds`.
- New export names — **all verified unused**: `SnowflakeCapacity`, `SnowflakeArchitecture`,
  `GenerateIdSequence`, `WorkerIdAssignmentSequence`, `ClockSkewSequence`, `SequenceOverflowSequence`.
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only**.
- E2e: direct fragment navigation; assert the diagram `img` and add `scrollIntoViewIfNeeded()` before
  `toBeInViewport()`; run `--workers=1`. **Decrement "coming soon" count (9 → 8)**. Leave "showing 1 of 33"
  untouched.
- **`tests/tutorial-registry.test.ts` "returns undefined" slug stays `food-delivery`** (untouched). But you
  **must add `"unique-id-generator"` to the `Object.keys(tutorials).sort()` assertion** (that test lists
  every registered slug — it will otherwise fail once the new key exists).
- **`tests/curriculum.test.ts`: insert `"unique-id-generator"` after `"maps-navigation"`, before
  `"distributed-job-scheduler"`** in the available-slugs list (seq 27, matching definition order).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge
  unless asked.

---

### Task 1: Capacity model — `SnowflakeCapacity`

**Files:** create `lib/unique-id-generator-estimates.ts`, `tests/unique-id-generator-estimates.test.ts`,
`components/learning/unique-id-generator-capacity.tsx`; modify `mdx-components.tsx`.

**`lib/unique-id-generator-estimates.ts`** (copy-paste):
```ts
const MS_PER_YEAR = 365 * 86_400 * 1_000;

export interface SnowflakeCapacityAssumptions {
  /** Bits allocated to the timestamp (ms since a custom epoch). */
  timeBits: number;
  /** Bits allocated to the machine / worker id. */
  machineBits: number;
  /** Bits allocated to the per-millisecond sequence counter. */
  sequenceBits: number;
  /** A demanding target ID-generation rate to size against. */
  peakIdsPerSec: number;
}

export interface SnowflakeCapacityResults {
  totalBits: number;
  idsPerMsPerNode: number;
  idsPerSecPerNode: number;
  maxNodes: number;
  maxIdsPerSec: number;
  lifespanYears: number;
  nodesForPeakDemand: number;
}

/**
 * Pure, deterministic capacity model. The lesson: for a unique-ID generator, throughput is a non-problem
 * and the real budget is bits. One node mints 4,096,000 IDs/sec locally (12 sequence bits -> 4,096 per ms,
 * x1000 ms) with no network call and no coordination, so even a 1,000,000 IDs/sec workload needs a single
 * machine. The fixed 64 bits split into 41 time (~69.7-year lifespan), 10 machine (1,024 nodes), and 12
 * sequence (4,096 IDs/ms/node); filling all nodes gives ~4.19 billion IDs/sec. You don't scale for
 * throughput -- you budget bits for lifespan, node count, and per-node rate, and spend engineering on
 * clock and machine-id correctness.
 */
export function calculateSnowflakeCapacity(
  a: SnowflakeCapacityAssumptions,
): SnowflakeCapacityResults {
  const totalBits = 1 + a.timeBits + a.machineBits + a.sequenceBits;
  const idsPerMsPerNode = Math.pow(2, a.sequenceBits);
  const idsPerSecPerNode = idsPerMsPerNode * 1000;
  const maxNodes = Math.pow(2, a.machineBits);
  const maxIdsPerSec = idsPerSecPerNode * maxNodes;
  const lifespanYears = Math.pow(2, a.timeBits) / MS_PER_YEAR;
  const nodesForPeakDemand = Math.ceil(a.peakIdsPerSec / idsPerSecPerNode);

  return {
    totalBits,
    idsPerMsPerNode,
    idsPerSecPerNode,
    maxNodes,
    maxIdsPerSec,
    lifespanYears,
    nodesForPeakDemand,
  };
}
```

**`tests/unique-id-generator-estimates.test.ts`**: with `{ timeBits: 41, machineBits: 10, sequenceBits: 12,
peakIdsPerSec: 1_000_000 }` assert `totalBits` 64, `idsPerMsPerNode` 4096, `idsPerSecPerNode` 4_096_000,
`maxNodes` 1024, `maxIdsPerSec` 4_194_304_000, `lifespanYears` `toBeCloseTo(69.73, 2)`, `nodesForPeakDemand`
1.

**`components/learning/unique-id-generator-capacity.tsx`** — mirror `content-delivery-network-capacity.tsx`;
export `SnowflakeCapacity`. Assumption rows: Timestamp bits (`41`), Machine-id bits (`10`), Sequence bits
(`12`), Peak demand (`${peakIdsPerSec} /s`). Result rows (use the `fmt` helper; ~7 rows):
- Total bits — `64` — "1 sign + 41 time + 10 machine + 12 sequence — one signed 64-bit integer."
- IDs / ms / node — `4,096` — "12 sequence bits: 4,096 distinct IDs per millisecond per node."
- IDs / sec / node — `4,096,000 /s` — "One node, minted locally with no network call or coordination."
- Max nodes — `1,024` — "10 machine bits cap the fleet at 1,024 distinct machine ids."
- Max IDs / sec (full fleet) — `4,194,304,000 /s` — "All 1,024 nodes at once — ~4.19 billion/sec, far beyond any real need."
- Lifespan — `~69.7 years` — "41 time bits of milliseconds from a custom epoch before the clock wraps." (format `lifespanYears` to 1 decimal)
- Nodes for peak demand — `1` — "Even 1,000,000 IDs/sec fits on a single node — throughput is a non-problem; the budget is bits."

Register `SnowflakeCapacity` in `mdx-components.tsx` (import + map entry, mirroring `CdnCapacity`).

- [ ] `npm test -- unique-id-generator-estimates` + `npm run typecheck` green. Commit
  `feat: add Unique ID Generator capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/unique-id-generator-architecture.tsx` +
`unique-id-generator-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `SnowflakeArchitecture` HLD — mirror `content-delivery-network-architecture.tsx` /
  `ride-hailing-architecture.tsx`. Convey **decentralized generation with no shared hot-path component**:
  a `Client` (external) calling into a fleet of independent **ID Node** generators (three `service` nodes,
  each labelled with a distinct machine id, e.g. "ID Node · m=0/1/2"); a **Coordinator** "ZooKeeper / etcd"
  (`store` or `infra`) that assigns machine ids **at startup only**; and a **Clock / NTP** (`external` or
  `infra`) feeding the wall-clock input. Edges: Client→each ID Node `ingress` "get id" (or one
  representative node with the others shown as a fleet); Coordinator→each node `control` (dashed) "assign
  machine id (startup)"; Clock→nodes `muted` "wall clock (ms)". Use section labels like "HOT PATH · no
  coordination" over the nodes and "STARTUP · once" near the coordinator. Legend for the variants used.
  Caption (asserted keyword **caption-only**): explain that each node mints IDs locally from its machine id
  + clock + counter with nothing shared on the hot path, and the coordinator is touched only once at
  startup to hand out a distinct machine id.
- [ ] Four flow sequences (copy the `Sequence`/`StepLabel`/`actorColor` helpers verbatim from
  `content-delivery-network-flows.tsx`):
  - `GenerateIdSequence` — actors: `Client` (external), `Node` "ID Node" (service). Steps: Client→Node "get
    id" `ingress`; Node→Node "read current ms" `control`; Node→Node "same ms? seq++ : seq=0" `control`;
    Node→Node "compose time | machine | seq (64-bit)" `create`; Node→Client "id (as string)" `redirect`
    reply. Caption keyword-only: each node mints an ID locally with no coordination by packing time, a
    machine id, and a per-millisecond counter into 64 bits.
  - `WorkerIdAssignmentSequence` — actors: `Node` "ID Node" (service), `Coord` "ZooKeeper / etcd" (store).
    Steps: Node→Coord "register (startup)" `ingress`; Coord→Coord "claim next free id (ephemeral seq)"
    `control`; Coord→Node "machine id = 7" `create` reply; Node→Node "begin minting locally" `redirect`.
    Caption keyword-only: at startup a node claims a unique machine id from the coordinator so no two nodes
    share the machine-id bits.
  - `ClockSkewSequence` — actors: `Client` (external), `Node` "ID Node" (service). Steps: Client→Node "get
    id" `ingress`; Node→Node "current ms < last ms (clock went back)" `control`; Node→Node "wait until
    clock catches up" `control`; Node→Client "id (never a reused timestamp)" `redirect` reply. Caption
    keyword-only: if the clock moves backwards the node waits rather than re-minting a used timestamp, so it
    never produces a duplicate ID.
  - `SequenceOverflowSequence` — actors: `Client` (external), `Node` "ID Node" (service). Steps:
    Client→Node "get id (4,096th this ms)" `ingress`; Node→Node "sequence exhausted for this ms" `control`;
    Node→Node "wait for next ms tick; reset seq=0" `control`; Node→Client "id (next ms)" `redirect` reply.
    Caption keyword-only: when the per-millisecond counter overflows the node waits for the next
    millisecond, capping per-node throughput and keeping every ID unique.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows) — mirror the CDN
  block; assert each `getByRole("img")` name and one caption-only keyword via `getByText(/…/)`.
- [ ] Register all 5 exports in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` + `npm run typecheck` green. Commit
  `feat: add Unique ID Generator architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`,
`tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create
`content/tutorials/unique-id-generator.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add a `"unique-id-generator"` `TutorialMeta` (title "Design a Unique ID
  Generator", difficulty "Intermediate", readingMinutes ~30, concepts `["Snowflake IDs", "Clock skew",
  "Monotonicity", "Partitioning"]`, one-liner description, **18 sections** exactly per the spec outline).
- [ ] `curriculum.ts`: flip `unique-id-generator` `status` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: `import UniqueIdGeneratorContent from
  "@/content/tutorials/unique-id-generator.mdx";` and add `"unique-id-generator": UniqueIdGeneratorContent,`
  to the map.
- [ ] `content/tutorials/unique-id-generator.mdx`: skeleton — the 18 `<h2 id="…">` headings in order with
  one placeholder line each.
- [ ] `tests/tutorial-registry.test.ts`: add
  `expect(getTutorial("unique-id-generator")?.sections).toHaveLength(18);` **and** add
  `"unique-id-generator"` to the `Object.keys(tutorials).sort()` expected array (keep it sorted). Do NOT
  change the `returns undefined` slug (`food-delivery`).
- [ ] `tests/curriculum.test.ts`: insert `"unique-id-generator"` **after `"maps-navigation"`, before
  `"distributed-job-scheduler"`** in the `toEqual([...])` array.
- [ ] `npm test -- tutorial-registry curriculum` + `npm run typecheck` + `npm run build` green. Commit
  `feat: register Unique ID Generator tutorial route and skeleton`.

### Task 4 + 5: Content (Opus orchestrator)

**Files:** rewrite `content/tutorials/unique-id-generator.mdx` (18 sections); create
`tests/unique-id-generator-content.test.ts`.

- [ ] Author all 18 sections per spec — match `content-delivery-network.mdx` voice/density; cross-ref
  [URL Shortener](/learn/url-shortener) (unique keys), [Distributed Job Scheduler](/learn/distributed-job-scheduler)
  (ZooKeeper/etcd coordination), [Payment System](/learn/payment-system) (idempotency keys). Embed
  `<SnowflakeCapacity assumptions={{…}} />` (exact = test), `<SnowflakeArchitecture />` (sec 6), the four
  flows (generate + worker-id in sec 7; `<GenerateIdSequence />` also in sec 9; `<ClockSkewSequence />` in
  sec 11; `<SequenceOverflowSequence />` in sec 13), `RequirementsTable` (2), `EntityModel` (4), three
  `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15), `DecisionRecord` (16), two `Callout
  variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/unique-id-generator-content.test.ts` (mirror CDN): 18 ids; embeds present (`<SnowflakeCapacity`,
  `<SnowflakeArchitecture`, `<GenerateIdSequence`, `<WorkerIdAssignmentSequence`, `<ClockSkewSequence`,
  `<SequenceOverflowSequence`); assumptions match (`timeBits: 41`, `machineBits: 10`, `sequenceBits: 12`,
  `peakIdsPerSec: 1000000`); ≥6 KnowledgeCheck; ≥12 `question:`.
- [ ] **Run the content test right after writing the MDX** (catches dropped sections/embeds). Then
  `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` green (confirm
  `/learn/unique-id-generator` generates). Commit `content: complete Unique ID Generator tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/unique-id-generator` test: open, assert the `h1`, navigate to
  `#high-level-architecture`, assert the architecture diagram `img`, `scrollIntoViewIfNeeded()`, then
  in-viewport. **Decrement coming-soon 9 → 8.** Leave "showing 1 of 33".
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run test:e2e -- --workers=1`, `git diff --check`. Commit
  `test: verify Unique ID Generator tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1 (powers of two + 365-day lifespan). ✅
- Export-clash check done (6 names clean) + coming-soon decrement (9→8) + `returns undefined` stays
  `food-delivery` + `Object.keys().sort()` gets the new slug + curriculum insert position noted. ✅
