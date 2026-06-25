# Distributed Logging Platform Tutorial — Design Spec

**Date:** 2026-06-25
**Status:** Approved for planning
**Curriculum slug:** `distributed-logging` (sequence 20, Advanced)

## Goal

Author the eleventh complete curriculum tutorial — and the first **write-firehose /
observability-pipeline** one: an interview-grade walkthrough of designing a **Distributed
Logging Platform** (ELK / Splunk / Loki style) that collects an enormous, append-only stream
of log events from thousands of services, buffers it durably so a spike never backpressures
the producers, indexes recent data affordably for search, and tiers storage across hot/warm/
cold to make multi-year retention economically possible.

This is a deliberate change of shape from the prior tutorials. It is the most **write-heavy**
problem in the curriculum — millions of events per second in, comparatively rare reads out —
and the point is to show that the hard part isn't storing log lines or serving queries; it's
**surviving the firehose cheaply**: decouple producers from consumers with a durable buffer,
accept at-least-once delivery and shed load under overload, index only what's worth indexing
(because a full index costs more than the logs), and age data down a storage hierarchy on a
retention schedule. It is the natural sibling of the (coming-soon) Metrics & Monitoring
problem, and it reuses the async-pipeline ideas from the Notification Service but inverts the
read/write balance.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is
logging-specific content, a capacity module + wrapper, one architecture diagram, four
flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a logging platform that ingests structured and unstructured log events
from a fleet of services, makes recent logs searchable in seconds, and retains older logs
cheaply for compliance and debugging. The defining tensions are:

- **Ingesting a firehose without harming producers** — the platform takes millions of events
  a second, and a slow indexer or a traffic spike must never backpressure (or crash) the
  services being logged. A **durable buffer** (Kafka-style) decouples ingestion from
  processing; delivery is **at-least-once** with load shedding/sampling under overload.
- **Indexing is the cost driver** — a full inverted index over everything is more expensive
  than the logs themselves, so you choose *what* to index: index recent/hot data only, or
  index just labels and grep the rest (the ELK-vs-Loki trade). The index/query-speed tradeoff
  is the central design decision.
- **Tiering for retention** — logs are write-once, time-ordered, and mostly never read again,
  with a strong recency bias in queries. Storage is tiered **hot → warm → cold** (indexed SSD
  → compressed object storage), and a lifecycle policy ages and finally expires data, because
  keeping everything hot and indexed is unaffordable.

**In scope:** the ingestion pipeline and buffering, parsing/structure, indexing for search,
storage tiers and retention, query/search over huge time ranges, and cost/sampling/cardinality
control. **Out of scope (mention, then set aside):** metrics and time-series aggregation
(the separate Metrics & Monitoring problem), distributed tracing spans, alerting/anomaly
detection rules, the visualization UI/dashboards, and log security/PII redaction beyond a
mention.

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
| 8 | `ingestion-pipeline` | Ingestion Pipeline & Buffering | advanced |
| 9 | `parsing-structure` | Parsing & Structured Logs | advanced |
| 10 | `indexing` | Indexing for Search | advanced |
| 11 | `storage-tiers` | Storage Tiers & Retention | advanced |
| 12 | `query-search` | Query & Search | advanced |
| 13 | `cost-cardinality` | Cost, Sampling & Cardinality | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a logging platform is and why it exists (debug, audit,
   observability across thousands of services). The reframe: it *looks* like writing log lines
   to a store and grepping them, but the hard part is the **write firehose** — buffer it so
   producers are never backpressured, index only what's worth indexing, and tier storage for
   retention. Note the inverted read/write balance. Scope; a `Callout variant="interview"`
   45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: collect logs from many services;
   make recent logs searchable; retain older logs cheaply; support structured + unstructured;
   filter by time/service/field. Non-functional: **massive write throughput**, **never
   backpressure producers**, low ingest-to-searchable latency (seconds), durability of
   accepted logs (at-least-once), cost-efficiency, queries are recency-biased.
