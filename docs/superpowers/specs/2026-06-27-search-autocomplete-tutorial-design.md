# Search Autocomplete Tutorial — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Curriculum slug:** `search-autocomplete` (sequence 8, Intermediate)

## Goal

Author the sixteenth complete curriculum tutorial — and the first **typeahead / read-amplified
ranked-prefix** one: an interview-grade walkthrough of designing **Search Autocomplete** (the
suggestions that drop down as you type into a search box, à la Google/Bing/Amazon) that, given a
prefix, returns the **top-k ranked completions** in a few milliseconds, per keystroke, at enormous
read volume — and keeps those suggestions fresh and safe.

This is a change of shape from the prior tutorials. It *looks* like a dictionary prefix lookup —
walk a **trie** to the node for the prefix and return what's under it — and the point is to show
that the *matching* is the easy half: the hard parts are **ranking** (which ~10 of the millions of
completions of "ne" do you show, under a sub-100 ms budget), **read amplification** (every keystroke
is a query, so autocomplete QPS is ~20× the search QPS — over a million QPS), and **building and
serving a ranked index from a firehose of query logs** while keeping it fresh (trending) and safe
(no harmful suggestions). The reframe: it looks like a trie walk, but the trie is the easy part — the
design is **precomputed top-k at every node** (so a query is O(prefix length), never a subtree scan),
a **ranking pipeline** fed by aggregated query logs, an **in-memory, replicated serving tier** that
absorbs ~1M+ QPS under a tight latency budget, and a **real-time layer** for freshness. It reuses the
hashing/caching intuition and the batch-aggregation pipeline shape from earlier tutorials (the query
log resembles the **Distributed Logging** firehose; the batch index rebuild echoes the **Web
Crawler** corpus pipeline), but centers them on *serving ranked prefix suggestions instantly at
scale*.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry, learning
components, diagram primitives, shared `CapacityTable`). New work is autocomplete-specific content, a
capacity module + wrapper, one architecture diagram, four flow-sequence diagrams, and the
registry/curriculum wiring.

## Framing & Scope

**What we design:** a service that, given a prefix typed into a search box, returns the **top-k most
relevant completed queries** in a few milliseconds, per keystroke, at web scale — and a pipeline that
builds and refreshes the ranked index from search-query logs. The defining tensions are:

- **The data structure: a trie with precomputed top-k (the centerpiece)** — a plain trie answers
  "which phrases start with this prefix?" but returning the *best* ones means either scanning the
  whole subtree under the prefix (too slow) or **precomputing and caching the top-k completions at
  every node**, so a query is a O(prefix-length) walk plus reading a tiny cached list — never a scan.
