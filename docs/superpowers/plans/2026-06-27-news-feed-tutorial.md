# News Feed Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the seventeenth complete curriculum tutorial — an Advanced, fan-out/feed-aggregation
walkthrough of a **News Feed**: fan-out on write vs read, the hybrid model and hot users, feed ranking,
feed storage + hydration + caching, the async fan-out pipeline, and the read path (pagination,
freshness) — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the
first sixteen tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram,
four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing
themes are **fan-out-on-write vs read**, the **hybrid/hot-user** model, **feed ranking**, **feed
storage + hydration**, the **async fan-out pipeline**, and the **read path**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9,
Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the sixteen existing tutorials.
- Invariants: a news feed is a personalized, **ranked** timeline of posts from **followed** accounts; naive **read-time aggregation (pull)** is too expensive, so feeds are **precomputed by fan-out-on-write (push)** into per-user feeds (a read = **O(1) cache lookup**); **fan-out write amplification** = posts/sec × avg followers ≈ **1.74M writes/sec** (~**300×** the ~5.8k posts/sec), feed reads ≈ **174k/sec**, ~**174 workers**, feeds store **post IDs** only (~**9.6 TB**) hydrated from a post store; **hot users/celebrities** break pure push (100M followers = 100M writes/post) → **hybrid** (push for ordinary accounts, **pull-and-merge** hot accounts at read time); **ranking** by relevance (affinity + recency + predicted engagement), not just chronological; fan-out is an **async queue/worker pipeline** (at-least-once + idempotent feed writes, echoing the Notification Service); feeds are **eventually consistent** and must always **render** (degrade to cached/stale/chronological).

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                    # MODIFY: register news-feed MDX
├── components/
│   ├── diagrams/
│   │   ├── news-feed-architecture.tsx           # NEW: HLD (client, post service, post store, fan-out, graph, queue, workers, feed cache, feed service)
│   │   └── news-feed-flows.tsx                   # NEW: publish-fanout / read-feed / hybrid-merge / feed-ranking sequences
│   └── learning/
│       └── news-feed-capacity.tsx                # NEW: wrapper over CapacityTable
├── content/tutorials/news-feed.mdx               # NEW: full tutorial content
├── lib/
│   ├── news-feed-estimates.ts                    # NEW: pure capacity calc
│   ├── tutorial-registry.ts                       # MODIFY: add news-feed entry (18 sections)
│   └── curriculum.ts                              # MODIFY: flip news-feed to available
├── mdx-components.tsx                             # MODIFY: register new components
├── tests/
│   ├── news-feed-estimates.test.ts               # NEW
│   ├── news-feed-content.test.ts                 # NEW
│   ├── diagrams.test.tsx                          # MODIFY: news-feed diagram assertions
│   ├── tutorial-registry.test.ts                 # MODIFY: seventeen tutorials; repoint undefined-slug to chat-system
│   └── curriculum.test.ts                         # MODIFY: seventeen available problems (news-feed inserts at seq 9)
└── e2e/pilot.spec.ts                             # MODIFY: news-feed flow + coming-soon count 17→16
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the News Feed capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/news-feed-estimates.ts`, `tests/news-feed-estimates.test.ts`, `components/learning/news-feed-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/news-feed-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateNewsFeedCapacity } from "@/lib/news-feed-estimates";

