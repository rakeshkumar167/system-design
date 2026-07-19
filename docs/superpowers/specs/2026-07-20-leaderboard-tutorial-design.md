# Leaderboard Tutorial — Design Spec

**Date:** 2026-07-20
**Status:** Approved for planning
**Problem:** `leaderboard` (curriculum sequence 32, difficulty **Intermediate**)

## Goal

Author the **Leaderboard** curriculum tutorial (`/learn/leaderboard`) following the tutorial playbook:
an interview-grade, 18-section walkthrough. The reframe: ranking players *looks* like `ORDER BY score
DESC LIMIT 10`, but the hard part is doing it **in real time at massive scale** while serving both
**top-K** *and* **an arbitrary player's exact rank** ("you're #4,271,908") — which a naive
`COUNT(*) WHERE score > x` recomputes with an O(N) scan per query. The centerpiece is the **sorted set**
(Redis ZSET / skip list) that maintains order incrementally for **O(log N)** updates and rank queries;
the scaling problem is then computing **global rank across shards** and materializing **time-windowed**
boards, with a durable store behind the in-memory index.

Concepts (from curriculum): **Sorted sets, Ranking, Sharding, Real-time updates**.

## Section Outline (18 sections)

Standard spine + 6 problem-specific deep dives (8–13). Section `id`s must match the MDX `<h2 id>` and
the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `sorted-sets` | Sorted Sets: The Core Data Structure | advanced |
| 9 | `score-updates` | Real-Time Score Updates | advanced |
| 10 | `rank-queries` | Top-K & Rank Queries | advanced |
| 11 | `sharding-scale` | Sharding & Approximate Rank | advanced |
| 12 | `time-windows` | Time-Windowed Leaderboards | advanced |
| 13 | `persistence-truth` | Persistence & the Source of Truth | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: `ORDER BY` is trivial for a thousand players; the design is **real-time
   ranking at scale** with two query shapes — **top-K** (cheap) and **arbitrary per-player rank**
   (expensive if scanned). Lead with the sorted set. `Callout variant="interview"` with 45-min plan.
2. **Requirements** — functional: submit/increment a score, get top-K, get a player's rank + neighbors,
   time-windowed boards. Non-functional: low latency (tens of ms), high write + higher read QPS,
   real-time freshness, **relaxed consistency** (approximate rank acceptable at scale), durability of
   scores. `RequirementsTable`.
3. **Capacity** — `LeaderboardCapacity`. Lesson: the board is **tiny** (~5 GB fits in RAM), and
   **O(log N)** ops let a node absorb huge throughput, so the system is bound by **ops/sec (reads
   dominate)**, not storage — a small replicated fleet suffices.
4. **Entity Model** — `Player` / score entry; the **sorted set is a derived in-memory index**, the
   **DB is the durable source of truth**. `EntityModel`.
5. **API Design** — `POST /scores` (submit/increment), `GET /leaderboard/top`, `GET
   /leaderboard/rank/{playerId}` (rank + neighbors). Three `ApiContract`s.
6. **High-Level Architecture** — `LeaderboardArchitecture` HLD: game client → leaderboard service →
   sorted set (Redis) for O(log N) update/rank + top-K cache; async stream → durable DB; rebuild path.
7. **Detailed Flows** — four sequences (below).
8. **Sorted Sets** — the centerpiece: a **skip list** (Redis ZSET) keeps members ordered by score;
   `ZADD`/`ZINCRBY` update in **O(log N)**, `ZREVRANGE` reads top-K in **O(log N + K)**, `ZREVRANK`
   returns a member's rank in **O(log N)**. Contrast with a B-tree/SQL scan. `KnowledgeCheck`.
9. **Real-Time Score Updates** — the write path: `ZINCRBY` for deltas, idempotency for "set high
   score", **hot keys** (a viral board) mitigated by sharding/replication, write-through vs write-behind
   to the DB. `KnowledgeCheck`.
10. **Top-K & Rank Queries** — the two read shapes: top-K via `ZREVRANGE 0 K-1`; a player's own rank via
    `ZREVRANK` plus `ZREVRANGE` around it for **neighbors** ("#4,271,906–910"). Both O(log N). Cache the
    hot top-K. `KnowledgeCheck`.
11. **Sharding & Approximate Rank** — when one ZSET is too big/hot, shard by player (hash). Top-K =
    merge each shard's local top-K (cheap). **Exact global rank is the hard problem**: a member's rank
    needs "how many players scored higher" *across all shards* — fan-out `ZCOUNT(score, +inf)` per shard
    and sum, or precompute a **score-bucket histogram** for an **approximate** rank (the standard
    trade). `KnowledgeCheck`. Embed `<ShardedRankSequence />`.
12. **Time-Windowed Leaderboards** — daily/weekly/all-time as **separate keyed ZSETs** (`board:daily:
    2026-07-20`) with **TTL**; each score fans out to the active windows; rolling windows and the write
    amplification. `KnowledgeCheck` may live here.
13. **Persistence & the Source of Truth** — Redis is the fast **index**, not the system of record: every
    score is durably written to a **DB** (async stream / write-behind), so a Redis loss is recovered by
    **rebuilding the ZSET from the DB**. `Callout`. `KnowledgeCheck`.
