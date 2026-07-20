# Object Storage Tutorial — Design Spec

**Date:** 2026-07-20
**Status:** Approved for planning
**Problem:** `object-storage` (curriculum sequence 12, difficulty **Advanced**)

## Goal

Author the **Object Storage** tutorial (`/learn/object-storage`) — an S3/GCS-class system. The reframe:
it *looks* like "a big key-value store for files," but the hard part is **durability at exabyte scale**
(11 nines) achieved with **erasure coding** instead of replication, a **metadata service** indexing a
**flat namespace** of billions of keys separately from the bytes, **multipart upload** for huge objects,
**immutability + versioning**, and continuous **background integrity** (scrubbing/repair) against silent
disk corruption. It shares object-storage DNA with **Cloud Drive** and **Video Streaming** (both sit on
a blob store) but is the tutorial about *building the blob store itself*.

Concepts (from curriculum): **Erasure coding, Durability, Multipart upload, Metadata indexing**.

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
| 8 | `metadata-service` | The Metadata Service & Flat Namespace | advanced |
| 9 | `durability-erasure-coding` | Durability & Erasure Coding | advanced |
| 10 | `write-path-multipart` | The Write Path & Multipart Upload | advanced |
| 11 | `read-path-reconstruction` | The Read Path & Reconstruction | advanced |
| 12 | `background-integrity` | Scrubbing, Repair & Rebalancing | advanced |
| 13 | `consistency-versioning` | Consistency, Immutability & Versioning | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: it's not a filesystem or a KV store; it's a **durability engine** for immutable
   blobs at exabyte scale. The hard parts: 11-nines durability affordably (erasure coding), a flat
   namespace of billions of keys (metadata indexing), huge objects (multipart), and silent corruption
   (scrubbing). `Callout variant="interview"` 45-min plan.
2. **Requirements** — functional: PUT/GET/DELETE objects, list, multipart upload, versioning. Non-func:
   **extreme durability (11 nines)**, high availability, **scale to exabytes / trillions of objects**,
   throughput for huge objects, **strong read-after-write** for new objects, cost efficiency. Objects are
   **immutable**. `RequirementsTable`.
3. **Capacity** — `ObjectStorageCapacity`. Lesson: at exabyte scale durability comes from **erasure
   coding, not replication** — 8+4 gives **1.5× overhead** (vs 3× replication) while tolerating **4**
   simultaneous fragment losses, halving the storage bill. Metadata is tiny vs data but has huge
   *object count*.
4. **Entity Model** — `Object` = key (bucket + key) + immutable blob + metadata (size, checksum,
   content-type, version, storage class) + fragment locations; **flat namespace** (no real directories).
   `EntityModel`.
5. **API Design** — `PUT /{bucket}/{key}` (put), `GET /{bucket}/{key}` (get), multipart
   (`POST ...?uploads` initiate → `PUT ...?partNumber` → `POST ...?uploadId` complete). Three
   `ApiContract`s.
6. **High-Level Architecture** — `ObjectStorageArchitecture` HLD: client → object API → metadata service
   (key→fragment locations) + erasure coder → storage nodes (fragments across failure domains); a
   scrubber/repair background service.
7. **Detailed Flows** — four sequences (below).
8. **Metadata Service & Flat Namespace** — object storage is a **flat** key→object map (not a tree);
   "folders" are just key prefixes, LIST is a prefix scan. The **metadata service** (key → size,
   checksum, version, fragment locations) is separate from the data plane, must index **billions–
   trillions** of keys, and is **sharded** (by key hash / range). Small per entry, enormous in count.
   `KnowledgeCheck`.
9. **Durability & Erasure Coding** — the centerpiece: **replication (3×)** is simple but expensive at
   scale; **erasure coding (Reed-Solomon k+m)** splits an object into **k data + m parity** fragments so
   **any k of k+m** reconstruct it, tolerating **m** losses at **(k+m)/k** overhead (8+4 → 1.5×). Spread
   fragments across **independent failure domains** (disks, racks, AZs) so correlated failures don't
   exceed m. This is how 11-nines durability is affordable. Trade: CPU to encode/decode, read
   reconstruction cost. `KnowledgeCheck`.
