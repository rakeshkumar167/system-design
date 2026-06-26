# Web Crawler Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the fifteenth complete curriculum tutorial — an Advanced, large-scale-crawling
walkthrough of a **Web Crawler**: the URL frontier (priority + politeness), robots.txt and per-host
politeness, URL and content deduplication (bloom filters + fingerprints), DNS resolution and
fetching at scale, freshness / re-crawl scheduling, and crawler traps / robustness — reusing the
existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the
first fourteen tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram,
four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing
themes are the **URL frontier (Mercator front/back queues)**, **politeness/robots.txt**, **bloom-
filter dedup**, **DNS + concurrent fetching**, **freshness scheduling**, and **trap robustness**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9,
Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the fourteen existing tutorials.
- Invariants: the crawler traverses the web graph from **seed URLs**; the **URL frontier** is a priority + politeness queue (**Mercator** front queues for priority, per-host back queues for politeness — one in-flight request per host); **politeness** = obey cached **robots.txt** + per-host **crawl delay**, identify via `User-Agent`, enforced structurally; the **seen-URL set** is too large to store exactly (~1.5 TB) so it's a **bloom filter** (~37.5 GB, ~10 bits/URL) accepting rare false positives; **content dedup** uses content hashes (exact) + **simhash/minhash** (near-dup); **DNS** is a bottleneck → resolve async + cache; **fetching** is massively concurrent async I/O; **freshness** = re-crawl by change rate/importance; **traps** are bounded by depth limits, URL-pattern caps, and per-host budgets; the corpus is multi-petabyte.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                  # MODIFY: register web-crawler MDX
├── components/
│   ├── diagrams/
│   │   ├── web-crawler-architecture.tsx       # NEW: HLD (seeds, frontier, fetcher, DNS, robots, parser, seen-set, content store, scheduler)
│   │   └── web-crawler-flows.tsx              # NEW: fetch-page / dedup-check / politeness / recrawl sequences
│   └── learning/
│       └── web-crawler-capacity.tsx           # NEW: wrapper over CapacityTable
├── content/tutorials/web-crawler.mdx          # NEW: full tutorial content
├── lib/
│   ├── web-crawler-estimates.ts               # NEW: pure capacity calc
│   ├── tutorial-registry.ts                   # MODIFY: add web-crawler entry (18 sections)
│   └── curriculum.ts                          # MODIFY: flip web-crawler to available
├── mdx-components.tsx                          # MODIFY: register new components
├── tests/
│   ├── web-crawler-estimates.test.ts          # NEW
│   ├── web-crawler-content.test.ts            # NEW
│   ├── diagrams.test.tsx                       # MODIFY: crawler diagram assertions
│   ├── tutorial-registry.test.ts              # MODIFY: fifteen tutorials; repoint undefined-slug to search-autocomplete
│   └── curriculum.test.ts                      # MODIFY: fifteen available problems (web-crawler inserts at seq 7, between api-gateway and video-streaming)
└── e2e/pilot.spec.ts                          # MODIFY: crawler flow + coming-soon count 19→18
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Web Crawler capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/web-crawler-estimates.ts`, `tests/web-crawler-estimates.test.ts`, `components/learning/web-crawler-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/web-crawler-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateWebCrawlerCapacity } from "@/lib/web-crawler-estimates";