14. **Scalability & Evolution** — staged `TradeoffTable` (SQL `ORDER BY` → single Redis ZSET →
    replicated ZSET + cache + DB → sharded + approximate rank + time windows).
15. **Resiliency & Failure Modes** — `FailureMatrix` (Redis node loss, rebuild from DB, hot board,
    stale/lag, shard imbalance, duplicate score submission, DB write lag).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (sorted set vs SQL; exact vs approximate
    rank; write-through vs write-behind; per-window ZSETs vs one).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>` total across the tutorial; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `SubmitScoreSequence` — client submits a score → service `ZINCRBY` into the sorted set (O(log N)) →
  emits a score event to the stream → stream persists to the durable DB → ack. Caption: the write
  updates the in-memory index synchronously and durably records to the DB asynchronously.
- `TopKQuerySequence` — client requests the top 10 → service checks the top-K cache → on miss
  `ZREVRANGE 0 9` from the sorted set → populate cache → return. Caption: top-K is an O(log N + K) range
  read, cached because it's the hottest and most shared query.
- `PlayerRankSequence` — client requests a player's rank → service `ZREVRANK(player)` for the exact
  rank (O(log N)) → `ZREVRANGE` around that rank for neighbors → return "you're #N" plus surrounding
  players. Caption: a sorted set answers an arbitrary member's rank directly, no scan.
- `ShardedRankSequence` — global rank across shards → coordinator fans out "count scores above S" to
  each shard (`ZCOUNT`) → sums the partial counts → returns an approximate global rank (Σ + 1). Caption:
  exact cross-shard rank needs a fan-out count; a bucket histogram approximates it cheaply.

## Capacity Model (exact)

`lib/leaderboard-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_GB =
1_000_000_000`.

Assumptions (MDX embed and test):
```ts
{
  players: 50_000_000,
  bytesPerEntry: 100,
  scoreUpdatesPerDay: 5_000_000_000,
  readsPerUpdate: 10,
  opsPerNode: 100_000,
}
```

Results:
- `updateQps` = 5e9 / 86,400 ≈ **57,870.37** /s
- `readQps` = updateQps × 10 ≈ **578,703.70** /s
- `totalOpsQps` = updateQps + readQps ≈ **636,574.07** /s
- `leaderboardMemoryGb` = 50,000,000 × 100 / 1e9 = **5** GB
- `nodesForThroughput` = ceil(636,574.07 / 100,000) = **7**

Lesson: 50M players is only ~**5 GB** — the ranked set fits comfortably in RAM, so **storage is never
the constraint**. Because sorted-set operations are **O(log N)**, a single node sustains ~100k ops/s, so
the system is sized by **throughput (reads dominate ~10:1)**, not data volume — ~**7 nodes** of an
in-memory, replicated sorted set carry it. The interesting scaling problems are **hot boards**,
**cross-shard global rank**, and **time-window fan-out**, not raw storage.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (via
wrapper), diagram primitives, `TutorialLayout`.

New: `lib/leaderboard-estimates.ts` + `tests/leaderboard-estimates.test.ts`;
`components/learning/leaderboard-capacity.tsx` (`LeaderboardCapacity`);
`components/diagrams/leaderboard-architecture.tsx` (`LeaderboardArchitecture`);
`components/diagrams/leaderboard-flows.tsx` (`SubmitScoreSequence`, `TopKQuerySequence`,
`PlayerRankSequence`, `ShardedRankSequence`). Register all in `mdx-components.tsx`.

Wiring: `lib/tutorial-registry.ts` entry (18 sections); `lib/curriculum.ts` flip `leaderboard` →
`available`; `app/learn/[slug]/page.tsx` import + map; `content/tutorials/leaderboard.mdx`;
`tests/tutorial-registry.test.ts` (add leaderboard to the registered set + a 18-section assertion);
`tests/curriculum.test.ts` (append `leaderboard` to the available list — it's sequence 32, so last);
`tests/leaderboard-content.test.ts`; extend `e2e/pilot.spec.ts` and **decrement the "coming soon"
count by one** (currently 15 → 14).

## Invariants

- A **sorted set** (skip list) gives **O(log N)** updates (`ZADD`/`ZINCRBY`), top-K (`ZREVRANGE`,
  O(log N + K)), and arbitrary rank (`ZREVRANK`, O(log N)) — the reason SQL `ORDER BY`/`COUNT` doesn't
  scale for per-player rank.
- Redis ZSET is the **in-memory derived index**; the **DB is the durable source of truth**; recover by
  **rebuilding the ZSET from the DB**.
- At scale: **top-K shards cheaply** (merge per-shard top-K); **exact global rank is expensive**
  (cross-shard count) → **approximate** with score-bucket histograms.
- Time windows = **separate keyed ZSETs with TTL**; scores fan out to active windows.
- Capacity: ~5 GB (fits RAM), ~636k ops/s, ~7 nodes — **throughput-bound (reads dominate), not
  storage-bound**.

## Commit sequence

1. `docs: design spec and plan for Leaderboard tutorial`
2. `feat: add Leaderboard capacity model and wrapper`
3. `feat: add Leaderboard architecture and flow diagrams`
4. `feat: register Leaderboard tutorial route and skeleton`
5. `content: complete Leaderboard tutorial`
6. `test: verify Leaderboard tutorial flow end-to-end`
