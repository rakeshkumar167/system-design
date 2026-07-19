# Metrics & Monitoring System Tutorial — Design Spec

**Date:** 2026-07-20
**Status:** Approved for planning
**Problem:** `metrics-monitoring` (curriculum sequence 19, difficulty **Advanced**)

## Goal

Author the **Metrics and Monitoring System** tutorial (`/learn/metrics-monitoring`) — a
Prometheus/Datadog/InfluxDB-class time-series platform. The reframe: it *looks* like "store numbers and
draw graphs," but the hard part is a **relentless write firehose of high-cardinality time-series data**
ingested continuously, stored compressed and time-partitioned, downsampled and retention-tiered to bound
cost, queried with **range aggregations**, and evaluated continuously for **alerting**. It echoes the
**Distributed Logging** write-firehose shape but centered on **numeric time series + aggregation +
alerting**, and its signature villain is **cardinality explosion**.

Concepts (from curriculum): **Time-series storage, Aggregation, Downsampling, Alerting**.

## Section Outline (18 sections)

Standard spine + 6 problem-specific deep dives (8–13). `id`s must match the MDX `<h2 id>` and registry.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `data-model-cardinality` | The Data Model & Cardinality | advanced |
| 9 | `ingestion-pipeline` | Ingestion: Push vs Pull | advanced |
| 10 | `tsdb-storage` | Time-Series Storage & Compression | advanced |
| 11 | `downsampling-retention` | Downsampling & Retention | advanced |
| 12 | `query-aggregation` | Querying & Aggregation | advanced |
| 13 | `alerting` | Alerting | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: graphing is easy; sustaining a huge continuous **write firehose** of
   high-cardinality series, compressing it, bounding storage with downsampling/retention, and evaluating
   alerts is the design. `Callout variant="interview"` 45-min plan.
2. **Requirements** — functional: ingest samples, query with aggregation over time ranges, dashboards,
   define + evaluate alert rules, retention. Non-functional: **sustain millions of samples/sec**
   (writes dominate), never lose data / never backpressure producers, query recent ranges fast, bounded
   storage cost, **eventual consistency OK**. `RequirementsTable`.
3. **Capacity** — `MetricsCapacity`. Lesson: **write firehose** — 200M active series × scrape/10s = **20M
   samples/sec**, ~27.6 TB/day raw → **~3.5 TB/day** after **8× time-series compression**; reads are
   modest recent-range scans. Sized by write throughput + storage, not query latency.
4. **Entity Model** — `TimeSeries` = metric name + **labels** (identity) + a stream of (timestamp,
   value) **samples**; **cardinality** = number of distinct label sets. `EntityModel`.
5. **API Design** — `POST /write` (batch remote-write of samples), `GET /query` (instant + range query
   with aggregation), `POST /rules` (define an alert rule). Three `ApiContract`s.
6. **High-Level Architecture** — `MetricsArchitecture` HLD: targets → ingestion → TSDB (compressed,
   time-partitioned) → query engine → dashboards; alerting engine evaluates over recent windows and
   fires; downsampler compacts/expires blocks.
7. **Detailed Flows** — four sequences (below).
8. **Data Model & Cardinality** — a series is identified by metric + label set; **cardinality is the
   killer**: high-cardinality labels (user_id, request_id, unbounded values) multiply series and blow up
   the index/memory — the #1 operational failure. Keep labels bounded. `KnowledgeCheck`.
9. **Ingestion: Push vs Pull** — **pull/scrape** (Prometheus: server scrapes targets on an interval —
   simple discovery, target health as a signal, easy to reason about) vs **push** (agents/remote-write —
   better for short-lived jobs, serverless, network-isolated). High write throughput; a durable buffer
   / WAL so ingestion never loses data or backpressures producers. `KnowledgeCheck`.
10. **Time-Series Storage & Compression** — an append-only **TSDB**: data written to a per-series **head
    block** in memory (+ WAL), flushed to **immutable time-partitioned blocks** on disk; columnar;
    aggressive compression because points are **regular and slowly-changing** — **delta-of-delta**
    timestamps + **XOR** float values (Gorilla/Facebook), ~1.3–2 bytes/sample. `KnowledgeCheck`.
11. **Downsampling & Retention** — raw high-resolution data kept for recent windows; **downsampled
    rollups** (1m→5m→1h) for older data; **tiered retention** drops/rolls up by age to bound storage —
    old data is queried at coarse resolution, which is all dashboards need. `Callout`. `KnowledgeCheck`
    may live here.
12. **Querying & Aggregation** — a query selects series by labels over a time range and applies
    functions: **rate/increase** for counters, **sum/avg/min/max**, **group by label**, **percentiles**
    (histograms). Reads touch only recent contiguous blocks; **precomputed rollups / recording rules**
    make heavy dashboard queries cheap. `KnowledgeCheck`.
13. **Alerting** — an alerting engine continuously **evaluates rule expressions** over recent windows;
    a **for-duration** requirement (condition must hold N minutes) suppresses **flapping**; firing
    alerts are **deduplicated, grouped, and routed** (silences, inhibition) and handed off to
    notification channels (echoes the Notification Service). Embed `<AlertEvaluationSequence />`.
    `KnowledgeCheck`.
14. **Scalability & Evolution** — staged `TradeoffTable` (single TSDB → federated/sharded by series →
    remote long-term store + downsampling → HA pairs + global query).
