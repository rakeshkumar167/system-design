# Photo Sharing Platform Tutorial — Design Spec

**Date:** 2026-07-20
**Status:** Approved for planning
**Problem:** `photo-sharing` (curriculum sequence 13, difficulty **Advanced**)

## Goal

Author the **Photo Sharing Platform** tutorial (`/learn/photo-sharing`) — an Instagram/Flickr-class
system. The reframe: it *looks* like "upload photos and show a feed," but the hard part is the
**write-amplified async media pipeline** (each upload fans into many derivative sizes/formats) feeding a
**read-dominated, CDN-served delivery path**, on top of an object store and a feed. It deliberately
**builds on and cross-references two just-built systems**: the [Object Storage](/learn/object-storage)
blob store holds the bytes, and the [News Feed](/learn/news-feed) fan-out generates the timeline — so
this tutorial centers on what's *distinctive*: **the image processing pipeline and CDN delivery**, not
re-deriving fan-out or erasure coding.

Concepts (from curriculum): **Object storage, Image pipeline, Feed generation, CDN**.

## Section Outline (18 sections)

Standard spine + 6 deep dives (8–13). `id`s must match the MDX `<h2 id>` and registry.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `upload-path` | Upload: Direct-to-Storage & Presigned URLs | advanced |
| 9 | `image-pipeline` | The Image Processing Pipeline | advanced |
| 10 | `serving-cdn` | Serving Images: CDN & Responsive Delivery | advanced |
| 11 | `feed-generation` | Feed Generation | advanced |
| 12 | `metadata-social` | Metadata, Albums & Social Interactions | advanced |
| 13 | `storage-tiering` | Storage, Tiering & Cost | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: uploading and feeds are known; the design is a **write-amplified async image
   pipeline** (originals → many derivatives) plus **read-dominated CDN serving**, resting on object
   storage and fan-out feeds. Cross-ref Object Storage + News Feed as reused substrates. `Callout
   variant="interview"` 45-min plan.
2. **Requirements** — functional: upload a photo, process into sizes/formats, view a photo, browse a
   feed, albums, likes/comments. Non-func: **very read-heavy** (views ≫ uploads), **low-latency global
   image delivery** (CDN), **durable originals** (object storage), async processing (upload feels
   instant), storage-cost efficiency. `RequirementsTable`.
3. **Capacity** — `PhotoSharingCapacity`. Lesson: **write-amplified storage + read-dominated CDN
   serving** — 100M uploads/day × (original + 5 derivatives) ≈ **600 TB/day**; ~100 views/upload ⇒
   ~**116k image req/s**, but a **98%-hit CDN** offloads **~50×** so the origin sees only ~**2.3k/s**.
4. **Entity Model** — `Photo` = id + owner + object keys (original + derivative map) + metadata
   (dimensions, caption, status, EXIF-stripped) + counters; plus Album, and social interactions.
   `EntityModel`.
5. **API Design** — `POST /photos` (initiate upload → presigned URL / metadata), `GET /photos/{id}`
   (metadata + responsive image URLs), `GET /feed`. Three `ApiContract`s.
6. **High-Level Architecture** — `PhotoSharingArchitecture` HLD: client → app/API → object store
   (originals + derivatives) + metadata DB + async image pipeline (queue + workers) + CDN for delivery.
7. **Detailed Flows** — four sequences (below).
8. **Upload: Direct-to-Storage & Presigned URLs** — the client uploads the **original directly to the
   object store** via a **presigned URL** (bypassing app servers, which would bottleneck on multi-MB
   bodies); the app records metadata (status `processing`) and enqueues a job. Direct upload + async
   processing makes upload feel instant. `KnowledgeCheck`.