10. **Write Path & Multipart Upload** — PUT: checksum → erasure-code into fragments → distribute across
    failure domains → **commit metadata last** (so a half-written object is never visible; orphaned
    fragments GC'd). **Multipart upload** for large objects: initiate → upload **parts in parallel**
    (each independently retryable/resumable) → complete (assemble the part list); essential for
    multi-GB/TB objects and flaky networks. `KnowledgeCheck` may live here.
11. **Read Path & Reconstruction** — GET: metadata lookup → fetch fragments → if all k data fragments are
    present, concatenate (fast path); if some are missing/slow, fetch parity and **reconstruct**. Only
    **any k** fragments are needed, so a slow or dead node is simply bypassed (tail-latency + failure
    tolerance for free). Range reads, streaming. `KnowledgeCheck`.
12. **Scrubbing, Repair & Rebalancing** — disks suffer **silent corruption (bit rot)**; a **scrubber**
    continuously re-reads fragments, verifies **checksums**, and on a bad/lost fragment **reconstructs**
    it from the survivors and rewrites it, **restoring redundancy** before too many are lost. Also
    **rebalancing** on node add/remove/failure. This background integrity is what *sustains* durability
    over time. `Callout`. Embed `<ScrubRepairSequence />`.
13. **Consistency, Immutability & Versioning** — objects are **immutable**: a PUT to an existing key
    writes a **new version**, never edits in place — which simplifies caching, dedup, and consistency.
    Modern object stores give **strong read-after-write** for new objects (metadata commit is the
    linearization point) and eventual for overwrites/lists. **Versioning** keeps old versions;
    **delete** is a tombstone. `KnowledgeCheck`.
14. **Scalability & Evolution** — staged `TradeoffTable` (single-node blob store → replicated → metadata-
    sharded + erasure-coded across failure domains → multi-region + tiering).
15. **Resiliency & Failure Modes** — `FailureMatrix` (disk/node loss + EC reconstruct, silent corruption,
    metadata shard loss, correlated rack/AZ failure, half-written object, hot object, capacity
    exhaustion).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (erasure coding vs replication; metadata/data
    split; immutability; strong vs eventual consistency).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `PutObjectSequence` — client → API → erasure coder → storage + metadata: checksum → erasure-code into
  k+m fragments → distribute across failure domains → commit metadata last → ack. Caption: the metadata
  is committed last, so a half-written object is never visible.
- `MultipartUploadSequence` — initiate → upload parts in parallel → complete: each part is uploaded and
  stored independently, then a complete call assembles the parts into one object. Caption: each part
  uploads and retries independently, so huge objects survive flaky networks.
- `GetObjectSequence` — client → API → metadata → storage: look up fragment locations → fetch fragments →
  reconstruct if any are missing → stream. Caption: any k fragments are enough to reconstruct the object,
  so a slow or failed node is simply bypassed.
- `ScrubRepairSequence` — scrubber → storage: re-read fragments and verify checksums → detect a corrupt/
  lost fragment → reconstruct it from the survivors → rewrite. Caption: a background scrubber continuously
  re-reads fragments and repairs silent corruption before redundancy is exhausted.

## Capacity Model (exact)

`lib/object-storage-estimates.ts`, pure & deterministic. `BYTES_PER_PB = 1_000_000_000_000_000`.

Assumptions (MDX embed and test):
```ts
{
  objectsStored: 1_000_000_000_000,
  avgObjectBytes: 1_000_000,
  dataShards: 8,
  parityShards: 4,
  replicationFactor: 3,
}
```

Results:
- `logicalDataPb` = 1e12 × 1e6 / 1e15 = **1000** PB (1 EB)
- `erasureStoredPb` = 1000 × (8+4)/8 = 1000 × 1.5 = **1500** PB
- `replicationStoredPb` = 1000 × 3 = **3000** PB
- `storageSavedPb` = 3000 − 1500 = **1500** PB
- `fragmentFailuresTolerated` = **4** (= parityShards)

Lesson: at exabyte scale, **durability comes from erasure coding, not replication**. Storing 1 EB with
8+4 Reed-Solomon uses **1.5 EB** of raw capacity (1.5× overhead) and survives **any 4** simultaneous
fragment losses — versus **3× replication** needing **3 EB** for comparable durability. That halves the
storage bill (**saves ~1500 PB**), at the cost of CPU to encode/decode and reconstruction on degraded
reads. Metadata is tiny by bytes but enormous by **object count** (a trillion keys), which is why the
metadata service is sharded and separate from the data plane.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/object-storage-estimates.ts` + test; `components/learning/object-storage-capacity.tsx`
(`ObjectStorageCapacity`); `components/diagrams/object-storage-architecture.tsx`
(`ObjectStorageArchitecture`); `components/diagrams/object-storage-flows.tsx` (`PutObjectSequence`,
`MultipartUploadSequence`, `GetObjectSequence`, `ScrubRepairSequence`). Register all in
`mdx-components.tsx`.

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `object-storage` → `available`;
`app/learn/[slug]/page.tsx` import + map; `content/tutorials/object-storage.mdx`;
`tests/tutorial-registry.test.ts` (add to registered keys, after `notification-service` before `pastebin`
in the sorted array; + 18-section assertion; **repoint the "returns undefined" slug from `object-storage`
to `photo-sharing`** since object-storage is now registered); `tests/curriculum.test.ts` (insert
`object-storage` into the available list **after `video-streaming`, before `ticket-booking`** — seq 12);
`tests/object-storage-content.test.ts`; extend `e2e/pilot.spec.ts` and **decrement the "coming soon"
count by one (13 → 12)**.

## Invariants

- Object storage is a **flat key→immutable-blob namespace**; "folders" are key prefixes; LIST is a prefix
  scan. **Metadata (key→locations) is separated from data** and sharded across billions/trillions of keys.
- **Durability via erasure coding** (Reed-Solomon **k+m**): any **k** of **k+m** fragments reconstruct;
  tolerates **m** losses at **(k+m)/k** overhead (8+4 → 1.5×, tolerates 4) — vs 3× replication. Spread
  fragments across **independent failure domains**.
- Write: erasure-code → distribute → **commit metadata last** (atomic visibility; GC orphans). **Multipart
  upload** = parallel, independently-retryable parts for huge objects.
- Read: fetch **any k** fragments; reconstruct if degraded, so slow/dead nodes are bypassed.
- **Scrubbing** re-reads + checksums fragments and **repairs** silent corruption to restore redundancy —
  what sustains durability over time.
- Objects **immutable**; PUT-over-key = new **version**; **strong read-after-write** for new objects.
- Capacity: 1 EB logical ⇒ 1.5 EB stored (EC) vs 3 EB (replication), ~1500 PB saved; tolerates 4 losses.

## Commit sequence

1. `docs: design spec and plan for Object Storage tutorial`
2. `feat: add Object Storage capacity model and wrapper`
3. `feat: add Object Storage architecture and flow diagrams`
4. `feat: register Object Storage tutorial route and skeleton`
5. `content: complete Object Storage tutorial`
6. `test: verify Object Storage tutorial flow end-to-end`