describe("calculateWebCrawlerCapacity", () => {
  const result = calculateWebCrawlerCapacity({
    pagesToCrawl: 30_000_000_000,
    crawlDays: 30,
    avgPageSizeKb: 100,
    pagesPerSecPerCrawler: 100,
    bytesPerUrlExact: 50,
    bloomBitsPerUrl: 10,
  });

  it("derives the sustained crawl rate in pages per second", () => {
    expect(result.avgCrawlRatePps).toBeCloseTo(11574.07, 1);
  });
  it("derives the fetcher fleet size", () => {
    expect(result.crawlersNeeded).toBe(116);
  });
  it("derives the sustained download bandwidth in Gbps", () => {
    expect(result.bandwidthGbps).toBeCloseTo(9.26, 2);
  });
  it("derives the exact seen-set size in TB", () => {
    expect(result.exactSeenSetTb).toBe(1.5);
  });
  it("derives the bloom-filter seen-set size in GB", () => {
    expect(result.bloomFilterGb).toBe(37.5);
  });
  it("derives total content storage in PB", () => {
    expect(result.contentStoragePb).toBe(3);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/web-crawler-estimates.test.ts`.

**Step 3: Implement** `lib/web-crawler-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const BYTES_PER_GB = 1_000_000_000;
const BITS_PER_BYTE = 8;
const BYTES_PER_KB = 1_000;

export interface WebCrawlerCapacityAssumptions {
  /** Total pages to crawl across the corpus. */
  pagesToCrawl: number;
  /** Days allotted to crawl the corpus once. */
  crawlDays: number;
  /** Average downloaded page size, in KB. */
  avgPageSizeKb: number;
  /** Pages per second one fetcher node can download. */
  pagesPerSecPerCrawler: number;
  /** Bytes to store one URL in an exact seen-set (string + metadata). */
  bytesPerUrlExact: number;
  /** Bloom-filter bits per URL (sets the false-positive rate). */
  bloomBitsPerUrl: number;
}

export interface WebCrawlerCapacityResults {
  avgCrawlRatePps: number;
  crawlersNeeded: number;
  bandwidthGbps: number;
  exactSeenSetTb: number;
  bloomFilterGb: number;
  contentStoragePb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: fetching tens of billions of pages in a
 * month is an ordinary throughput problem (~11.6k pages/sec, ~9 Gbps, ~116 fetchers); the signature
 * difficulty is the seen-set — storing every crawled URL exactly is terabytes, but a bloom filter holds
 * the same set in ~40× less space at the cost of rare false positives, the only practical way to dedup
 * at scale; and the crawled corpus is multi-petabyte.
 */
export function calculateWebCrawlerCapacity(
  a: WebCrawlerCapacityAssumptions,
): WebCrawlerCapacityResults {
  const avgCrawlRatePps = a.pagesToCrawl / (a.crawlDays * SECONDS_PER_DAY);
  const crawlersNeeded = Math.ceil(avgCrawlRatePps / a.pagesPerSecPerCrawler);
  const bandwidthGbps =
    (avgCrawlRatePps * a.avgPageSizeKb * BYTES_PER_KB * BITS_PER_BYTE) / BYTES_PER_GB;
  const exactSeenSetTb = (a.pagesToCrawl * a.bytesPerUrlExact) / BYTES_PER_TB;
  const bloomFilterGb = (a.pagesToCrawl * a.bloomBitsPerUrl) / BITS_PER_BYTE / BYTES_PER_GB;
  const contentStoragePb =
    (a.pagesToCrawl * a.avgPageSizeKb * BYTES_PER_KB) / (BYTES_PER_TB * 1_000);

  return {
    avgCrawlRatePps,
    crawlersNeeded,
    bandwidthGbps,
    exactSeenSetTb,
    bloomFilterGb,
    contentStoragePb,
  };
}
```

**Step 4: Run to verify it passes** (6 tests).

**Step 5: Create the wrapper** `components/learning/web-crawler-capacity.tsx`, mirroring
`components/learning/api-gateway-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateWebCrawlerCapacity,
  type WebCrawlerCapacityAssumptions,
} from "@/lib/web-crawler-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function WebCrawlerCapacity({
  assumptions,
}: {
  assumptions: WebCrawlerCapacityAssumptions;
}) {
  const r = calculateWebCrawlerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Pages to crawl", value: fmt(assumptions.pagesToCrawl) },
    { label: "Crawl window", value: `${fmt(assumptions.crawlDays)} d` },
    { label: "Avg page size", value: `${fmt(assumptions.avgPageSizeKb)} KB` },
    { label: "Pages/sec per fetcher", value: fmt(assumptions.pagesPerSecPerCrawler) },
    { label: "Bytes / URL (exact)", value: `${fmt(assumptions.bytesPerUrlExact)} B` },
    { label: "Bloom bits / URL", value: fmt(assumptions.bloomBitsPerUrl) },
  ];

  const results: ResultRow[] = [
    { label: "Crawl rate", value: `${fmt(r.avgCrawlRatePps)} pages/s`, consequence: "To cover the corpus in the window you sustain this rate — fetching is an ordinary throughput problem." },
    { label: "Fetcher fleet", value: fmt(r.crawlersNeeded), consequence: "Sized by crawl rate ÷ per-node throughput; fetching is massively parallel async I/O." },
    { label: "Bandwidth", value: `${fmt(r.bandwidthGbps, 2)} Gbps`, consequence: "Downloading at that rate needs steady multi-Gbps bandwidth — a real but manageable constraint." },
    { label: "Seen-set (exact)", value: `${fmt(r.exactSeenSetTb, 1)} TB`, consequence: "Storing every crawled URL exactly is terabytes — too big to keep in memory per node." },
    { label: "Seen-set (bloom filter)", value: `${fmt(r.bloomFilterGb, 1)} GB`, consequence: "A bloom filter holds the same URLs in ~40× less space (rare false positives = occasionally skipping a page) — the only way to dedup at this scale." },
    { label: "Content storage", value: `${fmt(r.contentStoragePb)} PB`, consequence: "The crawled corpus is multi-petabyte, kept in a distributed blob store." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `WebCrawlerCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/web-crawler-estimates.test.ts tests/api-gateway-estimates.test.ts
npm run typecheck && npm run lint
git add lib/web-crawler-estimates.ts tests/web-crawler-estimates.test.ts components/learning/web-crawler-capacity.tsx mdx-components.tsx
git commit -m "feat: add web crawler capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/api-gateway-architecture.tsx` (HLD) and
`components/diagrams/api-gateway-flows.tsx` (sequences) — do not invent new SVG conventions. Copy the
`Sequence`/`StepLabel`/`Actor`/`Step` helpers from `api-gateway-flows.tsx` (or `maps-navigation-flows.tsx`)
verbatim.

**Files:** Create `components/diagrams/web-crawler-architecture.tsx`, `components/diagrams/web-crawler-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { WebCrawlerArchitecture } from "@/components/diagrams/web-crawler-architecture";
import {
  FetchPageSequence,
  DedupCheckSequence,
  PolitenessSequence,
  RecrawlSequence,
} from "@/components/diagrams/web-crawler-flows";

describe("WebCrawlerArchitecture", () => {
  it("exposes the web crawler architecture to non-visual readers", () => {
    render(<WebCrawlerArchitecture />);
    expect(
      screen.getByRole("img", { name: /web crawler architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bloom filter/i)).toBeInTheDocument();
  });
});

describe("web crawler flow sequences", () => {
  it("renders the fetch, dedup, politeness, and recrawl sequences", () => {
    render(<FetchPageSequence />);
    expect(screen.getByRole("img", { name: /fetch/i })).toBeInTheDocument();
    render(<DedupCheckSequence />);
    expect(screen.getByRole("img", { name: /dedup/i })).toBeInTheDocument();
    render(<PolitenessSequence />);
    expect(screen.getByRole("img", { name: /polite/i })).toBeInTheDocument();
    render(<RecrawlSequence />);
    expect(screen.getByRole("img", { name: /recrawl/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"bloom filter"** in the **caption
only** (NOT in any node label/sublabel and NOT in the `DiagramFrame` title). The seen-set node should
be labeled e.g. "Seen-Set" with sublabel "URL dedup" — do NOT put "bloom filter" on it. Also: all four
flow titles render into the same test DOM in one test, so each regex must match exactly one title — use
distinct, mutually exclusive title keywords **"fetch" / "dedup" / "polite" / "recrawl"** and ensure NO
title contains another flow's keyword. CRITICAL: do NOT use the bare word "crawl" as the fetch-flow
keyword — "recrawl" contains "crawl", so `/crawl/i` would match two titles. Use "fetch" for that flow,
and ensure the politeness title does NOT contain the word "fetch" (phrase it as e.g. "apply politeness
and robots rules", not "...before fetching").

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `web-crawler-architecture.tsx` exporting
`WebCrawlerArchitecture`, following the `api-gateway-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before nodes,
a `Legend`). It must show the crawl loop:
- `Seeds` (infra, sublabel "seed URLs") → `URL Frontier` (queue, sublabel "priority + politeness") via `ingress` ("seed URLs").
- `URL Frontier` → `Fetcher` (service, sublabel "download pages") via `redirect` ("next URL").
- `Fetcher` → `DNS` (cache, sublabel "cached") via `muted` ("resolve host").
- `Fetcher` → `Robots Cache` (store, sublabel "robots.txt") via `control` ("check rules").
- `Fetcher` → `Parser` (service, sublabel "extract links") via `create` ("fetched page").
- `Fetcher` → `Content Store` (store, sublabel "crawled pages") via `create` ("store page").
- `Parser` → `Seen-Set` (store, sublabel "URL dedup") via `control` ("check seen").
- `Seen-Set` → `URL Frontier` via `async` ("enqueue new URLs").
- `Scheduler` (service, sublabel "re-crawl") → `URL Frontier` via `async` ("schedule recrawl").
- `title` contains "Web Crawler architecture"; `caption` names the **URL frontier (priority +
  politeness)**, the **fetch → parse → dedup** loop, the **bloom filter** seen-set, **robots.txt**
  politeness, and **re-crawl** scheduling, in prose. (Per the gotcha, keep "bloom filter" in the caption
  only; the seen-set node is "Seen-Set" / "URL dedup".)
- Node kinds: `infra` for the seeds; `queue` for the frontier; `service` for the fetcher, parser, and
  scheduler; `cache` for DNS; `store` for the robots cache, seen-set, and content store.
- Suggested geometry (viewBox `0 0 980 520`): seeds {24,232} → frontier {200,232} → fetcher {400,232} →
  parser {620,232} → seenSet {800,232} along the middle (the loop); dns {400,90} and robotsCache {620,90}
  above the fetcher/parser; contentStore {800,90} above the seen-set; scheduler {200,392} below the
  frontier. `w` ≈ 150, `h` ≈ 56 (store `h` ≈ 60). Adjust to avoid overlaps; keep the viewBox ≥ the
  rightmost/bottom-most node.

**Step 4: Implement the flow sequences** `web-crawler-flows.tsx`, exporting four components. Each `title`
contains the keyword the test matches; keep the four keywords mutually exclusive ("fetch" / "dedup" /
"polite" / "recrawl") and ensure no title contains another's keyword (watch "recrawl" vs "fetch"; do not
put "fetch" in the politeness title):
- `FetchPageSequence` — title contains "fetch" (e.g. "Sequence: fetch a page and extract links"); actors Frontier, Fetcher, Parser, Content Store; steps: frontier hands the fetcher the next URL, the fetcher downloads the page, stores it, the parser extracts links, and new links go toward dedup/the frontier. Caption: the core loop — pull a URL from the frontier, download and store the page, parse out its links, and feed new ones back into the frontier.
- `DedupCheckSequence` — title contains "dedup" (e.g. "Sequence: dedup a discovered URL"); actors Parser, Seen-Set, Frontier; steps: parser submits a discovered URL, the seen-set (bloom filter) is checked, if already seen the URL is dropped, if new it's added to the set and enqueued. Caption: every discovered URL is checked against the bloom-filter seen-set; already-seen URLs are dropped and new ones are added and enqueued, so the crawler doesn't redo work. Use `control` for the "already seen → drop".
- `PolitenessSequence` — title contains "polite" (e.g. "Sequence: apply politeness and robots rules"); actors Fetcher, Robots Cache, Host; steps: before hitting a host the fetcher loads cached robots.txt, checks the URL is allowed and the crawl-delay has elapsed, then makes one request. Caption: before contacting a host the fetcher honors cached robots.txt and the per-host crawl delay, keeping at most one in-flight request per host so the crawler stays a good citizen. Use `control` for a disallowed/throttled path. Do NOT use the word "fetch" in this title.
- `RecrawlSequence` — title contains "recrawl" (e.g. "Sequence: schedule a recrawl for freshness"); actors Scheduler, Page Store, Frontier; steps: the scheduler reads a page's last-crawled time and estimated change rate, decides it's due, and re-enqueues it into the frontier. Caption: a scheduler re-enqueues pages on a freshness cadence tuned to how often each changes, so fast-changing pages are revisited more than static ones. Use `async` for the re-enqueue.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/web-crawler-architecture.tsx components/diagrams/web-crawler-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add web crawler architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton with all
18 section ids, and update the existing "fourteen tutorials" tests to "fifteen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/web-crawler.mdx` (skeleton).

IMPORTANT: there are currently FOURTEEN available tutorials. You add a FIFTEENTH. `web-crawler` is
**sequence 7**, which sits **between `api-gateway` (seq 6) and `video-streaming` (seq 11)** in the
curriculum's available-by-sequence ordering — so it **inserts early**. ALSO CRITICAL: `web-crawler` was
the slug used by the registry test's "returns undefined for unregistered" case; since it is now
registered, that test must be repointed to a still-`coming-soon` slug — **`search-autocomplete`**
(seq 8). Read each test file BEFORE editing to match its exact phrasing. The curriculum total is 33 — do
NOT change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all FIFTEEN tutorials are registered. In the
sorted `Object.keys(tutorials)` array, `"web-crawler"` sorts LAST (after `"video-streaming"`). The new
sorted array is:
`["api-gateway", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "notification-service", "pastebin", "payment-system", "rate-limiter", "ticket-booking", "url-shortener", "video-streaming", "web-crawler"]`.
Add `expect(getTutorial("web-crawler")?.sections).toHaveLength(18);` to the section-length test. Update
the two descriptive `it(...)` strings to mention the Web Crawler. **CHANGE the "returns undefined for
unregistered" test from `getTutorial("web-crawler")` to `getTutorial("search-autocomplete")`**
(search-autocomplete is still coming-soon and unregistered).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "web-crawler", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(web-crawler is seq 7 — it goes AFTER api-gateway and BEFORE video-streaming). Add
`expect(getProblem("web-crawler")?.title).toBe("Web Crawler");`. Update the descriptive `it(...)` string.
Do NOT touch the 33 count/sequence assertions.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `web-crawler` entry `status` from `"coming-soon"` to
`"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"web-crawler": {
  slug: "web-crawler",
  title: "Design a Web Crawler",
  description:
    "An interview-grade walkthrough of a web crawler: the URL frontier (priority and politeness queues), robots.txt and per-host politeness, URL and content deduplication with bloom filters and fingerprints, DNS resolution and fetching at scale, freshness-aware re-crawl scheduling, crawler traps and robustness, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Frontier queue", "Dedup & hashing", "Politeness", "Scheduling"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "url-frontier", label: "The URL Frontier", depth: "advanced" },
    { id: "politeness", label: "Politeness & robots.txt", depth: "advanced" },
    { id: "dedup", label: "URL & Content Deduplication", depth: "advanced" },
    { id: "dns-fetching", label: "DNS Resolution & Fetching", depth: "advanced" },
    { id: "freshness-scheduling", label: "Freshness & Re-crawl Scheduling", depth: "advanced" },
    { id: "traps-robustness", label: "Crawler Traps & Robustness", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import WebCrawlerContent from "@/content/tutorials/web-crawler.mdx";` and `"web-crawler": WebCrawlerContent,` to the content map.

**Step 7:** Create `content/tutorials/web-crawler.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/web-crawler
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/web-crawler.mdx
git commit -m "feat: register web crawler tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3, then
installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered the embedded
components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<WebCrawlerCapacity assumptions={{ pagesToCrawl: 30000000000, crawlDays: 30, avgPageSizeKb: 100, pagesPerSecPerCrawler: 100, bytesPerUrlExact: 50, bloomBitsPerUrl: 10 }} />` then read off the ordinary-fetch-throughput / seen-set-is-the-problem (bloom filter ~40×) / multi-petabyte-corpus lessons.
- `entity-model` — `EntityModel name="CrawlUrl"` (url, url_hash, host, priority, status, last_crawled, next_crawl, depth) + prose on the Robots record, the Page/Content record (fingerprint/simhash), per-host crawl state, dedup-by-url_hash (bloom filter), partition-by-host.
- `api-design` — `ApiContract` for `POST /seeds`, `GET /frontier/next`, `GET /pages/{url_hash}`.
- `high-level-architecture` — `<WebCrawlerArchitecture />` + component prose.
- `detailed-flows` — `<FetchPageSequence />`, `<DedupCheckSequence />`, `<PolitenessSequence />`, `<RecrawlSequence />` with prose.
- deep dives `url-frontier`, `politeness`, `dedup`, `dns-fetching`, `freshness-scheduling`, `traps-robustness` per spec, with a `<KnowledgeCheck>` in url-frontier, politeness, dedup, dns-fetching, and freshness-scheduling.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- Cross-reference the Distributed Job Scheduler (freshness re-crawl scheduling). ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/web-crawler-content.test.ts` (mirror `tests/api-gateway-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<WebCrawlerCapacity`, `<WebCrawlerArchitecture`, and the four sequences `<FetchPageSequence`, `<DedupCheckSequence`, `<PolitenessSequence`, `<RecrawlSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real embeds
and generates `/learn/web-crawler`) all green. Commit `content: complete web crawler tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 18), and run full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 19 to 18 (fifteen
tutorials now available — verify the current value is 19 first) and add:
```ts
test("learner can open the web crawler tutorial", async ({ page }) => {
  await page.goto("/learn/web-crawler");
  await expect(
    page.getByRole("heading", { name: /design a web crawler/i }),
  ).toBeVisible();
  await page.goto("/learn/web-crawler#url-frontier");
  await expect(page.locator("#url-frontier")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /web crawler architecture/i }).first(),
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

**Step 4:** Commit `test: verify web crawler tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/api-gateway.mdx` and `distributed-job-scheduler.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — fetched page / store page / write), `redirect` (green — next URL / response), `async` (violet dashed — enqueue new URLs / schedule recrawl), `control` (amber dashed — check robots / check seen / drop / throttle), `muted` (telemetry dotted — DNS resolve), `ingress` (plain — seed URLs). Node kinds: `infra` for the seeds, `queue` for the frontier, `service` for the fetcher/parser/scheduler, `cache` for DNS, `store` for the robots cache, seen-set, and content store.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "bloom filter" in the caption only; the seen-set node is "Seen-Set" / "URL dedup"; not in the title). All four flow titles render into one test DOM — keep the keywords "fetch"/"dedup"/"polite"/"recrawl" mutually exclusive across titles, and DO NOT use bare "crawl" (it's a substring of "recrawl").
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/web-crawler-estimates.test.ts`.
- **web-crawler is seq 7 — it INSERTS early** in the curriculum available-by-sequence ordering (after api-gateway seq 6, before video-streaming seq 11). The curriculum total is 33 (unchanged); do not touch the 33 count assertions. **The registry test's "unregistered" slug must move from `web-crawler` to `search-autocomplete`.**
- **No flow/diagram name collisions:** `FetchPageSequence`, `DedupCheckSequence`, `PolitenessSequence`, `RecrawlSequence`, `WebCrawlerArchitecture`, `WebCrawlerCapacity` are all unique exports — no aliasing needed in `mdx-components.tsx`.
```
