# Search Autocomplete Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the sixteenth complete curriculum tutorial — an Intermediate, read-amplified
typeahead walkthrough of **Search Autocomplete**: the trie with precomputed top-k, ranking/scoring
(popularity + recency + safety filtering), the query-log aggregation pipeline (batch index build), the
in-memory replicated serving tier and its latency budget, freshness / trending, and typo tolerance +
personalization — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the
first fifteen tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram,
four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing
themes are the **trie + precomputed top-k**, **ranking/filtering/safety**, **query-log batch
pipeline**, **in-memory replicated serving + latency budget**, **freshness/trending (Lambda)**, and
**typo tolerance + personalization**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9,
Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the fifteen existing tutorials.
- Invariants: autocomplete returns **top-k** ranked **completions** of a **prefix** per keystroke; matching is a **trie** walk but the design is **precomputed top-k at every node** (O(prefix length), never a subtree scan); **read amplification** = search QPS × keystrokes ≈ **1.16M QPS** (~20× the ~57.9k search QPS); the ranked **index is ~20 GB**, **replicated in RAM** on each of ~**116** serving nodes; query log ≈ **1 TB/day**; **ranking** = popularity (aggregated frequency) + recency/time-decay (+ optional personalization); **safety filtering** removes harmful completions; index built by a **batch pipeline** publishing **immutable versions** plus a **real-time/trending** layer (**Lambda** split); **typo tolerance** via **edit-distance** prefix expansion; autocomplete failure must **never block typing or searching**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                          # MODIFY: register search-autocomplete MDX
├── components/
│   ├── diagrams/
│   │   ├── search-autocomplete-architecture.tsx       # NEW: HLD (client, service, cache, trie index, query log, aggregator, builder, trending)
│   │   └── search-autocomplete-flows.tsx              # NEW: query / index-build / trending / typo sequences
│   └── learning/
│       └── search-autocomplete-capacity.tsx           # NEW: wrapper over CapacityTable
├── content/tutorials/search-autocomplete.mdx          # NEW: full tutorial content
├── lib/
│   ├── search-autocomplete-estimates.ts               # NEW: pure capacity calc
│   ├── tutorial-registry.ts                            # MODIFY: add search-autocomplete entry (18 sections)
│   └── curriculum.ts                                   # MODIFY: flip search-autocomplete to available
├── mdx-components.tsx                                  # MODIFY: register new components
├── tests/
│   ├── search-autocomplete-estimates.test.ts          # NEW
│   ├── search-autocomplete-content.test.ts            # NEW
│   ├── diagrams.test.tsx                               # MODIFY: autocomplete diagram assertions
│   ├── tutorial-registry.test.ts                       # MODIFY: sixteen tutorials; repoint undefined-slug to news-feed
│   └── curriculum.test.ts                              # MODIFY: sixteen available problems (search-autocomplete inserts at seq 8)
└── e2e/pilot.spec.ts                                  # MODIFY: autocomplete flow + coming-soon count 18→17
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Search Autocomplete capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/search-autocomplete-estimates.ts`, `tests/search-autocomplete-estimates.test.ts`, `components/learning/search-autocomplete-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/search-autocomplete-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateSearchAutocompleteCapacity } from "@/lib/search-autocomplete-estimates";

