# News Feed Tutorial — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Curriculum slug:** `news-feed` (sequence 9, Advanced)

## Goal

Author the seventeenth complete curriculum tutorial — and the first **fan-out / feed-aggregation**
one: an interview-grade walkthrough of designing a **News Feed** (the home timeline of Facebook,
Twitter/X, Instagram, LinkedIn) that, for each user, assembles and serves a ranked list of recent
posts from the accounts they follow — instantly, at billions-of-users read scale, while a moderate
stream of new posts fans out into an enormous volume of feed updates.

This is a change of shape from the prior tutorials. It *looks* like a database query — "select posts
from everyone I follow, order by time, limit 50" — and the point is to show that this **read-time
aggregation** is impossibly expensive at scale (a user follows hundreds of accounts spread across
many shards, and billions of users open their feed constantly), so the real design **precomputes each
user's feed by fanning out on write**: when someone posts, the system pushes that post into all of
their followers' precomputed feeds, trading a large write amplification for O(1) reads. That push
model then **breaks for celebrities** (a post by an account with 100M followers is 100M writes), which
forces a **hybrid** — push for normal accounts, pull-and-merge for high-fan-out accounts at read time
— plus **ranking** (modern feeds aren't chronological; they're relevance-ranked) and heavy **caching**.
The reframe: it looks like a query, but the query is impossible at scale — so you precompute feeds via
fan-out-on-write, go hybrid for hot users, rank for relevance, and store feeds as lists of post IDs
hydrated from a post store. It reuses the async fan-out queue/worker pattern from the **Notification
Service** and the precompute-for-fast-reads intuition from **Search Autocomplete**, but centers them
on *aggregating and ranking a personalized timeline at scale*.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry, learning
components, diagram primitives, shared `CapacityTable`). New work is news-feed-specific content, a
capacity module + wrapper, one architecture diagram, four flow-sequence diagrams, and the
registry/curriculum wiring.

## Framing & Scope

**What we design:** a system that, for each user, assembles a ranked feed of recent posts from the
accounts they follow, serves it instantly at massive read scale, and ingests new posts that must
appear in followers' feeds promptly. The defining tensions are:

- **Fan-out on write vs fan-out on read (the centerpiece)** — read-time aggregation (pull) is simple
  but does an expensive multi-source merge on every feed open; write-time fan-out (push) precomputes
  each follower's feed when a post is created, making reads a single cache lookup at the cost of
  enormous write amplification. The choice between them — and when to use each — is the heart of the
  design.
- **The hybrid model & hot users (celebrities)** — pure push collapses for accounts with millions of
  followers (one post = millions of writes, most into feeds of inactive users), so the system goes
  **hybrid**: push for ordinary accounts, and for high-fan-out accounts **pull** their recent posts at
  read time and **merge** them into the precomputed feed.
- **Ranking, storage, and the pipeline** — feeds are **relevance-ranked** (affinity, recency,
  predicted engagement), not just chronological; the precomputed feed stores **post IDs** (not
  content) in a fast cache, **hydrated** from a post store at read time; and the fan-out itself is an
  **async pipeline** (queue + workers) so posting stays fast.

