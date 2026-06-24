# Cloud Drive Tutorial — Design Spec

**Date:** 2026-06-25
**Status:** Approved for planning
**Curriculum slug:** `cloud-drive` (sequence 23, Advanced)

## Goal

Author the ninth complete curriculum tutorial — and the first **file-sync / object-storage**
one: an interview-grade walkthrough of designing a **Cloud Drive** (Dropbox / Google Drive
style) that stores files durably and cheaply at exabyte scale, syncs them across many of a
user's devices, transfers only what changed, deduplicates identical data, and supports
sharing, permissions, and version history.

This is a deliberate change of shape from the prior tutorials. It is the most *familiar*
looking problem — upload a file, download a file — and the point is to show why the hard
part is not storage but **sync**: keeping many devices convergent, moving only changed
**chunks** instead of whole files, **deduplicating** identical content, and separating a
small transactional **metadata** plane from a massive immutable **block** plane. It revisits
object storage and CDN delivery touched on in the Video Streaming tutorial, but from the
write side: here the system *is* the storage and the sync engine.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is
cloud-drive-specific content, a capacity module + wrapper, one architecture diagram, four
flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a multi-device file storage and sync service. A client watches a local
folder, splits changed files into content-hashed chunks, uploads only the chunks the server
doesn't already have, and commits a new file version to a metadata service; other devices
are notified and pull the metadata delta, then fetch the new chunks. The defining tensions
are:

- **Metadata vs. blocks** — the central architectural split. File *content* is enormous,
  immutable, and belongs in object storage addressed by content hash; file *metadata* (the
  namespace tree, versions, ACLs, chunk lists) is small, mutable, transactional, and belongs
  in a scalable database. Conflating them is the classic mistake.
- **Move only what changed** — re-uploading whole files on every edit is ruinous at scale.
  **Chunking + content-addressed dedup + delta sync** transfer only the chunks that actually
  changed and store each unique chunk once, cutting both bandwidth and storage dramatically.
- **Convergent multi-device sync** — every device must end up with the same view. A
  **metadata cursor / change journal** lets a device pull just the changes since it last
  synced; a **notification** path makes that near-real-time; and concurrent offline edits
  must be reconciled into **conflicted copies** so no write is lost.

**In scope:** chunking and content-addressed storage, deduplication, delta sync, the sync
protocol (cursor + notifications), the metadata store and namespace, sharing and permissions
(ACLs), versioning and history, scaling, and failure modes.

**Out of scope (mention, then set aside):** real-time collaborative *co-editing* of a single
document (that's the Collaborative Document Editor tutorial — here a file is the unit and
concurrent edits become conflicted copies, not merged operations), full-text search and
indexing of file contents, rich previews/thumbnail transcoding pipelines, end-to-end
encryption / key management beyond a mention, the mobile/desktop client UI, and billing.

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
| 8 | `chunking-dedup` | Chunking & Deduplication | advanced |
| 9 | `delta-sync` | Delta Sync | advanced |
| 10 | `sync-protocol` | Sync Protocol & Notifications | advanced |
| 11 | `metadata-store` | Metadata Store & Namespace | advanced |
| 12 | `sharing-permissions` | Sharing & Permissions | advanced |
| 13 | `versioning-history` | Versioning & History | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a cloud drive is and why it exists (durable, shareable,
   multi-device file storage). The reframe: it *looks* like upload/download over a blob
   store, but the hard part is **sync** — keep many devices convergent, move only the chunks
   that changed, dedup identical data, and split a small transactional metadata plane from a
   massive immutable block plane. Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: upload/download files; sync changes
   across a user's devices; share files/folders with permissions; keep version history;
   restore prior versions; (implicit) dedup and delta to make it affordable. Non-functional:
   **durability (11 nines)** is the top bar, high availability, low sync latency (seconds),
   scalable to exabytes and hundreds of millions of users, bandwidth-efficient.
3. **Capacity Estimates** — `CloudDriveCapacity` fed by `lib/cloud-drive-estimates.ts`.
   Derive **raw storage** (EB scale), **physical storage after dedup**, **metadata write
   QPS**, and the **upload bandwidth naive vs. delta**. Headline: storage is exabyte-scale so
   it must live in object storage with dedup, metadata is tiny but high-QPS (separate store),
   and delta sync cuts upload bandwidth ~10×.
