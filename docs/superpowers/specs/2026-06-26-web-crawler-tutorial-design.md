# Web Crawler Tutorial — Design Spec

**Date:** 2026-06-26
**Status:** Approved for planning
**Curriculum slug:** `web-crawler` (sequence 7, Advanced)

## Goal

Author the fifteenth complete curriculum tutorial — and the first **large-scale crawling /
graph-traversal** one: an interview-grade walkthrough of designing a **Web Crawler** (à la
Googlebot) that starts from seed URLs, downloads pages, extracts and follows their links, and
builds a multi-petabyte corpus — at billions-of-pages scale, while staying **polite** (never
hammering a server, obeying robots.txt), **deduplicating** an enormous URL space, and
**re-crawling** for freshness.

This is a change of shape from the prior tutorials. It *looks* like breadth-first search over the
web graph — fetch a page, extract its links, enqueue them, repeat — and the point is to show that
the *queue*, not the fetching, is the entire problem. The **URL frontier** must enforce
**politeness** (per-host rate limits so the crawler doesn't act like a denial-of-service attack)
and **priority** (crawl important and fresh pages first) across a distributed fleet; the
**seen-URL set** is so large that storing it exactly is infeasible, forcing a probabilistic
**bloom filter**; the crawler must detect **duplicate content** (many URLs, identical or
near-identical pages) and survive **traps** (infinite URL spaces). It reuses the queue/worker
pattern and hashing/dedup intuition from earlier tutorials, but centers them on *politely
traversing the web graph at scale*.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is crawler-specific
content, a capacity module + wrapper, one architecture diagram, four flow-sequence diagrams, and
the registry/curriculum wiring.

## Framing & Scope

**What we design:** a system that, given seed URLs, crawls the web — downloading pages, extracting
links, and storing content — at scale, politely, without redoing work. The defining tensions are:

- **The URL frontier: priority + politeness (the centerpiece)** — the frontier is not a simple
  FIFO queue; it must order URLs by **priority** (important/fresh pages first) while enforcing
  **politeness** (no more than one in-flight request per host, with a crawl delay), which the
  classic Mercator design solves with a two-level structure: **front queues** for priority and
  **back queues** each dedicated to a single host for politeness.
- **Deduplication at web scale (bloom filters + fingerprints)** — most links you discover you've
  already seen, so a **seen-URL set** of tens of billions of entries is required; storing it
  exactly is terabytes, so a **bloom filter** (probabilistic, ~bits per URL) is the only practical
  structure. Separately, **content dedup** (content hashes for exact duplicates, **simhash** for
  near-duplicates) avoids storing the same page reached by many URLs.
- **Politeness, freshness, and robustness** — obey **robots.txt** and per-host crawl delays
  (cached); **re-crawl** pages on a freshness schedule tuned to how often each changes; and survive
  **crawler traps** (calendars, infinite query-string spaces) and malformed pages.

**In scope:** the URL frontier (priority + politeness queues), robots.txt and per-host politeness,
URL and content deduplication, DNS resolution and fetching at scale, freshness / re-crawl
scheduling, and crawler traps / robustness — plus scaling, failure modes, and trade-offs. **Out of
scope (mention, then set aside):** the search index / ranking that *consumes* the crawled corpus
(that's a separate system — Search Autocomplete and a full search engine are other problems),
JavaScript rendering / headless-browser crawling beyond a mention, the precise content-extraction
/ boilerplate-removal pipeline, and focused/topical crawling policy beyond prioritization.

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
| 8 | `url-frontier` | The URL Frontier | advanced |
| 9 | `politeness` | Politeness & robots.txt | advanced |
| 10 | `dedup` | URL & Content Deduplication | advanced |
| 11 | `dns-fetching` | DNS Resolution & Fetching | advanced |
| 12 | `freshness-scheduling` | Freshness & Re-crawl Scheduling | advanced |
| 13 | `traps-robustness` | Crawler Traps & Robustness | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a web crawler is and why it exists (build a corpus for search/
   archiving by traversing the web graph from seeds). The reframe: it *looks* like BFS with a
   queue, but the queue is the whole problem — a priority-and-politeness **URL frontier** across a
   distributed fleet, a **seen-set** too big to store exactly (bloom filter), content dedup, and
   trap survival. Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: crawl from seed URLs; extract and follow
   links; store page content; respect robots.txt; re-crawl for freshness; deduplicate. Non-
   functional: **scale** (billions of pages), **politeness** (never overload a host), **dedup
   efficiency**, **freshness** (re-crawl by change rate), **robustness** (traps, bad pages, failures),
   **extensibility** (pluggable parsers). Eventual/best-effort coverage is acceptable.
3. **Capacity Estimates** — `WebCrawlerCapacity` fed by `lib/web-crawler-estimates.ts`. Derive
   **crawl rate (pages/sec)**, **fetcher fleet size**, **bandwidth (Gbps)**, **exact seen-set size
   (TB)** vs **bloom-filter size (GB)**, and **content storage (PB)**. Headline: crawling tens of
   billions of pages in a month needs ~11.6k pages/sec and ~9 Gbps sustained; the seen-set is the
   signature problem — 1.5 TB exact vs 37.5 GB as a bloom filter (~40× smaller), the only way to
   dedup at scale; and the corpus is multi-petabyte.
4. **Entity Model** — `EntityModel name="CrawlUrl"` (url, url_hash, host, priority, status,
   last_crawled, next_crawl, depth). Prose on the **Robots record** (per-host rules + crawl-delay,
   cached with TTL), the **Page/Content record** (fetched bytes + content fingerprint / simhash for
   near-dup), the **per-host crawl state** (last fetch time for politeness), and that URLs are
   **deduped by url_hash** (bloom filter) and **partitioned by host** (so one worker owns a host and
   politeness is local).
5. **API Design** — `ApiContract`: `POST /seeds` (submit seed URLs), `GET /frontier/next` (internal:
   a fetcher pulls the next politely-available URL), and `GET /pages/{url_hash}` (inspect a crawled
   page's metadata/status). Emphasize that the "API" is mostly internal component contracts plus seed
   submission, not a public request/response service.
6. **High-Level Architecture** — `WebCrawlerArchitecture`: seeds → URL frontier (priority +
   politeness) → fetcher (DNS resolve, robots check, download) → parser (extract links) → dedup
   (bloom-filter seen-set) → back to the frontier; fetcher → content store; a scheduler re-enqueues
   for freshness. Caption names the frontier, the fetch→parse→dedup loop, the bloom-filter seen-set,
   robots politeness, and re-crawl scheduling.
7. **Detailed Flows** — `FetchPageSequence` (frontier → fetch → parse → extract links → store),
   `DedupCheckSequence` (a discovered URL checked against the bloom filter; seen → drop, new → add +
   enqueue), `PolitenessSequence` (before fetching a host: check cached robots.txt + enforce crawl
   delay), `RecrawlSequence` (scheduler decides a page is due and re-enqueues it).
8. **The URL Frontier** — the centerpiece deep dive: why a plain FIFO fails (no priority, no
   politeness); the **two-level Mercator design** — **front queues** select by priority, **back
   queues** are each pinned to one host so only one request per host is in flight, with a heap timing
   when each host may next be hit; how the frontier is sharded across the fleet by host. Include a
   `<KnowledgeCheck>`.
9. **Politeness & robots.txt** — being a good citizen: fetch and cache **robots.txt** per host
   (respect disallow rules and `Crawl-delay`), space requests with a per-host delay, identify via a
   `User-Agent`, and cap concurrency per host/domain. Why politeness is structural (one host per back
   queue) not just a sleep. Include a `<KnowledgeCheck>`.
10. **URL & Content Deduplication** — two distinct dedup problems. **URL dedup**: a seen-set of tens
    of billions of URLs, stored as a **bloom filter** (probabilistic, ~10 bits/URL, rare false
    positives that cost a skipped page) because exact storage is terabytes. **Content dedup**: exact
    duplicates via a content hash, **near-duplicates** via **simhash/minhash** fingerprints, so the
    same page reached by many URLs isn't stored or re-processed repeatedly. Include a `<KnowledgeCheck>`.
11. **DNS Resolution & Fetching** — DNS is a surprising bottleneck (a lookup per host), so resolve
    asynchronously and **cache** aggressively; fetching is massively concurrent I/O (thousands of
    simultaneous connections), so it's async/non-blocking; handle timeouts, redirects, large pages,
    and content-type limits. Include a `<KnowledgeCheck>`.
12. **Freshness & Re-crawl Scheduling** — the web changes, and you can't crawl everything equally
    often, so re-crawl on a schedule tuned to each page's **change frequency** (news vs an archived
    doc) and importance; estimate change rate from history; balance freshness against capacity. A
    nod to the Distributed Job Scheduler for the time-triggered re-enqueue.
13. **Crawler Traps & Robustness** — surviving the hostile parts of the web: **traps** (infinite
    calendars, session-id/query-string explosions, deep generated link mazes) mitigated by depth
    limits, URL-pattern caps, and per-host budgets; malformed/huge pages; soft-404s; and graceful
    handling of failures and re-tries.
14. **Scalability & Evolution** — `TradeoffTable`: single-threaded crawler → multi-threaded single
    box → distributed fetchers + sharded frontier + bloom-filter seen-set → globally distributed,
    politeness-partitioned crawl with tiered storage.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): fetcher node dies (frontier re-leases its
    URLs), frontier/seen-set node loss (sharded + replicated; bloom filter rebuildable), politeness
    violation risk (per-host back queues + delays), crawler trap (depth/pattern/budget caps), DNS
    outage (cache + retry), poison/huge page (timeouts + size caps), content-store outage (buffer +
    retry).
16. **Trade-offs & Alternatives** — `DecisionRecord`: sharded priority+politeness frontier +
    bloom-filter seen-set + content fingerprints + freshness scheduling; axes: BFS vs priority
    crawling, exact seen-set vs bloom filter (false positives), politeness vs throughput, breadth vs
    freshness (coverage vs re-crawl).
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared
`CapacityTable`.

### New, crawler-specific
- `lib/web-crawler-estimates.ts` — pure capacity calc with typed
  `WebCrawlerCapacityAssumptions` / `WebCrawlerCapacityResults`.
- `components/learning/web-crawler-capacity.tsx` — wrapper over `CapacityTable`, registered as
  `WebCrawlerCapacity`.
- `components/diagrams/web-crawler-architecture.tsx` — `WebCrawlerArchitecture`. `role="img"` +
  caption naming the frontier, the fetch→parse→dedup loop, the bloom-filter seen-set, and robots
  politeness.
- `components/diagrams/web-crawler-flows.tsx` — `FetchPageSequence`, `DedupCheckSequence`,
  `PolitenessSequence`, `RecrawlSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `web-crawler` entry (18 sections).
- `lib/curriculum.ts` — flip `web-crawler` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/web-crawler.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the fifteenth slug's MDX.
- `tests/tutorial-registry.test.ts` — the "returns undefined for unregistered" slug must change from
  `web-crawler` (now registered) to `search-autocomplete` (still coming-soon).

## Capacity Model (exact)

`lib/web-crawler-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_TB = 1e12`,
`BYTES_PER_GB = 1e9`. Integer `crawlersNeeded` uses `Math.ceil`; float-derived results use
`toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  pagesToCrawl: 30_000_000_000,
  crawlDays: 30,
  avgPageSizeKb: 100,
  pagesPerSecPerCrawler: 100,
  bytesPerUrlExact: 50,
  bloomBitsPerUrl: 10,
}
```

Results (deterministic):
- `avgCrawlRatePps` = 30,000,000,000 / (30 × 86,400) ≈ **11,574.07** pages/sec
- `crawlersNeeded` = ceil(avgCrawlRatePps / 100) = ceil(115.74) = **116**
- `bandwidthGbps` = avgCrawlRatePps × 100 KB × 1000 × 8 / 1e9 ≈ **9.26** Gbps
- `exactSeenSetTb` = 30,000,000,000 × 50 / 1e12 = **1.5** TB
- `bloomFilterGb` = 30,000,000,000 × 10 / 8 / 1e9 = **37.5** GB
- `contentStoragePb` = 30,000,000,000 × 100 KB × 1000 / 1e15 = **3** PB

Headline lesson: crawling **30 billion pages in 30 days** means a sustained ~**11,574 pages/sec**,
needing ~**116 fetcher nodes** and ~**9.26 Gbps** of bandwidth — so fetching is a real but ordinary
throughput problem. The *signature* number is the **seen-set**: tracking which of tens of billions of
URLs you've already crawled costs ~**1.5 TB** stored exactly (too big to keep in memory per node), but
only ~**37.5 GB** as a **bloom filter** — a ~**40× reduction** at the cost of rare false positives
(occasionally skipping a page you haven't actually seen), which is the only practical way to dedup at
this scale. And the corpus itself is ~**3 PB**, stored in a distributed blob store. The crawler is hard
because of the *frontier and the seen-set*, not the act of downloading a page.

## Numerical & Terminology Invariants

- The crawler traverses the web graph from **seed URLs**; the **URL frontier** is a priority +
  politeness queue, not a FIFO — the **Mercator** two-level design uses **front queues** (priority)
  and per-host **back queues** (politeness: one in-flight request per host).
- **Politeness** = obey **robots.txt** (cached per host) and a per-host **crawl delay**; identify via
  `User-Agent`; politeness is enforced structurally (one host per back queue), not by ad-hoc sleeps.
- The **seen-URL set** is too large to store exactly (~1.5 TB), so it's a **bloom filter** (~37.5 GB,
  ~10 bits/URL) accepting rare false positives. **Content dedup** uses content hashes (exact) and
  **simhash/minhash** (near-duplicate).
- **DNS** is a bottleneck → resolve async and **cache**; **fetching** is massively concurrent async I/O.
- **Freshness**: re-crawl on a schedule tuned to each page's **change rate** and importance; you can't
  crawl everything equally often.
- **Traps** (infinite/generated URL spaces) are bounded by **depth limits, URL-pattern caps, and
  per-host budgets**. The corpus is multi-petabyte in a distributed store.

## Out of Scope

The search index / ranking that consumes the corpus, JavaScript / headless-browser rendering beyond a
mention, the boilerplate-removal/content-extraction pipeline internals, focused/topical crawling policy
beyond prioritization, and any change to other tutorials.