3. **Capacity Estimates** — `DistributedLoggingCapacity` fed by
   `lib/distributed-logging-estimates.ts`. Derive **events/sec (avg & peak)**, **daily raw
   volume**, **index size over the hot window**, and **cold-tier storage over the retention
   window**. Headline: the most write-heavy system in the curriculum; indexing costs more than
   the logs, so index only hot data; cold retention forces cheap tiered object storage.
4. **Entity Model** — `EntityModel name="LogEvent"` (timestamp, service, level, message,
   structured fields, trace_id). Prose on the **LogStream/source**, the **Index** (inverted
   index over fields/terms), the **Segment/Shard** (time-partitioned immutable chunk), and the
   storage **Tier**. Key point: logs are immutable, time-ordered, append-only — written once,
   rarely read.
5. **API Design** — `ApiContract`: ingest (`POST /logs` batch, fire-and-forget/at-least-once),
   query/search (`GET /search?q=&from=&to=&service=`), and a note on the agent/forwarder push.
   Emphasize batched, async ingest and time-bounded queries.
6. **High-Level Architecture** — `DistributedLoggingArchitecture`: services+agent → ingest
   collector → durable buffer (Kafka) → indexer → hot store, and an archiver → cold object
   storage; a query service over hot+cold; a lifecycle/retention path aging hot→cold. Caption
   names the durable buffer/decoupling (write **firehose**), at-least-once, index-only-hot, and
   tiering.
7. **Detailed Flows** — `LogIngestSequence` (agent batches → collector → durable buffer, ack),
   `IndexBuildSequence` (indexer consumes buffer → parse → index → hot store, commit offset),
   `SearchQuerySequence` (time-bounded scatter-gather over hot shards, cold fallback),
   `RetentionTierSequence` (lifecycle ages hot→cold, drops index, expires past retention).
8. **Ingestion Pipeline & Buffering** — first deep dive: agents/forwarders, the ingest
   collector, and the **durable buffer** that decouples producers from the slow indexing path
   so a spike or a downstream outage never backpressures the apps; at-least-once delivery,
   consumer offsets, backpressure, and load shedding/sampling under overload. Include a
   `<KnowledgeCheck>`.
9. **Parsing & Structured Logs** — structured (JSON) vs unstructured (free-text) logs;
   parse/extract fields at ingest (schema-on-write) vs at query (schema-on-read); enrichment
   (service, host, trace_id); why structure makes search and aggregation tractable.
10. **Indexing for Search** — the cost driver: an **inverted index** makes search fast but is
    expensive to build and store; **index everything** (ELK/Elasticsearch) gives rich search
    at high cost, vs **index only labels and grep the payload** (Loki) for cheap ingest and
    slower search. Index recent/hot data, not the cold archive. Include a `<KnowledgeCheck>`.
11. **Storage Tiers & Retention** — logs are write-once, time-ordered, recency-biased reads;
    tier **hot** (indexed, SSD, days) → **warm** → **cold** (compressed object storage,
    months/years, unindexed); time-partitioned immutable segments; a lifecycle policy that ages
    data down and finally deletes it past retention. Include a `<KnowledgeCheck>`.
12. **Query & Search** — time-bounded queries are the norm; partition/shard by time so a query
    prunes to the relevant segments; **scatter-gather** across hot shards then merge; recency
    bias means most queries hit hot; aggregation and the slow path to cold. Include a
    `<KnowledgeCheck>`.
13. **Cost, Sampling & Cardinality** — logging cost is dominated by volume and indexing;
    control it with **sampling** (head/tail/dynamic), dropping noisy logs, capping high-
    **cardinality** fields (they explode the index), and tiering. The lesson: at scale you
    cannot afford to keep and index everything, so cost control is a first-class design
    concern. Include a `<KnowledgeCheck>`.
14. **Scalability & Evolution** — `TradeoffTable`: single log file/DB + grep → centralized
    collector + searchable store → buffered pipeline + index hot + tier cold → multi-region
    with sampling and federated query.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): indexer/consumer outage (buffer
    absorbs), buffer full / overload (shed or sample, never backpressure producers), agent
    can't ship (local spool), duplicate delivery (at-least-once → dedup/idempotent doc id),
    hot store full, cold retrieval slow/unavailable, high-cardinality index blowup.