4. **Entity Model** — `EntityModel name="File"` (or `FileVersion`) with the chunk-list
   model. Fields: file id, path/namespace, owner, current version, size, and a **block list**
   (ordered content hashes). Prose on the four entities: **File/Namespace node**,
   **FileVersion** (immutable snapshot = ordered list of block hashes), **Block** (a
   content-addressed chunk, stored once), and **ShareACL**. The key point: a version is just
   a list of block hashes; blocks are immutable and shared across files and versions.
5. **API Design** — `ApiContract`: the two-phase write (`POST /blocks` to upload chunks by
   hash with a "which are missing?" check, then `POST /files/{path}/commit` with the block
   list + base version), and `GET /delta?cursor=` to pull changes. Note the content-addressed
   block API and the commit-with-base-version for conflict detection.
6. **High-Level Architecture** — `CloudDriveArchitecture`: client (watcher + chunker) → sync
   gateway → **metadata service → metadata DB** and **block service → block storage (object
   store)**, plus a **notification service** that fans changes out to a user's other devices.
   Caption names the **metadata/block split**, **content-addressed deduplication**, **delta
   sync**, and the notification path.
7. **Detailed Flows** — `FileUploadSequence` (chunk → dedup check → upload new blocks →
   commit metadata), `DeltaSyncSequence` (edit a large file → upload only changed chunks →
   commit new version), `ChangeNotificationSequence` (commit → notify other devices → pull
   metadata delta by cursor → fetch new blocks), `ConflictSequence` (two devices edit the
   same base version → second commit detected as stale → conflicted copy).
8. **Chunking & Deduplication** — the first deep dive: split files into chunks (fixed vs.
   content-defined chunking and why CDC resists the "insert a byte shifts everything"
   problem), hash each chunk, address blocks by hash so identical content is stored once
   (dedup across files, versions, and users), and how the dedup ratio drives the storage
   bill. Include a `<KnowledgeCheck>`.
9. **Delta Sync** — only transfer the chunks that changed. The client diffs the new file's
   chunk list against the last-synced one, uploads just the new blocks, and commits a version
   that references the unchanged blocks by hash. This is the bandwidth win and depends
   directly on content-defined chunking. Include a `<KnowledgeCheck>`.
10. **Sync Protocol & Notifications** — how devices converge: a per-namespace monotonic
    **cursor / change journal**, devices pull `delta since cursor`, and a long-poll/push
    **notification** channel makes it near-real-time instead of polling. Cover offline →
    reconnect → catch-up. Include a `<KnowledgeCheck>`.
11. **Metadata Store & Namespace** — why metadata is a separate, sharded, transactional
    store; sharding by user/namespace to keep a user's tree and journal co-located;
    listing a folder, moving/renaming (a metadata-only operation that touches no blocks), and
    why the namespace tree is the hot path. Include a `<KnowledgeCheck>`.
12. **Sharing & Permissions** — sharing a file or folder, ACLs, permission **inheritance**
    down a folder subtree, and the read path for a shared item (resolve effective permission,
    then serve blocks). The hard part: a shared folder appears in multiple users' namespaces
    pointing at the same underlying nodes/blocks.
13. **Versioning & History** — every commit creates an immutable `FileVersion` (a block
    list), so history and point-in-time restore are nearly free; dedup means versions share
    unchanged blocks; retention/pruning policy and how delete + restore work (tombstones,
    trash). Include a `<KnowledgeCheck>` if space allows.
14. **Scalability & Evolution** — `TradeoffTable`: single server + local disk → object store
    + metadata DB → add dedup/delta + notification sync → multi-region with geo-replicated
    blocks and metadata.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): block storage durability/loss,
    metadata DB outage, a half-committed upload (blocks up but commit failed), sync conflict /
    divergent devices, notification channel down (fall back to polling), hot share /
    thundering download, and a corrupt/garbage-collected block referenced by a version.