15. **Resiliency & Failure Modes** — `FailureMatrix` (ingest node loss / WAL replay, scrape target down,
    cardinality explosion OOM, query overload, downsampler lag, alerting engine down / missed alerts,
    long-term store unavailable).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (pull vs push; metrics vs logs/traces;
    downsample vs keep-raw; local vs remote long-term).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `IngestSampleSequence` — target → ingestion → TSDB: scrape/receive a batch of samples → append to the
  WAL and the in-memory head block → periodically flush a compressed immutable block. Caption: the write
  path must sustain millions of samples per second while never blocking the producers that emit them.
- `RangeQuerySequence` — dashboard → query engine → TSDB: PromQL range query (e.g. rate over 5m) →
  select series by labels → range-scan the relevant blocks → apply the aggregation → return. Caption:
  because queries are almost always over recent time, reads touch only recent, contiguous blocks.
- `AlertEvaluationSequence` — alerting engine → TSDB → notification: evaluate the rule expression each
  interval → condition holds for the for-duration → fire, dedup/group → hand off to notify. Caption: the
  for-duration requirement suppresses flapping so a brief blip doesn't page anyone.
- `DownsampleRetentionSequence` — downsampler → TSDB: read raw blocks older than the retention boundary →
  compute rollups (1m→5m→1h) → write downsampled blocks → drop the raw. Caption: rollups bound long-term
  storage without losing the shape of history.

## Capacity Model (exact)

`lib/metrics-monitoring-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_TB =
1_000_000_000_000`.

Assumptions (MDX embed and test):
```ts
{
  monitoredTargets: 1_000_000,
  seriesPerTarget: 200,
  scrapeIntervalSec: 10,
  rawBytesPerSample: 16,
  compressedBytesPerSample: 2,
}
```

Results:
- `activeSeries` = 1,000,000 × 200 = **200,000,000**
- `ingestSamplesPerSec` = 200,000,000 / 10 = **20,000,000**
- `rawStoragePerDayTb` = 20,000,000 × 16 × 86,400 / 1e12 = **27.648** TB
- `compressedStoragePerDayTb` = 20,000,000 × 2 × 86,400 / 1e12 = **3.456** TB
- `compressionRatio` = 16 / 2 = **8**

Lesson: monitoring is a **write-firehose** problem. 200M active series scraped every 10s is **20M
samples/sec**, which raw would be ~**27.6 TB/day**; time-series compression (delta-of-delta timestamps +
XOR values, Gorilla-style) shrinks each sample from 16 to ~2 bytes (**8×**) → ~**3.5 TB/day**, and
downsampling/retention bound the long tail. Reads (dashboards, alert evaluation) are comparatively modest
recent-range scans. The system is sized by **ingest throughput and storage**, not query latency — and its
memory is bounded by **cardinality**, not sample volume.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/metrics-monitoring-estimates.ts` + test; `components/learning/metrics-monitoring-capacity.tsx`
(`MetricsCapacity`); `components/diagrams/metrics-monitoring-architecture.tsx` (`MetricsArchitecture`);
`components/diagrams/metrics-monitoring-flows.tsx` (`IngestSampleSequence`, `RangeQuerySequence`,
`AlertEvaluationSequence`, `DownsampleRetentionSequence`). Register all in `mdx-components.tsx`.

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `metrics-monitoring` →
`available`; `app/learn/[slug]/page.tsx` import + map; `content/tutorials/metrics-monitoring.mdx`;
`tests/tutorial-registry.test.ts` (add to registered keys + 18-section assertion); `tests/curriculum.test.ts`
(insert `metrics-monitoring` into the available list **after `payment-system`, before `distributed-logging`**
— it's sequence 19); `tests/metrics-monitoring-content.test.ts`; extend `e2e/pilot.spec.ts` and
**decrement the "coming soon" count by one (14 → 13)**.

## Invariants

- A **time series** = metric name + **label set** (identity) + (timestamp, value) samples; **cardinality**
  (distinct label sets) is the killer constraint — high-cardinality labels explode the index/memory.
- **Pull/scrape** (server pulls on an interval; target-health signal) vs **push/remote-write** (short-lived
  jobs); a **WAL/buffer** means ingestion never loses data or backpressures producers.
- TSDB: in-memory **head block** + WAL → immutable **time-partitioned blocks**; **delta-of-delta**
  timestamps + **XOR** float compression (~2 bytes/sample, ~8×).
- **Downsampling** (1m→5m→1h rollups) + **tiered retention** bound long-term storage; old data queried at
  coarse resolution.
- Queries: label-select + time-range + **rate/sum/percentile/group-by**; recent-block reads; recording
  rules precompute heavy dashboards.
- **Alerting**: continuous rule evaluation + **for-duration** (anti-flap) + dedup/group/route → notify.
- Capacity: 20M samples/sec, ~27.6 TB/day raw → ~3.5 TB/day (**8×**); write- and storage-bound, not
  query-latency-bound.

## Commit sequence

1. `docs: design spec and plan for Metrics and Monitoring tutorial`
2. `feat: add Metrics and Monitoring capacity model and wrapper`
3. `feat: add Metrics and Monitoring architecture and flow diagrams`
4. `feat: register Metrics and Monitoring tutorial route and skeleton`
5. `content: complete Metrics and Monitoring tutorial`
6. `test: verify Metrics and Monitoring tutorial flow end-to-end`