describe("calculateNewsFeedCapacity", () => {
  const result = calculateNewsFeedCapacity({
    dailyActiveUsers: 300_000_000,
    dailyPosts: 500_000_000,
    avgFollowers: 300,
    feedReadsPerUserPerDay: 50,
    feedLengthCached: 1_000,
    bytesPerFeedEntry: 32,
    fanoutWritesPerSecPerWorker: 10_000,
  });

  it("derives posts per second", () => {
    expect(result.postsPerSec).toBeCloseTo(5787.04, 1);
  });
  it("derives the fan-out write rate per second", () => {
    expect(result.fanoutWritesPerSec).toBeCloseTo(1736111.11, 1);
  });
  it("derives feed reads per second", () => {
    expect(result.feedReadsPerSec).toBeCloseTo(173611.11, 1);
  });
  it("derives the fan-out worker fleet size", () => {
    expect(result.fanoutWorkersNeeded).toBe(174);
  });
  it("derives feed storage in TB", () => {
    expect(result.feedStorageTb).toBe(9.6);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/news-feed-estimates.test.ts`.

**Step 3: Implement** `lib/news-feed-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface NewsFeedCapacityAssumptions {
  /** Daily active users who read their feed. */
  dailyActiveUsers: number;
  /** Total posts created per day across all users. */
  dailyPosts: number;
  /** Average followers per posting account (fan-out factor). */
  avgFollowers: number;
  /** Feed reads (opens/refreshes) per active user per day. */
  feedReadsPerUserPerDay: number;
  /** Entries kept in each user's precomputed feed. */
  feedLengthCached: number;
  /** Bytes per feed entry (post id + score + metadata). */
  bytesPerFeedEntry: number;
  /** Feed writes one fan-out worker sustains per second. */
  fanoutWritesPerSecPerWorker: number;
}

export interface NewsFeedCapacityResults {
  postsPerSec: number;
  fanoutWritesPerSec: number;
  feedReadsPerSec: number;
  fanoutWorkersNeeded: number;
  feedStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: posting is modest (~5.8k posts/sec), but
 * fan-out-on-write multiplies every post by its author's follower count into ~1.74M feed writes/sec
 * (~300×), making the feed a write-heavy system — the price of precomputation that turns each read into
 * a single cache lookup. Feeds store only post IDs (~9.6 TB) hydrated from a post store, and the
 * amplification is why celebrities break pure push, forcing the hybrid model.
 */
export function calculateNewsFeedCapacity(
  a: NewsFeedCapacityAssumptions,
): NewsFeedCapacityResults {
  const postsPerSec = a.dailyPosts / SECONDS_PER_DAY;
  const fanoutWritesPerSec = (a.dailyPosts * a.avgFollowers) / SECONDS_PER_DAY;
  const feedReadsPerSec = (a.dailyActiveUsers * a.feedReadsPerUserPerDay) / SECONDS_PER_DAY;
  const fanoutWorkersNeeded = Math.ceil(fanoutWritesPerSec / a.fanoutWritesPerSecPerWorker);
  const feedStorageTb =
    (a.dailyActiveUsers * a.feedLengthCached * a.bytesPerFeedEntry) / BYTES_PER_TB;

  return {
    postsPerSec,
    fanoutWritesPerSec,
    feedReadsPerSec,
    fanoutWorkersNeeded,
    feedStorageTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/news-feed-capacity.tsx`, mirroring
`components/learning/search-autocomplete-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateNewsFeedCapacity,
  type NewsFeedCapacityAssumptions,
} from "@/lib/news-feed-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function NewsFeedCapacity({
  assumptions,
}: {
  assumptions: NewsFeedCapacityAssumptions;
}) {
  const r = calculateNewsFeedCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Daily posts", value: fmt(assumptions.dailyPosts) },
    { label: "Avg followers", value: fmt(assumptions.avgFollowers) },
    { label: "Feed reads / user / day", value: fmt(assumptions.feedReadsPerUserPerDay) },
    { label: "Feed length cached", value: fmt(assumptions.feedLengthCached) },
    { label: "Bytes / feed entry", value: `${fmt(assumptions.bytesPerFeedEntry)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Posts / sec", value: `${fmt(r.postsPerSec)} /s`, consequence: "Posting itself is modest — the write load only explodes after fan-out." },
    { label: "Fan-out writes / sec", value: `${fmt(r.fanoutWritesPerSec)} /s`, consequence: "Each post is multiplied by its author's followers (~300×) — fan-out-on-write turns a read product into a write-heavy system." },
    { label: "Feed reads / sec", value: `${fmt(r.feedReadsPerSec)} /s`, consequence: "Reads are cheap — a single lookup of the precomputed feed — which is exactly what fan-out buys." },
    { label: "Fan-out workers", value: fmt(r.fanoutWorkersNeeded), consequence: "Sized by the fan-out write rate ÷ per-worker throughput; the async pipeline absorbs post spikes." },
    { label: "Feed storage", value: `${fmt(r.feedStorageTb, 1)} TB`, consequence: "Feeds store only post IDs (not content) in a distributed cache, hydrated from the post store at read time." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `NewsFeedCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/news-feed-estimates.test.ts tests/search-autocomplete-estimates.test.ts
npm run typecheck && npm run lint
git add lib/news-feed-estimates.ts tests/news-feed-estimates.test.ts components/learning/news-feed-capacity.tsx mdx-components.tsx
git commit -m "feat: add news feed capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/search-autocomplete-architecture.tsx` (HLD) and
`components/diagrams/search-autocomplete-flows.tsx` (sequences) — do not invent new SVG conventions.
Copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `search-autocomplete-flows.tsx` (or
`web-crawler-flows.tsx`) verbatim.

**Files:** Create `components/diagrams/news-feed-architecture.tsx`, `components/diagrams/news-feed-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { NewsFeedArchitecture } from "@/components/diagrams/news-feed-architecture";
import {
  PublishFanoutSequence,
  ReadFeedSequence,
  HybridMergeSequence,
  FeedRankingSequence,
} from "@/components/diagrams/news-feed-flows";

describe("NewsFeedArchitecture", () => {
  it("exposes the news feed architecture to non-visual readers", () => {
    render(<NewsFeedArchitecture />);
    expect(
      screen.getByRole("img", { name: /news feed architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/fan-out on write/i)).toBeInTheDocument();
  });
});

describe("news feed flow sequences", () => {
  it("renders the publish, read, hybrid, and ranking sequences", () => {
    render(<PublishFanoutSequence />);
    expect(screen.getByRole("img", { name: /publish/i })).toBeInTheDocument();
    render(<ReadFeedSequence />);
    expect(screen.getByRole("img", { name: /read/i })).toBeInTheDocument();
    render(<HybridMergeSequence />);
    expect(screen.getByRole("img", { name: /hybrid/i })).toBeInTheDocument();
    render(<FeedRankingSequence />);
    expect(screen.getByRole("img", { name: /ranking/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"fan-out on write"** in the **caption
only** — NOT as any single node's full label/sublabel text and NOT in the `DiagramFrame` title. Label
the fan-out node "Fan-out Service" with a sublabel like "push pipeline" (do NOT make a node's text
exactly "fan-out on write"). Also: all four flow titles render into the same test DOM in one test, so
each regex must match exactly one title — use distinct, mutually exclusive title keywords **"publish" /
"read" / "hybrid" / "ranking"**. CRITICAL: verify NO title contains another's keyword — e.g. the read
title must not contain "publish/hybrid/ranking", the ranking title must not contain "read" (avoid
phrasings like "read and rank"). Suggested titles: "Sequence: publish a post and fan it out" /
"Sequence: read a precomputed feed" / "Sequence: merge a hybrid feed for a hot-user follow" /
"Sequence: rank a feed by relevance" (note the last uses "rank ... ranking"? ensure the literal
substring "ranking" appears — title it "Sequence: feed ranking by relevance" so /ranking/i matches and
it contains none of publish/read/hybrid).

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `news-feed-architecture.tsx` exporting
`NewsFeedArchitecture`, following the `search-autocomplete-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before nodes,
a `Legend`). Two planes — the write/fan-out path and the read path:
- `Client` (external, sublabel "post / read") → `Post Service` (service, sublabel "ingest posts") via `ingress` ("new post").
- `Post Service` → `Post Store` (store, sublabel "posts + content") via `create` ("store post").
- `Post Service` → `Fan-out Service` (service, sublabel "push pipeline") via `async` ("trigger fan-out").
- `Fan-out Service` → `Social Graph` (store, sublabel "follow graph") via `control` ("get followers").
- `Fan-out Service` → `Fan-out Queue` (queue, sublabel "fan-out jobs") via `async` ("enqueue jobs").
- `Fan-out Queue` → `Fan-out Worker` (service, sublabel "write feeds") via `async` ("consume jobs").
- `Fan-out Worker` → `Feed Cache` (cache, sublabel "per-user feeds") via `create` ("push post id").
- `Client` → `Feed Service` (service, sublabel "read + hydrate") via `ingress` ("get feed").
- `Feed Service` → `Feed Cache` via `redirect` ("read feed ids").
- `Feed Service` → `Post Store` via `redirect` ("hydrate content").
- `title` contains "News Feed architecture"; `caption` names **fan-out on write** (the phrase verbatim,
  caption only), the **precomputed per-user feeds**, the **async fan-out pipeline** (queue + workers),
  and **read-time hydration** of post IDs from the post store, in prose.
- Node kinds: `external` for the client; `service` for post service, fan-out service, fan-out worker,
  feed service; `store` for the post store and social graph; `queue` for the fan-out queue; `cache` for
  the feed cache.
- Suggested geometry (viewBox `0 0 980 560`): write path across the top/middle — client {24,150} →
  postService {220,150} → postStore {430,90}; postService down to fanout {220,290} → graph {430,290}
  (control) and fanout → queue {430,370} → worker {640,370} → feedCache {820,290}; read path —
  feedService {640,150} ← client (a second ingress), feedService → feedCache and feedService →
  postStore. Adjust to avoid overlaps; `w` ≈ 150, `h` ≈ 56 (store/cache `h` ≈ 60). Keep the viewBox ≥
  the rightmost/bottom-most node. (Exact coordinates are the implementer's discretion as long as edges
  don't cross nodes and the layout reads cleanly; two `ingress` edges from the client are fine.)

**Step 4: Implement the flow sequences** `news-feed-flows.tsx`, exporting four components. Each `title`
contains the keyword the test matches; keep the four keywords mutually exclusive ("publish" / "read" /
"hybrid" / "ranking") and ensure no title contains another's keyword:
- `PublishFanoutSequence` — title contains "publish" (e.g. "Sequence: publish a post and fan it out"); actors Client, Post Service, Fan-out Worker, Feed Cache; steps: client creates a post, the post service stores it and triggers fan-out, a worker looks up the author's followers and writes the post ID into each follower's feed. Caption: the write path — a new post is stored once, then fan-out workers push its ID into every follower's precomputed feed (async, idempotent). Use `create` for store/push, `async` for the fan-out trigger, `control` for the follower lookup.
- `ReadFeedSequence` — title contains "read" and NOT publish/hybrid/ranking (e.g. "Sequence: read a precomputed feed"); actors Client, Feed Service, Feed Cache, Post Store; steps: client requests the feed, the feed service reads the precomputed post IDs from the feed cache, hydrates the post content from the post store, and returns a ranked page. Caption: the read path — the precomputed feed is a list of post IDs read in one lookup, then hydrated into full posts from the post store and returned as a page. Use `redirect` for the reads/returns, `create` for hydration if helpful (prefer `redirect`).
- `HybridMergeSequence` — title contains "hybrid" (e.g. "Sequence: merge a hybrid feed for a hot-user follow"); actors Feed Service, Feed Cache, Post Store; steps: the feed service reads the pushed (precomputed) feed, then pulls a hot/celebrity account's recent posts at read time, and merges + ranks the two into one feed. Caption: for a follower of a high-fan-out account, the service merges the pushed precomputed feed with pulled recent posts of the hot account at read time — the hybrid model that keeps pure push from exploding. Use `redirect` for reads, `control` for the merge/pull decision.
- `FeedRankingSequence` — title contains "ranking" and NOT publish/read/hybrid (e.g. "Sequence: feed ranking by relevance"); actors Feed Service, Post Store; steps: the service gathers candidate posts, scores each by affinity/recency/predicted-engagement, orders them, and returns the top. Caption: candidate posts are scored by relevance signals — affinity, recency, predicted engagement — and ordered, so the feed is ranked rather than purely chronological. Use `control` for scoring, `redirect` for fetch/return.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`). NOTE: the
export names `PublishFanoutSequence`, `ReadFeedSequence`, `HybridMergeSequence`, `FeedRankingSequence`,
`NewsFeedArchitecture`, `NewsFeedCapacity` are all unique across the repo — verify by grep that none
already exist in `mdx-components.tsx`; no aliasing is expected.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/news-feed-architecture.tsx components/diagrams/news-feed-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add news feed architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton with all
18 section ids, and update the existing "sixteen tutorials" tests to "seventeen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/news-feed.mdx` (skeleton).

IMPORTANT: there are currently SIXTEEN available tutorials. You add a SEVENTEENTH. `news-feed` is
**sequence 9**, which sits **between `search-autocomplete` (seq 8) and `video-streaming` (seq 11)** in
the curriculum's available-by-sequence ordering — so it **inserts early**. ALSO CRITICAL: `news-feed`
was the slug used by the registry test's "returns undefined for unregistered" case; since it is now
registered, that test must be repointed to a still-`coming-soon` slug — **`chat-system`** (seq 10).
Read each test file BEFORE editing to match its exact phrasing. The curriculum total is 33 — do NOT
change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all SEVENTEEN tutorials are registered. In the
sorted `Object.keys(tutorials)` array, `"news-feed"` sorts between `"maps-navigation"` and
`"notification-service"`. The new sorted array is:
`["api-gateway", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "news-feed", "notification-service", "pastebin", "payment-system", "rate-limiter", "search-autocomplete", "ticket-booking", "url-shortener", "video-streaming", "web-crawler"]`.
Add `expect(getTutorial("news-feed")?.sections).toHaveLength(18);` to the section-length test. Update
the two descriptive `it(...)` strings to mention News Feed. **CHANGE the "returns undefined for
unregistered" test from `getTutorial("news-feed")` to `getTutorial("chat-system")`** (chat-system is
still coming-soon and unregistered).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "web-crawler", "search-autocomplete", "news-feed", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(news-feed is seq 9 — it goes AFTER search-autocomplete and BEFORE video-streaming). Add
`expect(getProblem("news-feed")?.title).toBe("News Feed");`. Update the descriptive `it(...)` string. Do
NOT touch the 33 count/sequence assertions. **READ the test first** to confirm the exact existing array
(it should currently have sixteen entries ending with search-autocomplete inserted after web-crawler).

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `news-feed` entry `status` from `"coming-soon"` to
`"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"news-feed": {
  slug: "news-feed",
  title: "Design a News Feed",
  description:
    "An interview-grade walkthrough of a news feed (home timeline): fan-out on write vs read, the hybrid model for hot users (celebrities), relevance feed ranking, feed storage as post-ID lists hydrated from a post store, the asynchronous fan-out pipeline, the read path with pagination and freshness, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Fan-out strategies", "Ranking", "Hot users", "Caching"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "fanout-models", label: "Fan-out: Write vs Read", depth: "advanced" },
    { id: "hybrid-hot-users", label: "The Hybrid Model & Hot Users", depth: "advanced" },
    { id: "feed-ranking", label: "Feed Ranking", depth: "advanced" },
    { id: "feed-storage-hydration", label: "Feed Storage, Hydration & Caching", depth: "advanced" },
    { id: "fanout-pipeline", label: "The Fan-out Pipeline", depth: "advanced" },
    { id: "read-path-consistency", label: "Read Path: Pagination & Freshness", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add
`import NewsFeedContent from "@/content/tutorials/news-feed.mdx";` and
`"news-feed": NewsFeedContent,` to the content map.

**Step 7:** Create `content/tutorials/news-feed.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/news-feed
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/news-feed.mdx
git commit -m "feat: register news feed tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3, then
installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered the embedded
components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<NewsFeedCapacity assumptions={{ dailyActiveUsers: 300000000, dailyPosts: 500000000, avgFollowers: 300, feedReadsPerUserPerDay: 50, feedLengthCached: 1000, bytesPerFeedEntry: 32, fanoutWritesPerSecPerWorker: 10000 }} />` then read off the fan-out-amplification / cheap-reads / IDs-not-content / celebrities-break-push lessons.
- `entity-model` — `EntityModel name="Post"` (post_id, author_id, content, media_url, created_at, like_count, visibility) + prose on the FeedEntry (per-user list of post IDs + score), the Follow edge / social graph, and IDs-hydrated-from-post-store.
- `api-design` — `ApiContract` for `POST /posts`, `GET /feed`, `POST /follow/{userId}`.
- `high-level-architecture` — `<NewsFeedArchitecture />` + component prose.
- `detailed-flows` — `<PublishFanoutSequence />`, `<ReadFeedSequence />`, `<HybridMergeSequence />`, `<FeedRankingSequence />` with prose.
- deep dives `fanout-models`, `hybrid-hot-users`, `feed-ranking`, `feed-storage-hydration`, `fanout-pipeline`, `read-path-consistency` per spec, with a `<KnowledgeCheck>` in fanout-models, hybrid-hot-users, feed-ranking, feed-storage-hydration, and fanout-pipeline.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- Cross-reference the Notification Service (async fan-out queue/workers) and Search Autocomplete (precompute for fast reads). ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/news-feed-content.test.ts` (mirror `tests/search-autocomplete-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<NewsFeedCapacity`, `<NewsFeedArchitecture`, and the four sequences `<PublishFanoutSequence`, `<ReadFeedSequence`, `<HybridMergeSequence`, `<FeedRankingSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real embeds
and generates `/learn/news-feed`) all green. Commit `content: complete news feed tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 16), and run full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 17 to 16 (seventeen
tutorials now available — verify the current value is 17 first) and add:
```ts
test("learner can open the news feed tutorial", async ({ page }) => {
  await page.goto("/learn/news-feed");
  await expect(
    page.getByRole("heading", { name: /design a news feed/i }),
  ).toBeVisible();
  await page.goto("/learn/news-feed#fanout-models");
  await expect(page.locator("#fanout-models")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /news feed architecture/i }).first(),
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

**Step 4:** Commit `test: verify news feed tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/search-autocomplete.mdx` and `notification-service.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — store post / push post id), `redirect` (green — read feed ids / hydrate / return), `async` (violet dashed — trigger fan-out / enqueue / consume), `control` (amber dashed — get followers / merge decision / scoring), `muted` (telemetry), `ingress` (plain — new post / get feed). Node kinds: `external` for the client, `service` for post/fan-out/worker/feed services, `store` for the post store and social graph, `queue` for the fan-out queue, `cache` for the feed cache.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "fan-out on write" in the caption only — not as a node's full text, not in the title; the fan-out node is "Fan-out Service" / "push pipeline"). All four flow titles render into one test DOM — keep the keywords "publish"/"read"/"hybrid"/"ranking" mutually exclusive across titles (don't put "read" in the ranking title, etc.).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/news-feed-estimates.test.ts`.
- **news-feed is seq 9 — it INSERTS early** in the curriculum available-by-sequence ordering (after search-autocomplete seq 8, before video-streaming seq 11). The curriculum total is 33 (unchanged); do not touch the 33 count assertions. **The registry test's "unregistered" slug must move from `news-feed` to `chat-system`.**
- **No flow/diagram name collisions:** `PublishFanoutSequence`, `ReadFeedSequence`, `HybridMergeSequence`, `FeedRankingSequence`, `NewsFeedArchitecture`, `NewsFeedCapacity` are all unique exports — grep `mdx-components.tsx` to confirm before registering; no aliasing expected (unlike the autocomplete `IndexBuildSequence` case).
```
