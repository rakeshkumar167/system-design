# Distributed Cache Tutorial — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Curriculum slug:** `distributed-cache` (sequence 5, Intermediate)

## Goal

Author the eighth complete curriculum tutorial — and the first **partitioned in-memory
data-plane** one: an interview-grade walkthrough of designing a **Distributed Cache**
(Memcached/Redis-cluster-style) that spreads a hot working set across many in-memory
nodes, survives node churn without reshuffling the whole keyspace, evicts under memory
pressure, and shields a slow backing store from a flood of reads.

This is a deliberate change of shape from the prior tutorials. It is the simplest
*looking* problem — get/set by key — and the point is to show why "distributed" makes a
hash map hard: **consistent hashing** so adding or losing a node moves a minimal slice
of keys, **eviction** so bounded memory holds the right items, **replication** for
availability and read scale, and two failure modes that bite every cache in production —
**hot keys** and **cache stampede**. It also revisits caching from the URL Shortener and
Pastebin tutorials, but from the inside: this time the cache *is* the system.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed
registry, learning components, diagram primitives, shared `CapacityTable`). New work is
distributed-cache-specific content, a capacity module + wrapper, one architecture diagram,
four flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a sharded, replicated, in-memory key/value cache that sits in front of
a slower backing store, serving reads at sub-millisecond latency and very high QPS. The
defining tensions are:

- **Partitioning the keyspace cheaply under churn** — keys must spread evenly across
  nodes, and when a node is added or fails, only a small fraction of keys should move, or
  every membership change becomes a mass cache miss. Naive `hash(key) % N` reshuffles
  almost everything; **consistent hashing** (with virtual nodes) is the fix.
- **Bounded memory** — a cache is deliberately smaller than the dataset, so it must
  **evict**; which items to keep (LRU/LFU/TTL) determines the hit ratio, which is the
  whole economic point of the cache.
- **Failure modes unique to caches** — a single **hot key** can overwhelm one node, and a
  popular key expiring can trigger a **stampede** (thundering herd) of concurrent misses
  that crushes the backing store. The design must tame both.

**In scope:** consistent hashing and virtual nodes, eviction policies, replication and
tunable consistency, hot-key mitigation, cache stampede / request coalescing, write
policies and invalidation (cache-aside vs write-through/back/around), scaling, and failure
modes.

**Out of scope (mention, then set aside):** the backing store's own design, durable
persistence/AOF of the cache, full transaction/Lua scripting semantics, secondary
indexes / rich query, the network/RPC wire protocol details, and security/auth (noted,
not designed).

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
| 8 | `consistent-hashing` | Consistent Hashing | advanced |
| 9 | `eviction-policies` | Eviction Policies | advanced |
| 10 | `replication-consistency` | Replication & Consistency | advanced |
| 11 | `hot-keys` | Hot Keys & Hotspots | advanced |
| 12 | `cache-stampede` | Cache Stampede | advanced |
| 13 | `write-policies` | Write Policies & Invalidation | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a distributed cache is and why it exists (absorb read
   load, cut latency); the reframe: it *looks* like a networked hash map, but the hard
   part is being *distributed* — partition keys so churn moves few of them, evict well,
   and survive hot keys and stampedes. Scope; a `Callout variant="interview"` 45-min
   allocation.
2. **Requirements** — `RequirementsTable`. Functional: get/set/delete by key; TTL
   expiry; eviction under memory pressure; scale by adding nodes; replicate for
   availability. Non-functional: **sub-ms read latency**, **very high throughput**,
   **high hit ratio**, minimal key movement on membership change, availability, tunable
   consistency (cache may be slightly stale).
3. **Capacity Estimates** — `DistributedCacheCapacity` fed by
   `lib/distributed-cache-estimates.ts`. Derive the total dataset, the cached **working
   set**, **nodes needed** from memory, **backing-store reads** after the hit ratio, and
   **per-node read throughput**. Headline: the cache holds a *fraction* (so eviction
   matters), node count comes from memory, and a high hit ratio is what shields the
   backing store.
4. **Entity Model** — `EntityModel name="CacheEntry"` (key, value, size_bytes,
   expires_at, last_accessed, version). Prose on the hash ring / node, replica set, and
   the backing store as the source of truth (the cache is derived, lossy state).
5. **API Design** — `ApiContract`: `GET /cache/{key}` (hit/miss), `PUT /cache/{key}`
   (set with optional TTL), `DELETE /cache/{key}` (invalidate); note that real caches use
   a binary protocol and a client library that does the consistent-hash routing.
6. **High-Level Architecture** — `DistributedCacheArchitecture`: client → cache router
   (consistent hashing) → cache nodes (shards) + replicas; backing store behind on miss;
   membership/gossip for failure detection. Caption names consistent hashing, eviction,
   replication, hot keys.
7. **Detailed Flows** — `CacheHitSequence`, `CacheMissSequence` (read-through +
   populate), `NodeRebalanceSequence` (consistent hashing moves only affected keys),
   `StampedeSequence` (coalescing on a hot key).
8. **Consistent Hashing** — the centerpiece: why `hash(key) % N` is catastrophic on
   churn (almost every key remaps → mass miss); the hash **ring**, mapping keys
   clockwise to the next node, so adding/removing a node only moves that node's arc;
   **virtual nodes** for even load and smooth rebalancing. Include a `<KnowledgeCheck>`.