9. **The Image Processing Pipeline** — the signature: an **async, event-driven** pipeline of workers
   consuming a queue, each reading the original and generating **derivatives** — multiple **resolutions**
   (thumbnail → full), modern **formats** (WebP/AVIF), **EXIF stripping** (privacy/size), maybe a
   blurhash placeholder. It's **idempotent** (a retried job re-derives the same outputs) and the
   **original is never modified** (derivatives are regenerable, so a new size can be backfilled later).
   Decouples the slow work from the upload. `KnowledgeCheck`. Embed `<ProcessImageSequence />`.
10. **Serving Images: CDN & Responsive Delivery** — reads dominate, so images are served from a **CDN**
    that absorbs ~98% of traffic; the origin (object store) is only hit on a miss. **Responsive
    delivery**: serve the **right derivative per device** (small thumbnail on a phone list, full on a
    detail view) to cut bytes; immutable derivative URLs cache forever. `KnowledgeCheck`. Embed
    `<ServeImageSequence />`.
11. **Feed Generation** — the timeline is a **fan-out** problem (push vs pull vs hybrid for celebrities)
    — covered in depth by the [News Feed](/learn/news-feed) tutorial, so here it's **referenced**, with
    the photo-specific point: the feed stores **post IDs**, hydrated at read time with **CDN image URLs**
    (the derivatives), never the image bytes. `KnowledgeCheck` may live here.
12. **Metadata, Albums & Social Interactions** — the metadata DB (photo records, ownership, captions),
    **albums** (collections = key prefixes / join rows), and **social interactions** (likes, comments,
    follows) which are high-write counters at scale (approximate/aggregated counts, like the leaderboard
    and news-feed patterns). `KnowledgeCheck` may live here.
13. **Storage, Tiering & Cost** — photos are **huge and forever**, and most are **rarely viewed after a
    few days**, so storage cost dominates: **tier** old photos from hot to **cold storage** (cheap,
    higher-latency), keep **originals durably** (erasure-coded object storage — cross-ref) but maybe drop
    rarely-used derivatives and **regenerate on demand**, and **deduplicate** identical uploads by
    content hash. `Callout`. Embed `<TieringSequence>`? No — keep 4 flows; discuss in prose.
14. **Scalability & Evolution** — staged `TradeoffTable` (single server + local disk → object store + CDN
    → async pipeline + metadata sharding → global multi-region + tiering).
15. **Resiliency & Failure Modes** — `FailureMatrix` (pipeline worker crash / retry, object-store loss,
    CDN outage / origin overload, metadata shard loss, processing backlog, hot photo / viral, thumbnail
    missing).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (pre-generate vs on-the-fly derivatives;
    direct-to-storage vs proxied upload; store all derivatives vs regenerate; push vs pull feed).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `UploadPhotoSequence` — client → app → object store + queue: request a presigned URL, upload the
  original directly to the object store, app records metadata (status processing) and enqueues a
  processing job, ack. Caption: uploading directly to the object store bypasses the application servers,
  and async processing makes the upload feel instant.
- `ProcessImageSequence` — queue → worker → object store + metadata: a worker reads the original,
  generates the derivative sizes/formats (and strips EXIF), writes them to the object store, and marks
  the photo ready. Caption: the original is never modified, so derivatives can be regenerated (a new size
  backfilled later), and the job is idempotent on retry.
- `ServeImageSequence` — client → CDN → object store: request the right-sized image; a CDN hit returns
  from the edge, a miss fetches the derivative from the object store, caches it, and returns. Caption:
  the CDN absorbs the overwhelming majority of read traffic, and responsive delivery sends the smallest
  derivative that fits the device.
- `FeedLoadSequence` — client → feed service → metadata + CDN: request the feed, get a list of post IDs
  with metadata, then fetch each image from the CDN. Caption: the feed is a list of post IDs hydrated
  with image URLs, and the images themselves come from the CDN, not the feed service.

## Capacity Model (exact)

`lib/photo-sharing-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_TB =
1_000_000_000_000`.