describe("calculateSearchAutocompleteCapacity", () => {
  const result = calculateSearchAutocompleteCapacity({
    dailySearches: 5_000_000_000,
    keystrokesPerSearch: 20,
    phrasesIndexed: 500_000_000,
    bytesPerPhrase: 40,
    perNodeQps: 10_000,
    logBytesPerEvent: 200,
  });

  it("derives the search QPS", () => {
    expect(result.searchQps).toBeCloseTo(57870.37, 1);
  });
  it("derives the read-amplified autocomplete QPS", () => {
    expect(result.autocompleteQps).toBeCloseTo(1157407.41, 1);
  });
  it("derives the serving fleet size", () => {
    expect(result.servingNodesNeeded).toBe(116);
  });
  it("derives the in-memory index size in GB", () => {
    expect(result.indexSizeGb).toBe(20);
  });
  it("derives the daily query-log volume in TB", () => {
    expect(result.dailyLogTb).toBe(1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/search-autocomplete-estimates.test.ts`.

**Step 3: Implement** `lib/search-autocomplete-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const BYTES_PER_GB = 1_000_000_000;

export interface SearchAutocompleteCapacityAssumptions {
  /** Total searches submitted per day. */
  dailySearches: number;
  /** Autocomplete requests issued per search (≈ characters typed after debounce). */
  keystrokesPerSearch: number;
  /** Number of distinct phrases held in the ranked index. */
  phrasesIndexed: number;
  /** Bytes to store one phrase in the trie (string + top-k metadata, amortized). */
  bytesPerPhrase: number;
  /** Autocomplete requests one serving node can answer per second. */
  perNodeQps: number;
  /** Bytes logged per search event for the aggregation pipeline. */
  logBytesPerEvent: number;
}

export interface SearchAutocompleteCapacityResults {
  searchQps: number;
  autocompleteQps: number;
  servingNodesNeeded: number;
  indexSizeGb: number;
  dailyLogTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: every keystroke is a query, so
 * autocomplete is read-amplified to ~20× the search QPS (~1.16M QPS) — overwhelmingly read-dominated,
 * which forces precomputed top-k served from memory rather than per-query computation; the ranked
 * index is only ~20 GB, small enough to replicate into RAM on every serving node so reads scale by
 * adding identical replicas; and the query-log firehose feeding the ranking is ~1 TB/day.
 */
export function calculateSearchAutocompleteCapacity(
  a: SearchAutocompleteCapacityAssumptions,
): SearchAutocompleteCapacityResults {
  const searchQps = a.dailySearches / SECONDS_PER_DAY;
  const autocompleteQps = (a.dailySearches * a.keystrokesPerSearch) / SECONDS_PER_DAY;
  const servingNodesNeeded = Math.ceil(autocompleteQps / a.perNodeQps);
  const indexSizeGb = (a.phrasesIndexed * a.bytesPerPhrase) / BYTES_PER_GB;
  const dailyLogTb = (a.dailySearches * a.logBytesPerEvent) / BYTES_PER_TB;

  return {
    searchQps,
    autocompleteQps,
    servingNodesNeeded,
    indexSizeGb,
    dailyLogTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/search-autocomplete-capacity.tsx`, mirroring
`components/learning/web-crawler-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateSearchAutocompleteCapacity,
  type SearchAutocompleteCapacityAssumptions,
} from "@/lib/search-autocomplete-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function SearchAutocompleteCapacity({
  assumptions,
}: {
  assumptions: SearchAutocompleteCapacityAssumptions;
}) {
  const r = calculateSearchAutocompleteCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily searches", value: fmt(assumptions.dailySearches) },
    { label: "Keystrokes / search", value: fmt(assumptions.keystrokesPerSearch) },
    { label: "Phrases indexed", value: fmt(assumptions.phrasesIndexed) },
    { label: "Bytes / phrase", value: `${fmt(assumptions.bytesPerPhrase)} B` },
    { label: "QPS / serving node", value: fmt(assumptions.perNodeQps) },
    { label: "Log bytes / event", value: `${fmt(assumptions.logBytesPerEvent)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Search QPS", value: `${fmt(r.searchQps)} /s`, consequence: "The baseline rate of actual searches — modest next to the read load autocomplete generates." },
    { label: "Autocomplete QPS", value: `${fmt(r.autocompleteQps)} /s`, consequence: "Every keystroke is a request, so the read load is ~20× the search QPS — autocomplete is overwhelmingly read-dominated." },
    { label: "Serving fleet", value: fmt(r.servingNodesNeeded), consequence: "Sized by autocomplete QPS ÷ per-node throughput; stateless replicas that each hold a full copy of the index." },
    { label: "Index size (in RAM)", value: `${fmt(r.indexSizeGb)} GB`, consequence: "The ranked index is small enough to replicate into the RAM of every serving node — which is what makes sub-100 ms at over a million QPS achievable." },
    { label: "Query log / day", value: `${fmt(r.dailyLogTb)} TB`, consequence: "The firehose of search events the batch pipeline aggregates into popularity scores." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `SearchAutocompleteCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/search-autocomplete-estimates.test.ts tests/web-crawler-estimates.test.ts
npm run typecheck && npm run lint
git add lib/search-autocomplete-estimates.ts tests/search-autocomplete-estimates.test.ts components/learning/search-autocomplete-capacity.tsx mdx-components.tsx
git commit -m "feat: add search autocomplete capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/web-crawler-architecture.tsx` (HLD) and
`components/diagrams/web-crawler-flows.tsx` (sequences) — do not invent new SVG conventions. Copy the
`Sequence`/`StepLabel`/`Actor`/`Step` helpers from `web-crawler-flows.tsx` verbatim.

**Files:** Create `components/diagrams/search-autocomplete-architecture.tsx`, `components/diagrams/search-autocomplete-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { SearchAutocompleteArchitecture } from "@/components/diagrams/search-autocomplete-architecture";
import {
  AutocompleteQuerySequence,
  IndexBuildSequence,
  TrendingUpdateSequence,
  TypoCorrectionSequence,
} from "@/components/diagrams/search-autocomplete-flows";

describe("SearchAutocompleteArchitecture", () => {
  it("exposes the search autocomplete architecture to non-visual readers", () => {
    render(<SearchAutocompleteArchitecture />);
    expect(
      screen.getByRole("img", { name: /search autocomplete architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/precomputed top-k/i)).toBeInTheDocument();
  });
});

describe("search autocomplete flow sequences", () => {
  it("renders the query, index-build, trending, and typo sequences", () => {
    render(<AutocompleteQuerySequence />);
    expect(screen.getByRole("img", { name: /query/i })).toBeInTheDocument();
    render(<IndexBuildSequence />);
    expect(screen.getByRole("img", { name: /build/i })).toBeInTheDocument();
    render(<TrendingUpdateSequence />);
    expect(screen.getByRole("img", { name: /trending/i })).toBeInTheDocument();
    render(<TypoCorrectionSequence />);
    expect(screen.getByRole("img", { name: /typo/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"precomputed top-k"** in the
**caption only** (NOT in any node label/sublabel and NOT in the `DiagramFrame` title). The trie node
should be labeled e.g. "Trie Index" with sublabel "in-memory" — do NOT put "precomputed top-k" on it.
Also: all four flow titles render into the same test DOM in one test, so each regex must match exactly
one title — use distinct, mutually exclusive title keywords **"query" / "build" / "trending" / "typo"**.
CRITICAL: do NOT let any title contain another flow's keyword — the index-build title must say "search
logs" not "query logs" (else it matches `/query/i`), and the trending title must use "phrase" not
"query" (e.g. "surface a trending phrase in real time"). Verify each of the four titles matches exactly
one of the four regexes.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `search-autocomplete-architecture.tsx` exporting
`SearchAutocompleteArchitecture`, following the `web-crawler-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before nodes,
a `Legend`). Two planes — the read path on top, the build pipeline below:
- `Client` (external, sublabel "types prefix") → `Autocomplete Service` (service, sublabel "prefix → top-k") via `ingress` ("prefix keystroke").
- `Autocomplete Service` → `Suggestion Cache` (cache, sublabel "hot prefixes") via `control` ("check cache").
- `Autocomplete Service` → `Trie Index` (store, sublabel "in-memory") via `redirect` ("lookup top-k").
- `Autocomplete Service` → `Query Log` (queue, sublabel "search events") via `async` ("log query event").
- `Query Log` → `Aggregator` (service, sublabel "batch counts") via `async` ("consume events").
- `Aggregator` → `Index Builder` (service, sublabel "build trie") via `create` ("frequency counts").
- `Index Builder` → `Trie Index` via `create` ("publish new index").
- `Trending` (service, sublabel "velocity spikes") → `Trie Index` via `async` ("inject trending phrase").
- `title` contains "Search Autocomplete architecture"; `caption` names the **precomputed top-k** trie,
  the read path (client → service → cache/trie), the batch **aggregation pipeline** (query log →
  aggregator → builder → published index), and the **trending** real-time layer, in prose. (Per the
  gotcha, keep "precomputed top-k" in the caption only; the trie node is "Trie Index" / "in-memory".)
- Node kinds: `external` for the client; `service` for the autocomplete service, aggregator, index
  builder, and trending; `cache` for the suggestion cache; `store` for the trie index; `queue` for the
  query log.
- Suggested geometry (viewBox `0 0 980 520`): a read row near the top — client {24,150} → service
  {220,150} → cache {430,90} above-right, trieIndex {430,210} below-right of the service; a pipeline
  row lower — queryLog {220,330} → aggregator {430,330} → builder {640,330} → (builder up to trieIndex);
  trending {640,210} feeding the trie. Adjust to avoid overlaps; `w` ≈ 150, `h` ≈ 56 (store/cache `h`
  ≈ 60). Keep the viewBox ≥ the rightmost/bottom-most node. (Exact coordinates are the implementer's
  discretion as long as edges don't cross nodes and the layout reads cleanly.)

**Step 4: Implement the flow sequences** `search-autocomplete-flows.tsx`, exporting four components.
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive
("query" / "build" / "trending" / "typo") and ensure no title contains another's keyword (build title
uses "search logs" not "query logs"; trending title uses "phrase" not "query"; typo title avoids the
other three):
- `AutocompleteQuerySequence` — title contains "query" (e.g. "Sequence: serve an autocomplete query"); actors Client, Autocomplete Service, Suggestion Cache, Trie Index; steps: client sends the prefix as the user types, the service checks the suggestion cache (miss), walks the trie to the prefix node, reads the precomputed top-k, populates the cache, and returns ranked suggestions. Caption: the hot read path — a prefix walks the trie to its node and returns the precomputed top-k in a few ms, cached for hot prefixes; per keystroke. Use `control` for the cache check, `redirect` for the trie lookup/return.
- `IndexBuildSequence` — title contains "build" and NOT "query" (e.g. "Sequence: build the index from search logs"); actors Query Log, Aggregator, Index Builder, Trie Index; steps: the aggregator consumes a batch of events, counts phrase frequencies, emits a ranked phrase list, the builder builds the trie with top-k per node and publishes a new immutable index version. Caption: the batch pipeline aggregates logged search events into popularity scores, builds the trie with top-k at every node, and publishes a new immutable index the serving tier loads atomically. Use `async` for consume, `create` for counts/build/publish.
- `TrendingUpdateSequence` — title contains "trending" and NOT "query" (e.g. "Sequence: surface a trending phrase in real time"); actors Query Log, Trending, Trie Index; steps: the trending layer streams recent events, detects a velocity spike, and injects the trending phrase into the served top-k between batch rebuilds. Caption: a real-time layer watches the event stream for velocity spikes and injects hot phrases into the served top-k, covering the freshness the hours-old batch index misses. Use `async` for stream/inject, `control` for spike detection.
- `TypoCorrectionSequence` — title contains "typo" (e.g. "Sequence: correct a typo and personalize"); actors Client, Autocomplete Service, Trie Index; steps: client sends a mistyped prefix, the exact trie walk misses, the service expands to edit-distance variants, looks up the corrected prefix, and returns "did-you-mean" suggestions. Caption: a mistyped prefix has no exact trie match, so the service expands to edit-distance variants, looks up the corrected prefix, and returns did-you-mean suggestions. Use `control` for the miss/expand, `redirect` for the corrected lookup/return.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/search-autocomplete-architecture.tsx components/diagrams/search-autocomplete-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add search autocomplete architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton with all
18 section ids, and update the existing "fifteen tutorials" tests to "sixteen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/search-autocomplete.mdx` (skeleton).

IMPORTANT: there are currently FIFTEEN available tutorials. You add a SIXTEENTH. `search-autocomplete`
is **sequence 8**, which sits **between `web-crawler` (seq 7) and `video-streaming` (seq 11)** in the
curriculum's available-by-sequence ordering — so it **inserts early**. ALSO CRITICAL:
`search-autocomplete` was the slug used by the registry test's "returns undefined for unregistered"
case; since it is now registered, that test must be repointed to a still-`coming-soon` slug —
**`news-feed`** (seq 9). Read each test file BEFORE editing to match its exact phrasing. The curriculum
total is 33 — do NOT change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all SIXTEEN tutorials are registered. In the
sorted `Object.keys(tutorials)` array, `"search-autocomplete"` sorts between `"rate-limiter"` and
`"ticket-booking"` (alphabetical). The new sorted array is:
`["api-gateway", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "notification-service", "pastebin", "payment-system", "rate-limiter", "search-autocomplete", "ticket-booking", "url-shortener", "video-streaming", "web-crawler"]`.
Add `expect(getTutorial("search-autocomplete")?.sections).toHaveLength(18);` to the section-length test.
Update the two descriptive `it(...)` strings to mention Search Autocomplete. **CHANGE the "returns
undefined for unregistered" test from `getTutorial("search-autocomplete")` to `getTutorial("news-feed")`**
(news-feed is still coming-soon and unregistered).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "web-crawler", "search-autocomplete", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(search-autocomplete is seq 8 — it goes AFTER web-crawler and BEFORE video-streaming). Add
`expect(getProblem("search-autocomplete")?.title).toBe("Search Autocomplete");`. Update the descriptive
`it(...)` string. Do NOT touch the 33 count/sequence assertions. **NOTE:** read the test first to
confirm the exact existing available-slugs array (it should currently have fifteen entries ending with
`web-crawler` inserted after `api-gateway`); insert `search-autocomplete` immediately after
`web-crawler`.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `search-autocomplete` entry `status` from `"coming-soon"`
to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"search-autocomplete": {
  slug: "search-autocomplete",
  title: "Design Search Autocomplete",
  description:
    "An interview-grade walkthrough of search autocomplete (typeahead): a trie with precomputed top-k at every node, ranking by popularity and recency with safety filtering, a batch query-log aggregation pipeline that builds and publishes the ranked index, an in-memory replicated serving tier under a tight latency budget, a real-time trending layer for freshness, typo tolerance and personalization, scaling, and failure modes.",
  difficulty: "Intermediate",
  readingMinutes: 34,
  concepts: ["Trie", "Top-k ranking", "Low latency", "Precomputation"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "trie-topk", label: "The Trie & Precomputed Top-K", depth: "advanced" },
    { id: "ranking-scoring", label: "Ranking, Filtering & Safety", depth: "advanced" },
    { id: "data-pipeline", label: "Building the Index from Query Logs", depth: "advanced" },
    { id: "serving-layer", label: "Serving, Sharding & the Latency Budget", depth: "advanced" },
    { id: "freshness-trending", label: "Freshness & Trending Queries", depth: "advanced" },
    { id: "fuzzy-personalization", label: "Typo Tolerance & Personalization", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add
`import SearchAutocompleteContent from "@/content/tutorials/search-autocomplete.mdx";` and
`"search-autocomplete": SearchAutocompleteContent,` to the content map.

**Step 7:** Create `content/tutorials/search-autocomplete.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/search-autocomplete
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/search-autocomplete.mdx
git commit -m "feat: register search autocomplete tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3, then
installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered the embedded
components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<SearchAutocompleteCapacity assumptions={{ dailySearches: 5000000000, keystrokesPerSearch: 20, phrasesIndexed: 500000000, bytesPerPhrase: 40, perNodeQps: 10000, logBytesPerEvent: 200 }} />` then read off the read-amplification (~1.16M QPS, ~20×) / index-fits-in-RAM (~20 GB) / 1 TB-day-log lessons.
- `entity-model` — `EntityModel name="Suggestion"` (phrase, normalized, score, frequency, language, last_updated) + prose on the trie node (children + cached top-k), the QueryEvent record, personalization signals, keyed-by-prefix + top-k-cached-per-node.
- `api-design` — `ApiContract` for `GET /autocomplete?q={prefix}`, `POST /events`, `POST /blocklist`.
- `high-level-architecture` — `<SearchAutocompleteArchitecture />` + component prose.
- `detailed-flows` — `<AutocompleteQuerySequence />`, `<IndexBuildSequence />`, `<TrendingUpdateSequence />`, `<TypoCorrectionSequence />` with prose.
- deep dives `trie-topk`, `ranking-scoring`, `data-pipeline`, `serving-layer`, `freshness-trending`, `fuzzy-personalization` per spec, with a `<KnowledgeCheck>` in trie-topk, ranking-scoring, data-pipeline, serving-layer, and freshness-trending.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- Cross-reference the Web Crawler (corpus pipeline / the search engine autocomplete fronts) and Distributed Logging (query-log firehose) and Distributed Job Scheduler (time-triggered batch rebuild). ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/search-autocomplete-content.test.ts` (mirror `tests/web-crawler-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<SearchAutocompleteCapacity`, `<SearchAutocompleteArchitecture`, and the four sequences `<AutocompleteQuerySequence`, `<IndexBuildSequence`, `<TrendingUpdateSequence`, `<TypoCorrectionSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real embeds
and generates `/learn/search-autocomplete`) all green. Commit `content: complete search autocomplete tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 17), and run full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 18 to 17 (sixteen
tutorials now available — verify the current value is 18 first) and add:
```ts
test("learner can open the search autocomplete tutorial", async ({ page }) => {
  await page.goto("/learn/search-autocomplete");
  await expect(
    page.getByRole("heading", { name: /design search autocomplete/i }),
  ).toBeVisible();
  await page.goto("/learn/search-autocomplete#trie-topk");
  await expect(page.locator("#trie-topk")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /search autocomplete architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link
issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify search autocomplete tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/web-crawler.mdx` first** for voice, depth, and component usage. Match its altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — frequency counts / build / publish), `redirect` (green — lookup top-k / return suggestions), `async` (violet dashed — log event / consume events / inject trending), `control` (amber dashed — check cache / detect spike / typo miss-expand), `muted` (telemetry), `ingress` (plain — prefix keystroke). Node kinds: `external` for the client, `service` for the autocomplete service/aggregator/builder/trending, `cache` for the suggestion cache, `store` for the trie index, `queue` for the query log.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "precomputed top-k" in the caption only; the trie node is "Trie Index" / "in-memory"; not in the title). All four flow titles render into one test DOM — keep the keywords "query"/"build"/"trending"/"typo" mutually exclusive across titles (build → "search logs" not "query logs"; trending → "phrase" not "query").
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/search-autocomplete-estimates.test.ts`.
- **search-autocomplete is seq 8 — it INSERTS early** in the curriculum available-by-sequence ordering (after web-crawler seq 7, before video-streaming seq 11). The curriculum total is 33 (unchanged); do not touch the 33 count assertions. **The registry test's "unregistered" slug must move from `search-autocomplete` to `news-feed`.**
- **No flow/diagram name collisions:** `AutocompleteQuerySequence`, `IndexBuildSequence`, `TrendingUpdateSequence`, `TypoCorrectionSequence`, `SearchAutocompleteArchitecture`, `SearchAutocompleteCapacity` are all unique exports — no aliasing needed in `mdx-components.tsx`. (Note `IndexBuildSequence` does not clash with logging's `IndexBuildSequence`? — it DOES: `logging-flows.tsx` exports `IndexBuildSequence`. ALIAS it on import in `mdx-components.tsx` as `AutocompleteIndexBuildSequence` and register under that name, and reference `<AutocompleteIndexBuildSequence>` in the MDX + content test. The diagram component file and diagrams.test.tsx still use the local name `IndexBuildSequence`.)
```