9. **Eviction Policies** — bounded memory forces eviction; **LRU** (recency), **LFU**
   (frequency), **TTL/expiry**, random; why approximations (sampled LRU) are used at
   scale; eviction policy drives the hit ratio. Include a `<KnowledgeCheck>`.
10. **Replication & Consistency** — replicas for availability and read scale; sync vs
    async replication and the staleness/latency trade; tunable consistency — a cache is
    allowed to be a little stale, and reading from a replica trades freshness for scale.
    Include a `<KnowledgeCheck>`.
11. **Hot Keys & Hotspots** — one key (or shard) taking disproportionate traffic and
    melting a node; detection and mitigation: replicate/duplicate the hot key across
    nodes, client-side (near) caching, key splitting, and request coalescing. Include a
    `<KnowledgeCheck>`.
12. **Cache Stampede** — a popular key expires and thousands of concurrent requests all
    miss and hit the backing store at once (dogpile); fixes: **request coalescing /
    single-flight**, **TTL jitter**, locks/leases, and early/async recompute. Include a
    `<KnowledgeCheck>`.
13. **Write Policies & Invalidation** — cache-aside (lazy) vs write-through vs write-back
    vs write-around; how each keeps the cache consistent with the backing store, and the
    classic invalidation problem (stale entries, TTL vs explicit invalidation).
14. **Scalability & Evolution** — `TradeoffTable`: single cache box → consistent-hash
    cluster + client routing → replicas + hot-key/stampede defenses → multi-region /
    tiered (near + remote) caching.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): node failure (lost shard →
    misses, not data loss), thundering herd on cold start, hot-key meltdown, replication
    lag / split-brain, network partition of the cluster, memory pressure / mass eviction,
    backing-store outage behind the cache.
16. **Trade-offs & Alternatives** — `DecisionRecord`: consistent-hash sharded,
    replicated, LRU cache with cache-aside + stampede protection; axes: consistent
    hashing vs other partitioners, LRU vs LFU, strong vs eventual (stale-ok), write-through
    vs cache-aside.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, distributed-cache-specific
- `lib/distributed-cache-estimates.ts` — pure capacity calc with typed
  `DistributedCacheCapacityAssumptions` / `DistributedCacheCapacityResults`.
- `components/learning/distributed-cache-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `DistributedCacheCapacity`.
- `components/diagrams/distributed-cache-architecture.tsx` —
  `DistributedCacheArchitecture`: client → cache router → cache nodes + replicas →
  backing store; membership/gossip. `role="img"` + caption naming consistent hashing /
  eviction / replication / hot keys.
- `components/diagrams/cache-flows.tsx` — `CacheHitSequence`, `CacheMissSequence`,
  `NodeRebalanceSequence`, `StampedeSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `distributed-cache` entry (18 sections).
- `lib/curriculum.ts` — flip `distributed-cache` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/distributed-cache.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the eighth slug's MDX.

## Capacity Model (exact)

`lib/distributed-cache-estimates.ts` is a pure function. Node count rounds up
(`Math.ceil`); float-derived results are asserted with `toBeCloseTo` in the test.

Assumptions used in the MDX embed and the test:
```ts
{
  totalItems: 10_000_000_000,
  avgItemBytes: 1_000,
  cacheableFraction: 0.2,
  memoryPerNodeGb: 64,
  peakReadsPerSecond: 50_000_000,
  hitRatio: 0.95,
}
```

Results (deterministic):
- `totalDatasetTb` = 10,000,000,000 × 1,000 / 1e12 = **10** TB total dataset
- `workingSetGb` = 10,000,000,000 × 1,000 × 0.2 / 1e9 = **2,000** GB hot working set
- `nodesNeeded` = ceil(2,000 / 64) = ceil(31.25) = **32** cache nodes
- `backingStoreReadsPerSecond` = 50,000,000 × (1 − 0.95) = **2,500,000** reads/sec to the store
- `readsPerNodePerSecond` = 50,000,000 / 32 = **1,562,500** reads/sec per node

Headline lesson: a cache deliberately holds only a **fraction** of the dataset (2 TB of
10 TB), so **eviction quality decides the hit ratio**; **node count comes from memory**
(32 nodes to hold the working set), each must serve ~**1.5M reads/sec**; and the **95% hit
ratio is the entire point** — it turns 50M reads/sec into just 2.5M hitting the slow
backing store. A few points of hit ratio is the difference between a calm store and a
melted one.

## Numerical & Terminology Invariants

- Keys are partitioned by **consistent hashing** (a ring + **virtual nodes**), never by
  `hash(key) % N`, so a membership change moves a **minimal** slice of keys.
- The cache is **bounded** and **evicts** (LRU/LFU/TTL); it is **lossy, derived** state —
  the **backing store is the source of truth**.
- The cache is allowed to be **slightly stale** (tunable / eventual consistency); reads
  may come from a **replica**.
- Two signature failures: a **hot key** overwhelming one node, and a **stampede**
  (thundering herd) of concurrent misses — mitigated by replication/near-cache and by
  **request coalescing / single-flight + TTL jitter**.
- A high **hit ratio** is the cache's reason to exist: it shields the backing store.

## Out of Scope

The backing store's internals, cache persistence/AOF, transactions/scripting, secondary
indexes, the wire protocol, security/auth (noted, not designed), real cache/RPC
integration (teaching artifact), and any change to other tutorials.