- **Ranking + read amplification (why it's a hard read system)** — suggestions are ranked by
  **popularity** (aggregated query frequency), **recency / time-decay**, and optionally
  personalization and context; and because **every keystroke** issues a request, autocomplete QPS is
  a large multiple of search QPS (~1M+ QPS), forcing an **in-memory, replicated, cached** serving
  tier and precomputation rather than any per-query computation.
- **Building, refreshing, and protecting the index** — a **batch pipeline** aggregates billions of
  query-log events into frequencies and rebuilds the trie/top-k periodically; a **real-time layer**
  injects **trending** queries the stale batch index misses; **typo tolerance** and
  **personalization** widen and tailor matches; and **safety filtering** keeps harmful or offensive
  completions out.

**In scope:** the trie + precomputed top-k structure, ranking/scoring (popularity + recency +
filtering/safety), the query-log aggregation pipeline (batch index build), the in-memory sharded +
replicated serving tier and its latency budget, freshness / trending, typo tolerance +
personalization, plus scaling, failure modes, safety/abuse, and trade-offs. **Out of scope (mention,
then set aside):** the full **search engine / ranking of results** that autocomplete sits in front of
(a separate system — the crawler builds its corpus, this only completes the *query*), the precise ML
models behind relevance/personalization beyond the signals they consume, voice/handwriting input, and
spelling-correction linguistics beyond edit-distance prefix expansion.

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
| 8 | `trie-topk` | The Trie & Precomputed Top-K | advanced |
| 9 | `ranking-scoring` | Ranking, Filtering & Safety | advanced |
| 10 | `data-pipeline` | Building the Index from Query Logs | advanced |
| 11 | `serving-layer` | Serving, Sharding & the Latency Budget | advanced |
| 12 | `freshness-trending` | Freshness & Trending Queries | advanced |
| 13 | `fuzzy-personalization` | Typo Tolerance & Personalization | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what autocomplete is and why it exists (complete a user's query as they
   type, to save keystrokes and guide them to good searches). The reframe: it *looks* like a trie
   prefix lookup, but matching is the easy half — the design is **precomputed top-k per node**
   (ranking, not just matching), a **read-amplified** serving tier (~1M+ QPS because every keystroke
   is a request), an **aggregation pipeline** that builds the ranked index from query logs, plus
   **freshness/trending** and **safety**. Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: return top-k completions for a prefix; rank by
   popularity/recency; update suggestions as the index changes; support multiple languages/regions;
   filter unsafe/offensive suggestions; tolerate typos. Non-functional: **latency** (suggestions feel
   instant — low tens of ms per keystroke), **scale** (~1M+ QPS, read-dominated), **freshness**
   (trending queries appear quickly), **availability** (degrade gracefully — a missing dropdown must
   never block typing or searching), **relevance/quality**, **safety**. Eventual consistency of the
   index is acceptable.
3. **Capacity Estimates** — `SearchAutocompleteCapacity` fed by `lib/search-autocomplete-estimates.ts`.
   Derive **search QPS**, **autocomplete QPS** (search × keystrokes — the read-amplification headline),
   **serving fleet size**, **in-memory index size (GB)**, and **daily query-log volume (TB)**.
   Headline: every keystroke is a query, so autocomplete runs at ~**1.16M QPS**, ~**20×** the search
   QPS — it's overwhelmingly read-dominated, which forces precomputed top-k + in-memory serving +
   caching; the ranked index is only ~**20 GB**, small enough to **replicate into RAM on every
   serving node** (which is what makes sub-100 ms at 1M+ QPS achievable); and the query-log pipeline
   ingests ~**1 TB/day** to aggregate offline.
4. **Entity Model** — `EntityModel name="Suggestion"` (phrase, normalized, score, frequency,
   language, last_updated). Prose on the **trie node** (children + a cached top-k list per node), the
   **QueryEvent** record (the logged search that feeds aggregation), the **per-user/context
   personalization signals**, and that suggestions are **keyed by prefix** (trie path) and each node
   **caches its top-k by score** so reads never scan a subtree.
5. **API Design** — `ApiContract`: `GET /autocomplete?q={prefix}` (the hot path — returns ranked
   suggestions), `POST /events` (internal: log a submitted search/selection that feeds the pipeline),
   and `POST /blocklist` (admin: suppress an unsafe/offensive phrase from suggestions). Emphasize that
   essentially all the traffic is the one read endpoint, called per keystroke, so it must be cacheable
   and cheap.
6. **High-Level Architecture** — `SearchAutocompleteArchitecture`: client types a prefix → autocomplete
   service → (suggestion cache → in-memory trie index) returns top-k; separately, search events flow
   into a query log → aggregator (batch) → index builder → publishes a new in-memory index version to
   the serving tier; a trending/real-time layer injects hot phrases. Caption names the **precomputed
   top-k** trie, the read path, the batch **aggregation pipeline**, and the **trending** layer.
7. **Detailed Flows** — `AutocompleteQuerySequence` (client → service → cache miss → trie lookup →
   return top-k → populate cache), `IndexBuildSequence` (query log → aggregate frequencies → build
   trie + top-k → publish new index), `TrendingUpdateSequence` (real-time layer detects a velocity
   spike and injects a trending phrase into the served top-k), `TypoCorrectionSequence` (a mistyped
   prefix misses, the service expands to edit-distance variants and returns corrected suggestions).
8. **The Trie & Precomputed Top-K** — the centerpiece deep dive: a trie maps prefixes to phrases, but
   returning the *best* completions naively means scanning the whole subtree under the prefix and
   sorting — too slow when "a" has millions of descendants. The fix is to **precompute and store the
   top-k completions at every node** (computed once at index-build time), so a query is a
   O(prefix-length) walk to the node plus reading a small cached list — constant work regardless of
   subtree size. Cost: extra memory (k entries per node) and the top-k is only as fresh as the last
   build. Mention compression (radix/ternary trees, FST) as a memory optimization. Include a
   `<KnowledgeCheck>`.
9. **Ranking, Filtering & Safety** — what makes a suggestion "good": a **score** combining
   **popularity** (aggregated query frequency from logs), **recency / time-decay** (so last year's
   hits fade), and optionally context/personalization. The top-k at each node is ordered by this
   score. Two guardrails ride here: **filtering/safety** — harmful, offensive, defamatory, or unsafe
   completions are removed (a blocklist + classifiers, applied at build time and query time), because
   autocomplete *publishes* suggestions to users and that carries responsibility; and **demotion** of
   spammy/manipulated phrases. Include a `<KnowledgeCheck>`.
10. **Building the Index from Query Logs** — where the ranking data comes from: every search is logged
    as a **QueryEvent**, producing a firehose (~1 TB/day), and a **batch pipeline** (MapReduce/Spark)
    aggregates events into per-phrase frequencies over a window, applies decay and filtering, computes
    the top-k per trie node, and **publishes a new immutable index version** that serving nodes load
    atomically. This is a **Lambda-style** split: a slow, comprehensive **batch** layer plus a fast
    **real-time** layer (next section). Nod to the **Web Crawler**'s corpus pipeline and the
    **Distributed Logging** firehose. Include a `<KnowledgeCheck>`.
11. **Serving, Sharding & the Latency Budget** — how ~1M+ QPS is served in single-digit ms: the index
    is **small (~20 GB) and held entirely in RAM**, so it's **replicated on every serving node** (reads
    scale horizontally by adding identical replicas — no cross-node fan-out for a single prefix); a
    **suggestion cache / CDN** in front absorbs the hottest prefixes; the **client debounces** keystrokes
    (and the service returns within a tight budget or returns nothing rather than blocking). When the
    index is too large to replicate wholesale, **shard by prefix** (first characters) across nodes. The
    budget is unforgiving because the dropdown must keep up with typing. Include a `<KnowledgeCheck>`.
