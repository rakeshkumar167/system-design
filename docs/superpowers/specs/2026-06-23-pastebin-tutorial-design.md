# Pastebin Tutorial — Design Spec

**Date:** 2026-06-23
**Status:** Approved for planning
**Curriculum slug:** `pastebin` (sequence 3, Foundational)

## Goal

Author the third complete tutorial in the system-design curriculum: a rigorous,
interview-grade walkthrough of designing a **Pastebin** — a service that stores
and serves large text snippets with expiry, privacy controls, and CDN delivery.

This reuses the existing tutorial infrastructure (App Router static routes, MDX,
typed registry, learning components, diagram primitives, shared `CapacityTable`).
The new work is Pastebin-specific content, a capacity module + wrapper, one
architecture diagram, four flow-sequence diagrams, and the registry/curriculum
wiring.

## Framing & Scope

**What we design:** a service where a user submits a blob of text (code, logs,
config) and gets back a short, shareable URL; readers fetch the paste by that
URL, optionally gated by privacy and an expiry time. The defining tensions are:

- **Large blobs vs. small metadata** — paste *content* (KBs–MBs) belongs in object
  storage; paste *metadata* (id, owner, expiry, visibility) belongs in a database.
  The split is the spine of the design.
- **Expiry & TTL** — pastes are ephemeral. We need correct, cheap expiry: lazy
  deletion on read plus an active sweep, and burn-after-read one-time pastes.
- **Read-heavy delivery** — paste content is immutable once written, so it is a
  perfect fit for a CDN; the origin should serve a small fraction of reads.
- **Privacy & access control** — public / unlisted / private / password-protected,
  enforced without making every read hit the database.

**In scope:** create/read/raw APIs, the blob+metadata storage split, expiry/TTL
mechanisms (lazy + active deletion, one-time pastes), CDN caching of immutable
content, access control and privacy, scaling, failure modes, and abuse/security.

**Out of scope (mention, then set aside):** rich collaborative editing (that is the
Collaborative Document Editor problem), syntax-highlighting rendering internals,
full-text search across pastes, and user-account/billing productization.

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
| 8 | `blob-metadata-split` | Blob & Metadata Storage | advanced |
| 9 | `expiry-and-ttl` | Expiry & TTL | advanced |
| 10 | `caching-cdn` | Caching & CDN | advanced |
| 11 | `access-control` | Access Control & Privacy | advanced |
| 12 | `scalability-evolution` | Scalability & Evolution | advanced |
| 13 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 14 | `security-abuse` | Security & Abuse | advanced |
| 15 | `observability` | Observability | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a Pastebin is, why (share large text snippets,
   logs, code), where it sits. Scope statement; a `Callout variant="interview"`
   with a suggested 45-minute allocation. The reframe: this looks like a URL
   shortener but the distinguishing problems are *large blobs*, *expiry*, and
   *privacy*, not key generation.
2. **Requirements** — `RequirementsTable`. Functional: create a paste (text + optional
   title, language, expiry, visibility); read by id; fetch raw; expiry/TTL;
   one-time (burn-after-read); private/unlisted/public. Non-functional: read
   latency p99 < 100 ms (CDN-served), durability 11 nines for stored content,
   max paste size cap (e.g. 10 MB), high read:write ratio, availability 99.95%.
3. **Capacity Estimates** — `PastebinCapacity` fed by `lib/pastebin-estimates.ts`.
   Derive write/read QPS, content (blob) storage, metadata storage. The headline
   lesson: **content dominates metadata by ~1000×**, which forces the storage split.
4. **Entity Model** — `EntityModel name="Paste"`: `id` (short code), `blob_key`
   (object-storage pointer), `owner_id`, `visibility`, `expires_at`,
   `one_time`, `created_at`, `size_bytes`, `language`. Emphasize metadata holds a
   *pointer* to the blob, not the blob.
5. **API Design** — `ApiContract` blocks: `POST /v1/pastes` (create → returns id +
   url), `GET /v1/pastes/{id}` (metadata + content or a content URL), `GET /{id}/raw`
   (raw text, CDN-cacheable), and the expired/forbidden responses (`404`/`410`/`403`).
6. **High-Level Architecture** — `PastebinArchitecture` diagram: client → CDN →
   API/app servers → metadata DB + object storage, with an expiry worker. Component
   responsibilities and the read path through the CDN.
7. **Detailed Flows** — `CreatePasteSequence`, `ReadCacheHitSequence`,
   `ReadCacheMissSequence`, `ExpirySequence`. Walk create (write blob, then
   metadata), CDN hit, CDN miss (DB metadata + blob fetch + backfill), and expiry
   (lazy 410 on read + active sweep).
8. **Blob & Metadata Storage (deep dive)** — why content goes to object storage
   (S3-style) and metadata to a partitioned DB; the pointer indirection; why not
   store blobs in the DB (row-size, backup, cost); content-addressing/dedup option.
9. **Expiry & TTL (centerpiece)** — TTL semantics; **lazy deletion** (check
   `expires_at` on read, return `410 Gone`) vs **active deletion** (a sweeper /
   object-storage lifecycle policy); one-time burn-after-read (atomic
   read-and-delete); why lazy alone leaks storage and active alone is wasteful, so
   you use both.