Assumptions (MDX embed and test):
```ts
{
  uploadsPerDay: 100_000_000,
  derivativesPerPhoto: 5,
  originalBytes: 4_000_000,
  derivativeBytes: 400_000,
  viewsPerUpload: 100,
  cdnHitRate: 0.98,
}
```

Results:
- `uploadsPerSec` = 100,000,000 / 86,400 ≈ **1157.41**
- `dailyStorageTb` = 100,000,000 × (4,000,000 + 5×400,000) / 1e12 = 100M × 6MB / 1e12 = **600** TB
- `viewQps` = 100,000,000 × 100 / 86,400 ≈ **115,740.74**
- `originQps` = viewQps × (1 − 0.98) ≈ **2,314.81**
- `cdnOffloadFactor` = 1 / (1 − 0.98) = **50**

Lesson: photo sharing is **write-amplified in storage and read-amplified in serving**. Each of 100M
daily uploads fans into an original plus ~5 derivatives (~6 MB total), producing ~**600 TB/day** of new
storage — so an object store and an async pipeline that generates derivatives are mandatory. And with
~100 views per upload, serving runs at ~**116k image requests/sec**, but a **98%-hit CDN** offloads
~**50×**, so the origin object store sees only ~**2.3k/s**. The app tier barely touches image bytes: it
orchestrates an async pipeline and hands out CDN URLs.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/photo-sharing-estimates.ts` + test; `components/learning/photo-sharing-capacity.tsx`
(`PhotoSharingCapacity`); `components/diagrams/photo-sharing-architecture.tsx`
(`PhotoSharingArchitecture`); `components/diagrams/photo-sharing-flows.tsx` (`UploadPhotoSequence`,
`ProcessImageSequence`, `ServeImageSequence`, `FeedLoadSequence`). Register all in `mdx-components.tsx`.

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `photo-sharing` → `available`;
`app/learn/[slug]/page.tsx` import + map; `content/tutorials/photo-sharing.mdx`;
`tests/tutorial-registry.test.ts` (add to sorted keys after `payment-system`, before `rate-limiter`; +
18-section assertion; **repoint "returns undefined" from `photo-sharing` to `ride-hailing`**);
`tests/curriculum.test.ts` (insert `photo-sharing` into the available list **after `object-storage`,
before `ticket-booking`** — seq 13); `tests/photo-sharing-content.test.ts`; extend `e2e/pilot.spec.ts`
and **decrement the "coming soon" count by one (12 → 11)**.

## Invariants

- Photo sharing = **async image pipeline (write-amplified: original → many derivatives)** + **CDN-served
  read-dominated delivery**, on **object storage** (bytes) + **fan-out feed** (timeline, ref News Feed).
- Upload: client uploads original **directly to object store via presigned URL** (bypass app servers);
  process **asynchronously**; upload feels instant.
- Pipeline: workers generate **derivatives** (resolutions + WebP/AVIF + EXIF strip); **idempotent**;
  **original never modified** (derivatives regenerable/backfillable).
- Serving: **CDN absorbs ~98%**; **responsive delivery** (smallest derivative per device); immutable
  derivative URLs cache forever.
- Feed stores **post IDs** hydrated with **CDN image URLs**, not bytes (fan-out per News Feed).
- Storage dominates cost: **tier hot→cold**, keep originals durable, **regenerate rarely-used
  derivatives on demand**, **dedup by content hash**.
- Capacity: ~600 TB/day new storage; ~116k views/s → ~2.3k/s origin after **50× CDN offload**.

## Commit sequence

1. `docs: design spec and plan for Photo Sharing tutorial`
2. `feat: add Photo Sharing capacity model and wrapper`
3. `feat: add Photo Sharing architecture and flow diagrams`
4. `feat: register Photo Sharing tutorial route and skeleton`
5. `content: complete Photo Sharing tutorial`
6. `test: verify Photo Sharing tutorial flow end-to-end`