12. **Freshness & Trending Queries** — the batch index is hours stale, so breaking/trending queries
    (a just-happened event) are missing right when users search for them. A **real-time layer**
    consumes the recent event stream, detects **velocity spikes** (rate of increase, not just raw
    count), and **injects** those phrases into the served top-k between batch rebuilds — the
    Lambda-architecture serving merge. Trade-off: real-time freshness vs the noise/abuse risk of
    reacting to spikes. Include a `<KnowledgeCheck>`.
13. **Typo Tolerance & Personalization** — two relevance refinements. **Typo tolerance**: a mistyped
    prefix won't match exactly, so the service expands the prefix to **edit-distance** variants (or
    uses a fuzzy/BK-tree / phonetic index) to still surface intended suggestions ("did you mean").
    **Personalization & context**: per-user history, location, language, and current context can
    re-rank or add suggestions on top of the global top-k — usually a lightweight re-rank of a slightly
    larger candidate set, since full per-user tries don't scale. Both trade precision/cost for recall
    and relevance.
14. **Scalability & Evolution** — `TradeoffTable`: in-DB `LIKE 'prefix%'` query → in-memory trie on one
    box → replicated in-memory trie + batch pipeline + suggestion cache → globally distributed, sharded
    + replicated, with a real-time trending layer and edge caching.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): serving node dies (stateless replicas; LB
    reroutes), index build produces a bad/empty index (version + validate before publish; roll back),
    cache/serving overload (debounce, shed load, serve cached/partial, degrade gracefully), pipeline
    lag (real-time layer covers; stale-but-serving), trending layer abuse/spam (velocity thresholds +
    filtering), unsafe suggestion slips through (blocklist + fast takedown), query-log ingestion
    outage (buffer; freshness degrades but serving continues). Guiding rule: **the dropdown is
    optional — never let autocomplete failure block typing or submitting a search.**
16. **Trade-offs & Alternatives** — `DecisionRecord`: trie + precomputed top-k per node, ranked by
    popularity/recency from a batch-aggregated query log, served from an in-memory replicated tier with
    a cache, refreshed by a real-time trending layer, with typo tolerance, personalization, and safety
    filtering. Axes: precompute top-k vs compute-at-query, in-memory replicated vs DB-backed, batch vs
    real-time freshness (Lambda), global popularity vs personalization (cost/scale), recall (typo/fuzzy)
    vs precision/latency.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared `CapacityTable`.