10. **Caching & CDN** — paste content is immutable, so cache it aggressively at the
    edge with long TTLs keyed by id; cache invalidation on expiry/delete (or short
    TTL + origin check); negative caching for unknown/expired ids; why private
    pastes bypass the shared CDN cache (or use signed URLs).
11. **Access Control & Privacy** — `public` / `unlisted` (unguessable id, no listing)
    / `private` (owner only) / `password`. How unlisted relies on id entropy; how
    private/password reads must hit the origin (not the shared CDN); signed,
    time-limited URLs for private blob access.
12. **Scalability & Evolution** — `TradeoffTable` of stages: single DB + local disk →
    object storage for blobs + DB for metadata → CDN in front of reads → partition
    metadata + multi-region. Trigger and cost per stage.
13. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6 rows): object-storage
    outage, metadata-DB outage, CDN outage/stale, expiry-worker lag (storage leak),
    hot paste (viral), region loss, partial write (blob written, metadata failed).
14. **Security & Abuse** — paste-size limits, malware/secret-scanning, spam &
    phishing (rate limit creates, abuse reports, takedown), stored-XSS when rendering
    untrusted content (serve raw as `text/plain`, sandbox rendered HTML), id
    enumeration for unlisted pastes.
15. **Observability** — SLIs/SLOs: read latency, CDN hit ratio, create rate, expiry
    backlog / storage growth, 404/410 rates, durability/replication health.
16. **Trade-offs & Alternatives** — `DecisionRecord` for the blob+metadata +
    CDN + lazy/active expiry decision; axes: store-in-DB vs object storage,
    lazy vs active expiry, CDN TTL vs invalidation, privacy vs cacheability.
17. **Interview Summary** — a 60-second spoken answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`,
diagram primitives, the shared `CapacityTable`.

### New, Pastebin-specific
- `lib/pastebin-estimates.ts` — pure capacity calculation with typed
  `PastebinCapacityAssumptions` / `PastebinCapacityResults`.
- `components/learning/pastebin-capacity.tsx` — wrapper over `CapacityTable`,
  registered in MDX as `PastebinCapacity`.
- `components/diagrams/pastebin-architecture.tsx` — `PastebinArchitecture`: HLD with
  CDN, app servers, metadata DB, object storage, expiry worker. `role="img"` +
  caption naming object storage / metadata / CDN / expiry.
- `components/diagrams/paste-flows.tsx` — `CreatePasteSequence`,
  `ReadCacheHitSequence`, `ReadCacheMissSequence`, `ExpirySequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `pastebin` entry with the 18 sections.
- `lib/curriculum.ts` — flip `pastebin` status to `available`.
- `mdx-components.tsx` — register `PastebinCapacity`, `PastebinArchitecture`, and the
  four sequence components.
- `content/tutorials/pastebin.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the third slug's MDX.

## Capacity Model (exact)

`lib/pastebin-estimates.ts` mirrors the shape of `url-shortener-estimates.ts`
(`SECONDS_PER_MONTH = 30*24*60*60`, decimal storage units).

Assumptions used in the MDX embed and the test:
```ts
{
  newPastesPerMonth: 30_000_000,
  readWriteRatio: 10,
  peakMultiplier: 5,
  avgPasteSizeKb: 10,
  retentionYears: 2,
  metadataBytesPerPaste: 400,
}
```

Results (deterministic):
- `averageWriteQps` = 30,000,000 / 2,592,000 ≈ **11.57**
- `averageReadQps` = 11.57 × 10 ≈ **115.74**
- `peakReadQps` = 115.74 × 5 ≈ **578.70**
- `totalPastes` = 30,000,000 × 2 × 12 = **720,000,000**
- `blobStorageTB` = 720,000,000 × 10 KB (10,000 B) / 1e12 = **7.2 TB**
- `metadataStorageGB` = 720,000,000 × 400 B / 1e9 = **288 GB**

Headline lesson: blob storage (7.2 TB) dwarfs metadata (288 GB) by ~25× even at a
modest 10 KB average — and at realistic larger pastes the ratio is ~1000×. Content
goes to object storage; metadata goes to a database.

## Numerical & Terminology Invariants

- Stated paste volume matches the capacity derivation.
- Content lives in **object storage**; metadata (a pointer + attributes) lives in a
  **database** — never the blob in the DB.
- Paste content is **immutable**, which is what makes aggressive CDN caching safe.
- Expiry uses **both** lazy deletion (410 on read) **and** active deletion (sweeper /
  lifecycle policy); one-time pastes are an **atomic read-and-delete**.
- Expired reads return **410 Gone**; missing return **404**; forbidden return **403**.
- Private/password pastes **bypass the shared CDN cache** (or use signed URLs).

## Out of Scope

User accounts/billing productization, collaborative editing, syntax-highlight
rendering internals, full-text search, real object-storage/CDN integration (this is
a teaching artifact), and any change to other tutorials.
