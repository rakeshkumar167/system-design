# Video Streaming Platform Tutorial — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Curriculum slug:** `video-streaming` (sequence 11, Advanced)

## Goal

Author the sixth complete curriculum tutorial — and the first **asymmetric
pipeline** one: an interview-grade walkthrough of designing a **Video Streaming
Platform** (VOD) that ingests uploads, transcodes them into an adaptive-bitrate
ladder, and streams them to a global audience over a CDN.

This is a deliberate change of shape from the prior tutorials. Where Ticket Booking
was about correctness under contention on a tiny write, video streaming is about an
**expensive asynchronous fan-out on ingest** (transcoding) feeding a **massive,
cache-dominated, latency-sensitive read path** (delivery). The centerpiece is the
two halves and the seam between them: a long-running transcoding pipeline that turns
one source file into many renditions × many segments, and adaptive-bitrate delivery
where a CDN — not the origin — carries essentially all the bandwidth.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed
registry, learning components, diagram primitives, shared `CapacityTable`). New work
is video-streaming-specific content, a capacity module + wrapper, one architecture
diagram, four flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a system where a creator uploads a video, the platform transcodes
it into multiple bitrates and resolutions, and viewers around the world stream it
smoothly on any device and network. The defining tensions are:

- **An asymmetric pipeline** — ingest is a slow, compute-heavy, *asynchronous* batch
  job (transcode one source into a ladder of renditions, each chopped into segments);
  delivery is a high-volume, low-latency, *cache-dominated* read. They have opposite
  characteristics and are decoupled by object storage and a job queue.
- **Adaptive bitrate streaming (ABR)** — the network is unreliable and heterogeneous,
  so the player, not the server, picks quality: video is pre-segmented at several
  bitrates, the client downloads a manifest, and switches rendition per segment to
  match available bandwidth without rebuffering.
- **Delivery is a CDN problem** — peak egress is tens of Tbps, impossible from an
  origin. The CDN absorbs ~95% of it; cache hit ratio, not origin throughput, is the
  dominant delivery lever, and popularity is extremely skewed (a few hot titles, a
  long cold tail).

**In scope:** chunked/resumable upload and ingestion, the asynchronous transcoding
pipeline (rendition ladder + segmentation + parallelism), adaptive-bitrate streaming
(HLS/DASH, manifests + segments), CDN delivery and caching (hit ratio, origin shield,
hot vs long-tail), storage growth and cost/tiering, scaling, failure modes, and
security/DRM (signed URLs, token auth, DRM, hotlink/geo controls).

**Out of scope (mention, then set aside):** live/low-latency streaming (we design VOD,
mention live as an evolution), recommendation/ranking, the video codec internals, the
player UI, social features (comments/likes), and ads/monetization.

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
| 8 | `upload-ingestion` | Upload & Ingestion | advanced |
| 9 | `transcoding-pipeline` | Transcoding Pipeline | advanced |
| 10 | `adaptive-bitrate-streaming` | Adaptive Bitrate Streaming | advanced |
| 11 | `cdn-delivery` | CDN Delivery | advanced |
| 12 | `storage-and-cost` | Storage & Cost | advanced |
| 13 | `scalability-evolution` | Scalability & Evolution | advanced |
| 14 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 15 | `security-drm` | Security & DRM | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a streaming platform does end to end; the reframe:
   it *looks* like upload + playback CRUD, but the hard part is the **asymmetric
   pipeline** — a slow async transcode fan-out feeding a CDN-dominated delivery path.
   Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: upload video; transcode to
   multiple renditions; stream adaptively on any device; resume/seek; track
   processing status. Non-functional: **smooth playback (low rebuffer / startup)**,
   global low-latency delivery, durable source storage, ingest throughput keeps up,
   availability, cost-efficiency at scale.
3. **Capacity Estimates** — `VideoStreamingCapacity` fed by
   `lib/video-streaming-estimates.ts`. Derive daily ingest hours, the per-video
   **storage multiplication** from the rendition ladder, daily storage growth, peak
   **egress (Tbps)**, and origin egress after CDN offload. Headline: storage explodes
   (one source → N renditions) and delivery is a CDN/bandwidth problem (origin sees
   ~5% with a 95% hit ratio).
4. **Entity Model** — `EntityModel name="Video"` (id, uploader_id, title, status
   uploaded|transcoding|ready|failed, duration_s, source_key, created_at). Prose on
   Rendition (video_id, resolution, bitrate, segment manifest key), Segment (the
   chunked media files), and the manifest (master + media playlists).
5. **API Design** — `ApiContract`: `POST /v1/videos` (create + get a resumable upload
   URL), `GET /v1/videos/{id}` (status: transcoding → ready), and a note on the
   playback path: `GET .../master.m3u8` manifest then segment requests served by the
   **CDN**, not the API.
6. **High-Level Architecture** — `VideoStreamingArchitecture`: client → upload service
   → raw object storage → transcode queue → transcode workers → segment/rendition
   storage; metadata DB; playback path client → CDN → segment storage (origin) with a
   manifest. Caption names transcoding, adaptive bitrate, CDN, segments.
7. **Detailed Flows** — `UploadIngestSequence`, `TranscodePipelineSequence`,
   `AbrPlaybackSequence`, `CdnDeliverySequence`.
8. **Upload & Ingestion** — resumable/chunked upload direct to object storage
   (presigned URLs), why uploads must be resumable (large files, flaky networks), the
   source becomes the durable system of record, and enqueuing the transcode job; the
   API stays out of the byte path.