16. **Trade-offs & Alternatives** — `DecisionRecord`: buffered at-least-once pipeline, index
    hot only, tiered storage, sampling for cost; axes: index-everything vs index-labels, push
    vs pull collection, at-least-once vs exactly-once, retention vs cost.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, logging-specific
- `lib/distributed-logging-estimates.ts` — pure capacity calc with typed
  `DistributedLoggingCapacityAssumptions` / `DistributedLoggingCapacityResults`.
- `components/learning/distributed-logging-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `DistributedLoggingCapacity`.
- `components/diagrams/distributed-logging-architecture.tsx` —
  `DistributedLoggingArchitecture`. `role="img"` + caption naming the durable buffer / write
  firehose, at-least-once, index-only-hot, and tiering.
- `components/diagrams/logging-flows.tsx` — `LogIngestSequence`, `IndexBuildSequence`,
  `SearchQuerySequence`, `RetentionTierSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `distributed-logging` entry (18 sections).
- `lib/curriculum.ts` — flip `distributed-logging` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/distributed-logging.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the eleventh slug's MDX.

## Capacity Model (exact)

`lib/distributed-logging-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`,
`BYTES_PER_TB = 1e12`, `TB_PER_PB = 1000`. Float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  dailyLogEvents: 500_000_000_000,
  avgEventBytes: 500,
  peakFactor: 3,
  compressionRatio: 0.1,
  indexFraction: 0.3,
  hotRetentionDays: 7,
  coldRetentionDays: 365,
}
```

Results (deterministic):
- `avgEventsPerSecond` = 500,000,000,000 / 86,400 ≈ **5,787,037.04** /sec
- `peakEventsPerSecond` = avg × 3 ≈ **17,361,111.11** /sec
- `dailyRawTb` = 500,000,000,000 × 500 / 1e12 = **250** TB/day
- `indexStorageTb` = dailyRawTb × indexFraction × hotRetentionDays = 250 × 0.3 × 7 = **525** TB
- `coldStoragePb` = dailyRawTb × compressionRatio × coldRetentionDays / 1000 = 250 × 0.1 × 365 / 1000 = **9.125** PB

Headline lesson: this is the **most write-heavy** system in the curriculum — ~**5.8M events/
sec** average, ~**17M/sec** at peak, **250 TB/day** raw — and reads are rare by comparison, so
the design is about ingesting a firehose cheaply, not serving queries fast. **Indexing is the
cost driver**: a full index over just the 7-day hot window is ~**525 TB**, more than the
compressed logs, which is why you index only hot data (or only labels). And **retention forces
tiering**: a year of logs is ~**9 PB** even compressed 10×, so cold data lives in cheap,
unindexed object storage. Everything downstream — buffering, index-only-hot, tiering, sampling
— exists to keep this firehose affordable.

## Numerical & Terminology Invariants

- The platform is **write-heavy** (a **firehose**); a **durable buffer** (Kafka-style)
  decouples producers from processing so producers are **never backpressured**; delivery is
  **at-least-once** with **load shedding / sampling** under overload.
- Logs are **immutable, time-ordered, append-only**, written once and rarely read (reads are
  **recency-biased**).
- **Indexing is the cost driver**: an **inverted index** is built over **hot** data only
  (index-everything vs index-labels-only is the central trade); the cold archive is
  **unindexed**.
- Storage is **tiered hot → warm → cold** (indexed SSD → compressed object storage) with a
  **retention lifecycle** that ages and finally expires data.
- Cost is controlled by **sampling**, dropping noise, **capping high cardinality**, and
  tiering — keeping and indexing everything is unaffordable.

## Out of Scope

Metrics/time-series aggregation (Metrics & Monitoring), distributed tracing, alerting/anomaly
rules, the dashboard UI, deep PII redaction, and any change to other tutorials.