**In scope:** fan-out on write vs read, the hybrid model and hot-user handling, feed ranking
(chronological vs relevance), feed storage + hydration + caching, the async fan-out pipeline, and the
read path (pagination, dedup, freshness/consistency) — plus scaling, failure modes, and trade-offs.
**Out of scope (mention, then set aside):** the post-composition / media-upload and the
**Notification Service** that also react to a post (separate systems), the ML ranking models
themselves beyond the signals they consume, the social-graph service's internals (we treat "who
follows whom" as a dependency), content moderation/spam beyond a mention, and direct messaging
(that's the Chat System).

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
| 8 | `fanout-models` | Fan-out: Write vs Read | advanced |
| 9 | `hybrid-hot-users` | The Hybrid Model & Hot Users | advanced |
| 10 | `feed-ranking` | Feed Ranking | advanced |
| 11 | `feed-storage-hydration` | Feed Storage, Hydration & Caching | advanced |
| 12 | `fanout-pipeline` | The Fan-out Pipeline | advanced |
| 13 | `read-path-consistency` | Read Path: Pagination & Freshness | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a news feed is (a personalized, ranked timeline of posts from accounts
   you follow). The reframe: it *looks* like a SQL query over followees ordered by time, but that
   read-time aggregation is impossible at scale, so you **precompute feeds via fan-out-on-write**, go
   **hybrid** for celebrities, **rank** for relevance, and store feeds as **post IDs hydrated** from a
   post store. Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: post content; follow/unfollow; fetch a ranked
   feed of followees' posts; paginate; see fresh posts promptly; (ranked, not just chronological).
   Non-functional: **read latency** (feed opens instantly), **read scale** (billions of feed reads),
   **write fan-out** (a post reaches all followers' feeds), **freshness** (posts appear within seconds),
   **availability** (feed must load — degrade to cached/stale over failing), **eventual consistency**
   acceptable.
3. **Capacity Estimates** — `NewsFeedCapacity` fed by `lib/news-feed-estimates.ts`. Derive **posts/sec**,
   **fan-out writes/sec** (posts × avg followers — the amplification headline), **feed reads/sec**,
   **fan-out worker fleet**, and **feed storage (TB)**. Headline: a modest ~5.8k posts/sec explodes via
   fan-out into ~**1.74M feed writes/sec** (~**300×**), turning a read product into a write-heavy
   system — the cost of making reads a single ~**174k/sec** cache lookup; feeds store only post IDs
   (~**9.6 TB** in a distributed cache), hydrated from a post store; celebrities (100M followers = 100M
   writes/post) break pure push → hybrid.
4. **Entity Model** — `EntityModel name="Post"` (post_id, author_id, content, media_url, created_at,
   like_count, visibility). Prose on the **FeedEntry** (the precomputed per-user list: user_id,
   post_id, score, inserted_at — stores IDs, not content), the **Follow** edge (the social graph
   dependency), and that the feed caches **post IDs** hydrated from the post store, with per-user feeds
   bounded in length.
5. **API Design** — `ApiContract`: `POST /posts` (create a post → triggers fan-out), `GET /feed`
   (read the ranked, paginated feed via a cursor), `POST /follow/{userId}` (follow — affects the graph
   and future fan-out). Emphasize the read endpoint is the hot path and the post endpoint kicks off an
   async pipeline.
6. **High-Level Architecture** — `NewsFeedArchitecture`: write path — client posts → post service →
   post store, and post service → fan-out service → (reads the follow graph) → fan-out queue → fan-out
   workers → write post IDs into followers' feed caches; read path — client → feed service → read
   precomputed feed (post IDs) from feed cache → hydrate content from post store → rank → return.
   Caption names fan-out-on-write, the precomputed per-user feeds, the async pipeline, and read-time
   hydration.
7. **Detailed Flows** — `PublishFanoutSequence` (post → store → get followers → enqueue → workers push
   post ID into each follower's feed), `ReadFeedSequence` (feed service reads precomputed feed IDs →
   hydrates post content → ranks → returns a page), `HybridMergeSequence` (for a user following a
   celebrity: read pushed feed + pull the celebrity's recent posts at read time + merge/rank),
   `FeedRankingSequence` (score candidate posts by affinity/recency/engagement and order them).
8. **Fan-out: Write vs Read** — the centerpiece. **Fan-out on read (pull)**: store posts once; at feed
   time, query all followees, merge and sort — simple and storage-cheap, but an expensive scatter-gather
   on every read; fine when reads are rare relative to the cost. **Fan-out on write (push)**: when a post
   is created, write it into every follower's precomputed feed, so a read is one cache lookup — fast
   reads at the cost of huge write amplification and wasted work for inactive followers. The trade is
   **read cost vs write cost**: feeds are read far more than written and must be instant, so push
   usually wins for the body of users. Include a `<KnowledgeCheck>`.
9. **The Hybrid Model & Hot Users** — pure push breaks for **celebrities**: an account with tens of
   millions of followers turns one post into tens of millions of feed writes, most landing in feeds of
   users who'll never read them, and creating a write spike. The fix is **hybrid**: push for ordinary
   accounts (most of everyone's feed), but for a small set of **high-fan-out accounts**, *don't* push —
   instead **pull** their recent posts at read time and **merge** them into the reader's precomputed
   feed. This bounds write amplification while keeping reads fast. Discuss the threshold (follower count)
   and that inactive-user feeds can be skipped/lazily built. Include a `<KnowledgeCheck>`.
10. **Feed Ranking** — modern feeds aren't chronological. After candidate posts are gathered (pushed +
    pulled), they're **ranked by relevance**: signals like **affinity** (how close the reader is to the
    author), **recency** (time-decay), **predicted engagement** (likelihood of like/comment/share), and
    content type — an "EdgeRank"-style scoring. Chronological is simpler and predictable; ranked drives
    engagement but adds a scoring step and complexity. The score is computed at read time over a
    bounded candidate set (or partly precomputed). Include a `<KnowledgeCheck>`.
11. **Feed Storage, Hydration & Caching** — the precomputed feed stores **post IDs** (plus a score),
    not post content — typically a per-user list in a fast in-memory store (e.g. Redis), **bounded** to
    the most recent N entries. At read time, the IDs are **hydrated** into full posts from a **post
    store / post cache** (content, author, media, counters), so a post edited or deleted is reflected
    once (not copied into millions of feeds). Hot posts and active-user feeds are cached aggressively.
    Include a `<KnowledgeCheck>`.
12. **The Fan-out Pipeline** — posting must stay fast, so fan-out is **asynchronous**: the post service
    persists the post and enqueues a fan-out job; **workers** consume the queue, look up the author's
    followers from the graph, and write the post ID into each follower's feed (batched, sharded by
    user). This decouples posting latency from fan-out cost and absorbs spikes — the same async
    queue/worker pattern as the **Notification Service**. At-least-once delivery + idempotent feed
    writes (dedup by post ID) keep retries safe. Include a `<KnowledgeCheck>`.
13. **Read Path: Pagination & Freshness** — reading a feed: fetch the precomputed (pushed) feed IDs,
    merge any pulled hot-user posts, hydrate, rank, and return a **page** via a **cursor** (stable
    pagination as new posts arrive). Handle **dedup** (don't repeat posts across pages), **already-seen**
    filtering, and **freshness** — feeds are **eventually consistent** (a just-created post may take a
    few seconds to fan out), which is an acceptable relaxation. The reader's own new posts can be
    injected immediately for a responsive feel.
14. **Scalability & Evolution** — `TradeoffTable`: pull (read-time SQL aggregation) → push
    (fan-out-on-write to precomputed feeds) → hybrid (push + pull for hot users) + ranking + caching →
    globally sharded feeds, ranked, with regional caches and a tuned hot-user threshold.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): fan-out worker dies (jobs re-leased from the
    queue; idempotent writes), fan-out lag/backlog (posts appear late; prioritize active users; serve
    stale), feed cache node loss (rebuild from post store + graph; degrade to pull), post store outage
    (reads fail to hydrate — serve cached), celebrity post spike (hybrid avoids the write storm; rate-
    limit fan-out), hot-user mis-threshold (some pushed that shouldn't be — monitor and reclassify),
    ranking service down (fall back to chronological). Guiding rule: **the feed must render — degrade to
    cached/stale/chronological rather than fail.**
16. **Trade-offs & Alternatives** — `DecisionRecord`: hybrid fan-out (push for most, pull-merge for hot
    users), relevance-ranked, feeds as post-ID lists hydrated from a post store, async fan-out pipeline,
    heavy caching, eventual consistency. Axes: push vs pull (read vs write cost), chronological vs
    ranked, store IDs vs denormalized content, strong vs eventual freshness.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared `CapacityTable`.

### New, news-feed-specific
- `lib/news-feed-estimates.ts` — pure capacity calc with typed
  `NewsFeedCapacityAssumptions` / `NewsFeedCapacityResults`.
- `components/learning/news-feed-capacity.tsx` — wrapper over `CapacityTable`, registered as
  `NewsFeedCapacity`.
- `components/diagrams/news-feed-architecture.tsx` — `NewsFeedArchitecture`. `role="img"` + caption
  naming fan-out-on-write, the precomputed per-user feeds, the async pipeline, and read-time hydration.
- `components/diagrams/news-feed-flows.tsx` — `PublishFanoutSequence`, `ReadFeedSequence`,
  `HybridMergeSequence`, `FeedRankingSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `news-feed` entry (18 sections).
- `lib/curriculum.ts` — flip `news-feed` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/news-feed.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the seventeenth slug's MDX.
- `tests/tutorial-registry.test.ts` — the "returns undefined for unregistered" slug must change from
  `news-feed` (now registered) to a still-`coming-soon` slug — **`chat-system`** (seq 10).

## Capacity Model (exact)

`lib/news-feed-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_TB = 1e12`.
Integer `fanoutWorkersNeeded` uses `Math.ceil`; float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  dailyActiveUsers: 300_000_000,
  dailyPosts: 500_000_000,
  avgFollowers: 300,
  feedReadsPerUserPerDay: 50,
  feedLengthCached: 1_000,
  bytesPerFeedEntry: 32,
  fanoutWritesPerSecPerWorker: 10_000,
}
```

Results (deterministic):
- `postsPerSec` = 500,000,000 / 86,400 ≈ **5,787.04** /s
- `fanoutWritesPerSec` = 500,000,000 × 300 / 86,400 ≈ **1,736,111.11** /s
- `feedReadsPerSec` = 300,000,000 × 50 / 86,400 ≈ **173,611.11** /s
- `fanoutWorkersNeeded` = ceil(fanoutWritesPerSec / 10,000) = ceil(173.61) = **174**
- `feedStorageTb` = 300,000,000 × 1,000 × 32 / 1e12 = **9.6** TB

Headline lesson: posting itself is modest — 500 million posts/day is only ~**5,787 posts/sec** — but
**fan-out-on-write multiplies every post by its author's follower count**, so at ~300 followers each it
explodes into ~**1,736,111 feed writes/sec** (~**300×** amplification), turning a read-oriented product
into a **write-heavy** system that needs ~**174 fan-out workers**. That is the price of precomputation:
in exchange, a feed read is a single cache lookup, so the ~**173,611 feed reads/sec** are cheap. The
precomputed feeds store only **post IDs** (~**9.6 TB** across a distributed cache for 300M users ×
1,000 entries × 32 B), hydrated from a separate post store at read time — never the post content
copied into millions of feeds. And the amplification is exactly why **celebrities break pure push**
(100M followers = 100M writes for one post), forcing the **hybrid** model. The system is hard because
of **fan-out write amplification and ranking**, not because reading a precomputed list is difficult.

## Numerical & Terminology Invariants

- A news feed is a **personalized, ranked** timeline of posts from **followed** accounts; the naive
  **read-time aggregation** (pull) is too expensive at scale, so feeds are **precomputed by
  fan-out-on-write** (push) into per-user feeds, making a read an **O(1) cache lookup**.
- **Fan-out write amplification:** posts/sec × avg followers ≈ **1.74M feed writes/sec** (~**300×** the
  ~5.8k posts/sec); feed reads ≈ **174k/sec**; ~**174 fan-out workers**; feeds store **post IDs** only,
  ~**9.6 TB**, hydrated from a post store.
- **Hot users (celebrities)** break pure push (100M followers = 100M writes/post), so the model is
  **hybrid**: push for ordinary accounts, **pull-and-merge** recent posts of high-fan-out accounts at
  read time.
- **Ranking** is by relevance (affinity + recency/time-decay + predicted engagement), not just
  chronological; the fan-out is an **async queue/worker pipeline** (at-least-once + idempotent feed
  writes), echoing the **Notification Service**.
- Feeds are **eventually consistent** (a post takes seconds to fan out); the feed must always **render**
  — degrade to cached/stale/chronological rather than fail.

## Out of Scope

The post-composition/media-upload pipeline and the Notification Service that also react to a post, the
ML ranking models beyond the signals they consume, the social-graph service internals, content
moderation/spam beyond a mention, direct messaging (the Chat System), and any change to other
tutorials.