16. **Trade-offs & Alternatives** — `DecisionRecord`: metadata/block split with
    content-addressed dedup, delta sync, cursor+notification sync, conflicted copies; axes:
    content-defined vs fixed chunking, dedup scope (global vs per-user), sync by polling vs
    notifications, conflicted copy vs operational merge.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, cloud-drive-specific
- `lib/cloud-drive-estimates.ts` — pure capacity calc with typed
  `CloudDriveCapacityAssumptions` / `CloudDriveCapacityResults`.
- `components/learning/cloud-drive-capacity.tsx` — wrapper over `CapacityTable`, registered
  as `CloudDriveCapacity`.
- `components/diagrams/cloud-drive-architecture.tsx` — `CloudDriveArchitecture`: client →
  sync gateway → metadata service/DB + block service/object store; notification service.
  `role="img"` + caption naming the metadata/block split, content-addressed deduplication,
  delta sync.
- `components/diagrams/cloud-drive-flows.tsx` — `FileUploadSequence`, `DeltaSyncSequence`,
  `ChangeNotificationSequence`, `ConflictSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `cloud-drive` entry (18 sections).
- `lib/curriculum.ts` — flip `cloud-drive` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/cloud-drive.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the ninth slug's MDX.

## Capacity Model (exact)

`lib/cloud-drive-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`.
Float-derived results are asserted with `toBeCloseTo` in the test.

Assumptions used in the MDX embed and the test:
```ts
{
  totalUsers: 500_000_000,
  avgStorageGbPerUser: 10,
  dedupRatio: 0.3,
  dailyActiveUsers: 50_000_000,
  avgDailyEditsPerActiveUser: 100,
  avgEditBytes: 4_000_000,
  deltaSyncFraction: 0.1,
}
```

Results (deterministic):
- `rawStorageEb` = 500,000,000 × 10 GB × 1e9 / 1e18 = **5** EB raw stored bytes
- `physicalStorageEb` = 5 × (1 − 0.3) = **3.5** EB after deduplication
- `metadataWritesPerSecond` = 50,000,000 × 100 / 86,400 ≈ **57,870.37** writes/sec
- `naiveUploadGbPerSecond` = metadataWritesPerSecond × 4,000,000 / 1e9 ≈ **231.48** GB/s
- `deltaUploadGbPerSecond` = naiveUploadGbPerSecond × 0.1 ≈ **23.15** GB/s

Headline lesson: raw storage is **exabyte scale** (5 EB), so content lives in **object
storage**, not a database; **deduplication** alone removes 1.5 EB (5 → 3.5 EB). **Metadata**
is tiny in bytes but runs at **~58k writes/sec**, demanding a separate, sharded,
transactional metadata store. And **upload bandwidth** would be ~231 GB/s if every edit
re-sent the whole file; **delta sync** (send only changed chunks) cuts it ~10× to ~23 GB/s.
Dedup shrinks what's stored, delta sync shrinks what's moved — together they make a cloud
drive economically possible.

## Numerical & Terminology Invariants

- File content lives in **object storage** addressed by **content hash** (content-addressed);
  file **metadata** (namespace tree, versions, ACLs, block lists) lives in a separate,
  **sharded transactional** store. The **metadata/block split** is the defining decision.
- Files are split into **chunks/blocks** (content-defined chunking); each unique block is
  **stored once** (**deduplication**); a **FileVersion** is an ordered **list of block
  hashes**, immutable.
- **Delta sync** transfers only the chunks that changed; unchanged blocks are referenced by
  hash, not re-uploaded.
- Devices converge via a **cursor / change journal** (pull `delta since cursor`) plus a
  **notification** channel for near-real-time push; concurrent offline edits become a
  **conflicted copy** (no write is lost) — not an operational merge.
- The top non-functional bar is **durability** (e.g. 11 nines); the cache/CDN and replicas
  serve availability and latency.

## Out of Scope

Real-time co-editing / OT-CRDT merge of one document (Collaborative Document Editor),
full-text content search, thumbnail/preview transcoding, E2E encryption / key management
beyond a mention, the client UI, billing, and any change to other tutorials.