### New, autocomplete-specific
- `lib/search-autocomplete-estimates.ts` — pure capacity calc with typed
  `SearchAutocompleteCapacityAssumptions` / `SearchAutocompleteCapacityResults`.
- `components/learning/search-autocomplete-capacity.tsx` — wrapper over `CapacityTable`, registered as
  `SearchAutocompleteCapacity`.
- `components/diagrams/search-autocomplete-architecture.tsx` — `SearchAutocompleteArchitecture`.
  `role="img"` + caption naming the precomputed top-k trie, the read path, the batch aggregation
  pipeline, and the trending layer.
- `components/diagrams/search-autocomplete-flows.tsx` — `AutocompleteQuerySequence`,
  `IndexBuildSequence`, `TrendingUpdateSequence`, `TypoCorrectionSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `search-autocomplete` entry (18 sections).
- `lib/curriculum.ts` — flip `search-autocomplete` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/search-autocomplete.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the sixteenth slug's MDX.
- `tests/tutorial-registry.test.ts` — the "returns undefined for unregistered" slug must change from
  `search-autocomplete` (now registered) to a still-`coming-soon` slug — **`news-feed`** (seq 9).

## Capacity Model (exact)

`lib/search-autocomplete-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`,
`BYTES_PER_TB = 1e12`, `BYTES_PER_GB = 1e9`. Integer `servingNodesNeeded` uses `Math.ceil`;
float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  dailySearches: 5_000_000_000,
  keystrokesPerSearch: 20,
  phrasesIndexed: 500_000_000,
  bytesPerPhrase: 40,
  perNodeQps: 10_000,
  logBytesPerEvent: 200,
}
```

Results (deterministic):
- `searchQps` = 5,000,000,000 / 86,400 ≈ **57,870.37** /s
- `autocompleteQps` = 5,000,000,000 × 20 / 86,400 ≈ **1,157,407.41** /s
- `servingNodesNeeded` = ceil(autocompleteQps / 10,000) = ceil(115.74) = **116**
- `indexSizeGb` = 500,000,000 × 40 / 1e9 = **20** GB
- `dailyLogTb` = 5,000,000,000 × 200 / 1e12 = **1** TB

Headline lesson: **every keystroke is a query**, so at 5 billion searches/day and ~20 characters each,
autocomplete serves ~**1.16M QPS** — roughly **20×** the ~**57.9k** search QPS — making it one of the
most read-amplified systems in the curriculum, which is *why* you precompute top-k and serve from RAM
rather than computing anything per query. The signature structural fact is that the ranked index is
only ~**20 GB**: small enough to **replicate in full into the RAM of every serving node**, so reads
scale by simply adding identical replicas (no fan-out, no cross-node coordination for a single
prefix), and ~**116 nodes** carry the load. The query-log firehose feeding the ranking is ~**1 TB/day**,
aggregated offline. The system is hard because of **ranking + read amplification + freshness**, not
because matching a prefix is difficult.

## Numerical & Terminology Invariants

- Autocomplete returns the **top-k** ranked **completions** of a **prefix**, per keystroke; matching is
  a **trie** walk, but the design is **precomputed top-k at every node** so a query is O(prefix length),
  never a subtree scan.
- **Read amplification:** autocomplete QPS = search QPS × keystrokes ≈ **1.16M QPS**, ~**20×** the
  ~**57.9k** search QPS. The ranked **index is ~20 GB**, **replicated in RAM** on each of ~**116**
  serving nodes; the query log is ~**1 TB/day**.
- **Ranking** combines **popularity** (aggregated query frequency) + **recency / time-decay** (+
  optional personalization); **safety filtering** removes harmful/offensive completions (blocklist +
  classifiers).
- The index is built by a **batch pipeline** aggregating query logs and **published as immutable
  versions**; a **real-time / trending** layer (velocity spikes) covers freshness the batch misses — a
  **Lambda-architecture** split.
- **Typo tolerance** via **edit-distance** prefix expansion; **personalization** via lightweight re-rank
  of a candidate set. **Graceful degradation:** autocomplete failure must never block typing or
  submitting a search.

## Out of Scope

The full search engine / result ranking that autocomplete fronts, the ML models behind
relevance/personalization beyond the signals they consume, voice/handwriting input, spelling-correction
linguistics beyond edit-distance prefix expansion, and any change to other tutorials.