9. **Transcoding Pipeline (centerpiece)** — the async fan-out: a queued job per video,
   transcode the source into a **bitrate/resolution ladder**, **segment** each
   rendition into independent chunks, parallelize (per-segment / per-rendition),
   idempotent and retryable work, mark `ready` only when the manifest is complete; why
   it must be asynchronous (minutes of CPU, can't block upload). Include a
   `<KnowledgeCheck>`.
10. **Adaptive Bitrate Streaming** — HLS/DASH: a master manifest lists renditions,
    each rendition is a playlist of segment URLs; the **player** measures throughput
    and switches rendition per segment to avoid rebuffering; why client-driven beats
    server-push; startup latency vs quality. Include a `<KnowledgeCheck>`.
11. **CDN Delivery** — delivery is a caching problem: edge caches serve segments,
    cache hit ratio is the dominant lever, an **origin shield** collapses misses,
    popularity is skewed (prewarm hot titles, the long tail rides cache misses);
    segments are immutable so they cache forever. Include a `<KnowledgeCheck>`.
12. **Storage & Cost** — the rendition ladder multiplies storage; storage grows
    relentlessly; tier hot vs cold (recent/popular on fast storage, cold tail on cheap
    archival); garbage-collect failed/abandoned transcodes; egress is the dominant
    cost and is why the CDN and hit ratio matter to the bill, not just latency.
13. **Scalability & Evolution** — `TradeoffTable`: single box (upload+transcode+serve)
    → object storage + async transcode workers + a CDN → autoscaled transcode fleet +
    multi-rendition ABR + origin shield → multi-region storage + live streaming.
14. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): transcode worker crash
    mid-job (retry idempotently), poison/corrupt upload (DLQ + fail status), transcode
    backlog (autoscale / shed), origin storage outage (CDN serves cached; new misses
    fail), CDN edge/PoP outage (failover PoP / multi-CDN), partial rendition (don't
    publish manifest until complete), metadata DB outage.
15. **Security & DRM** — signed/expiring URLs and token auth on segments, DRM
    (license server, encrypted segments) for premium content, hotlink protection,
    geo-blocking/geofencing, and abuse (bandwidth leeching, scraping).
16. **Trade-offs & Alternatives** — `DecisionRecord`: async transcode to an ABR ladder
    + CDN delivery; axes: how many renditions (cost vs coverage), HLS vs DASH, transcode
    eagerly (all renditions up front) vs just-in-time, CDN buy vs build / single vs
    multi-CDN.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, video-streaming-specific
- `lib/video-streaming-estimates.ts` — pure capacity calc with typed
  `VideoStreamingCapacityAssumptions` / `VideoStreamingCapacityResults`.
- `components/learning/video-streaming-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `VideoStreamingCapacity`.
- `components/diagrams/video-streaming-architecture.tsx` —
  `VideoStreamingArchitecture`: upload service → raw storage → transcode queue →
  transcode workers → segment storage; CDN delivery path; metadata DB. `role="img"`
  + caption naming transcoding / adaptive bitrate / CDN / segments.
- `components/diagrams/streaming-flows.tsx` — `UploadIngestSequence`,
  `TranscodePipelineSequence`, `AbrPlaybackSequence`, `CdnDeliverySequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `video-streaming` entry (18 sections).
- `lib/curriculum.ts` — flip `video-streaming` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/video-streaming.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the sixth slug's MDX.

## Capacity Model (exact)

`lib/video-streaming-estimates.ts` is a pure function. Intermediate storage is computed
from integer megabytes to keep results exact (avoid float drift in the test).

Assumptions used in the MDX embed and the test:
```ts
{
  uploadsPerDay: 500_000,
  avgVideoMinutes: 10,
  renditionCount: 5,
  mbPerMinutePerRendition: 12,
  peakConcurrentStreams: 5_000_000,
  streamBitrateMbps: 5,
  cdnHitRatio: 0.95,
}
```

Results (deterministic):
- `dailyIngestHours` = 500,000 × 10 / 60 ≈ **83,333.33** hours/day of source video
- `storagePerVideoGb` = (10 × 5 × 12) / 1000 = **0.6** GB per uploaded video (all renditions)
- `dailyStorageTb` = 500,000 × (10 × 5 × 12) / 1,000,000 = **300** TB added per day
- `peakEgressTbps` = 5,000,000 × 5 / 1,000,000 = **25** Tbps peak delivery bandwidth
- `originEgressTbps` = 25 × (1 − 0.95) = **1.25** Tbps reaching the origin after CDN offload

Headline lesson: **storage explodes** because one source becomes a ladder of renditions
(300 TB/day here), and **delivery is a CDN/bandwidth problem** — 25 Tbps of egress is
impossible from an origin, so a ~95% CDN hit ratio is what makes it tractable (origin
sees only ~1.25 Tbps). Ingest is a steady ~83k source-hours/day the transcode fleet
must keep pace with.

## Numerical & Terminology Invariants

- Ingest is **asynchronous**: transcoding is a queued job, never blocks upload, and is
  **idempotent/retryable**; a video is `ready` only when its full manifest is published.
- One source becomes a **rendition ladder** (multiple bitrate/resolution variants),
  each **segmented** into independent chunks → storage multiplies by the rendition count.
- Playback is **adaptive bitrate (ABR)**: the **client** picks the rendition per segment
  from a manifest; segments are immutable and cacheable.
- **Delivery is a CDN problem**: ~95% hit ratio means the origin serves only ~5%; cache
  hit ratio is the dominant delivery lever and cost driver.
- Source files are the **durable system of record**; renditions can be regenerated.

## Out of Scope

Live/low-latency streaming (mentioned as an evolution), recommendations/ranking, codec
internals, the player UI, social features, ads/monetization, real transcoder/CDN
integration (teaching artifact), and any change to other tutorials.
