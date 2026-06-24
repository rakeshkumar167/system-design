# Collaborative Document Editor Tutorial — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Curriculum slug:** `collaborative-doc-editor` (sequence 22, Advanced)

## Goal

Author the seventh complete curriculum tutorial — and the first **real-time
collaborative / conflict-free convergence** one: an interview-grade walkthrough of
designing a **Collaborative Document Editor** (Google-Docs-style) where many users
edit the same document at once and every replica must converge to an identical final
state without a central lock and without losing anyone's edits.

This is a deliberate change of shape from the prior tutorials. Where Ticket Booking
was strong consistency under contention and Video Streaming was an asymmetric
pipeline, this is **optimistic local editing plus eventual convergence**: each client
applies edits to its own replica instantly, ships small operations over a persistent
websocket, and the system reconciles concurrent edits via **operational transformation
(OT)** or **conflict-free replicated data types (CRDTs)** so everyone ends up the same.
The centerpiece is the convergence problem and its two canonical answers, wrapped in a
real-time sync fabric (websockets, fan-out, presence, reconnection).

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed
registry, learning components, diagram primitives, shared `CapacityTable`). New work is
collaborative-editor-specific content, a capacity module + wrapper, one architecture
diagram, four flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a system where multiple people open the same document, type at the
same time, see each other's cursors, and all converge on one consistent document — even
across brief disconnects. The defining tensions are:

- **Concurrent editing without lost updates** — two users editing the same position at
  the same instant must both have their intent preserved and converge to the same
  result. Last-write-wins silently destroys edits; the design exists to prevent that.
- **Optimistic local apply + eventual convergence** — a keystroke must appear instantly
  in the local editor (you can't wait a round trip per character), so each replica edits
  locally and the system reconciles concurrent operations afterward via OT or CRDTs.
- **Real-time sync at fan-out scale** — the load is not bytes but **messages**: every
  small operation fans out to every other collaborator over millions of persistent
  websocket connections, and clients must catch up cleanly after reconnecting.

**In scope:** the concurrent-editing problem, operational transformation, CRDTs, the
real-time sync protocol (websockets, optimistic apply, broadcast, reconnection/catch-up,
document-session sharding), presence/awareness (cursors, selections), persistence and
version history (op log + snapshots + compaction, undo/redo), scaling, and failure modes.

**Out of scope (mention, then set aside):** rich-media embeds and complex rich-text
schema details, the rendering/editor UI, document search/indexing, fine-grained sharing
ACL design (we note access control but don't design the permission system), offline-first
mobile sync beyond reconnection, and audio/video calls inside the doc.

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
| 8 | `concurrent-editing` | The Concurrent-Editing Problem | advanced |
| 9 | `operational-transformation` | Operational Transformation | advanced |
| 10 | `crdts` | Conflict-Free Replicated Data Types | advanced |
| 11 | `realtime-sync` | Real-Time Sync | advanced |
| 12 | `presence-awareness` | Presence & Awareness | advanced |
| 13 | `persistence-history` | Persistence & History | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a collaborative editor does; the reframe: it *looks*
   like a shared text field over websockets, but the hard part is **conflict-free
   convergence** — concurrent edits and offline edits must merge without lost updates
   and converge identically everywhere. Scope; a `Callout variant="interview"` 45-min
   allocation.
2. **Requirements** — `RequirementsTable`. Functional: multiple users edit one doc
   concurrently; see edits in real time; see others' cursors/presence; offline edits
   reconcile on reconnect; version history / undo. Non-functional: **convergence
   (all replicas identical)**, **intention preservation (no lost updates)**, low local
   edit latency (instant local apply), real-time propagation, durability of the doc,
   availability.
3. **Capacity Estimates** — `CollaborativeDocEditorCapacity` fed by
   `lib/collaborative-doc-editor-estimates.ts`. Derive peak inbound op rate, the
   **fan-out message rate** (the dominant load), live websocket connections, daily op
   volume, and op-log storage growth. Headline: the load is **fan-out + persistent
   connections**, not bytes; the op log grows relentlessly so snapshots + compaction
   are mandatory.
4. **Entity Model** — `EntityModel name="Document"` (id, owner_id, title, current
   version/seq, snapshot_key, created_at). Prose on Operation (the unit of change:
   doc_id, seq, author, type insert/delete, position, payload), Snapshot (materialized
   doc at a version), and Presence (ephemeral cursor/selection per user).
5. **API Design** — `ApiContract`: `POST /v1/documents` (create), and the real-time
   channel — `WS /v1/documents/{id}/connect` (the websocket carrying ops + presence),
   with op and ack message shapes; note the catch-up read `GET .../operations?since=`.
6. **High-Level Architecture** — `CollaborativeDocEditorArchitecture`: editor ↔ WS
   gateway → collaboration (document-session) service → op log + snapshot store;
   pub/sub for cross-server fan-out; presence service; metadata DB. Caption names
   operations, convergence, OT/CRDT, fan-out.
7. **Detailed Flows** — `EditBroadcastSequence`, `ConflictResolutionSequence`,
   `PresenceSequence`, `ReconnectSyncSequence`.
8. **The Concurrent-Editing Problem** — why naive approaches fail: last-write-wins
   loses edits; locking kills the experience; position indices shift under concurrent
   edits. Define the two properties to guarantee — **convergence** and **intention
   preservation** — motivating OT and CRDTs. Include a `<KnowledgeCheck>`.
9. **Operational Transformation** — edits as operations; a central server assigns a
   total order and **transforms** each incoming op against the ops it didn't see, so
   concurrent ops apply consistently and converge; server-authoritative, compact, but
   transform functions are subtle. Include a `<KnowledgeCheck>`.
10. **Conflict-Free Replicated Data Types** — give each character/element a unique,
    immutable id with a total order; inserts/deletes are **commutative**, so replicas
    merge without a central transform and converge by construction; peer-friendly and
    offline-friendly, at the cost of metadata/tombstone overhead. Include a
    `<KnowledgeCheck>`.
11. **Real-Time Sync** — the protocol: persistent websocket per editor, **optimistic
    local apply**, send op → server orders/transforms → ack + broadcast; sticky routing
    so one document's session lives on one server (shard by doc_id); reconnection and
    **catch-up from a version vector / since-seq**. Include a `<KnowledgeCheck>`.
12. **Presence & Awareness** — cursors, selections, who's online; **ephemeral**,
    high-frequency, low-durability state carried on a separate channel from durable ops;
    lossy is fine (a dropped cursor frame self-heals), so it's never written to the op log.
13. **Persistence & History** — the **op log** is the source of truth; periodic
    **snapshots** bound replay; **compaction** keeps storage and load times bounded;
    version history and undo/redo fall out of the ordered op log.
14. **Scalability & Evolution** — `TradeoffTable`: single server holding the doc in
    memory → sharded document-session servers + pub/sub fan-out + op log/snapshots →
    OT-or-CRDT convergence + presence channel + reconnection catch-up → multi-region /
    peer-to-peer CRDT and offline-first.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): document-session server
    crash (rehydrate from snapshot + op log), websocket disconnect (client catch-up),
    op-log write failure (don't ack until durable), split session / two primaries for a
    doc (single-writer per doc session), pub/sub lag (fan-out delay), snapshot/compaction
    failure, metadata DB outage.
16. **Trade-offs & Alternatives** — `DecisionRecord`: server-authoritative OT (or a
    sequence CRDT) + optimistic local apply + op log/snapshots + websocket fan-out;
    axes: OT vs CRDT, server-authoritative vs peer-to-peer, op log vs state sync,
    snapshot cadence.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, collaborative-editor-specific
- `lib/collaborative-doc-editor-estimates.ts` — pure capacity calc with typed
  `CollaborativeDocEditorCapacityAssumptions` / `CollaborativeDocEditorCapacityResults`.
- `components/learning/collaborative-doc-editor-capacity.tsx` — wrapper over
  `CapacityTable`, registered as `CollaborativeDocEditorCapacity`.
- `components/diagrams/collaborative-doc-editor-architecture.tsx` —
  `CollaborativeDocEditorArchitecture`: editor ↔ WS gateway → collaboration service →
  op log + snapshot store; pub/sub; presence; metadata DB. `role="img"` + caption
  naming operations / convergence / OT-CRDT / fan-out.
- `components/diagrams/collab-editor-flows.tsx` — `EditBroadcastSequence`,
  `ConflictResolutionSequence`, `PresenceSequence`, `ReconnectSyncSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `collaborative-doc-editor` entry (18 sections).
- `lib/curriculum.ts` — flip `collaborative-doc-editor` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/collaborative-doc-editor.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the seventh slug's MDX.

## Capacity Model (exact)

`lib/collaborative-doc-editor-estimates.ts` is a pure function. All results are exact
integers (or an exact ratio), chosen to avoid float drift in the test.

Assumptions used in the MDX embed and the test:
```ts
{
  peakConcurrentEditors: 2_000_000,
  opsPerEditorPerSecond: 2,
  collaboratorsPerDoc: 4,
  bytesPerOp: 100,
  dailyEditedDocs: 5_000_000,
  opsPerDocPerDay: 2_000,
}
```

Results (deterministic):
- `peakInboundOpsPerSecond` = 2,000,000 × 2 = **4,000,000** ops/sec inbound
- `peakFanoutMessagesPerSecond` = 4,000,000 × (4 − 1) = **12,000,000** broadcast msgs/sec
- `liveConnections` = **2,000,000** persistent websockets held open
- `dailyOps` = 5,000,000 × 2,000 = **10,000,000,000** operations/day
- `dailyOpLogTb` = 10,000,000,000 × 100 / 1e12 = **1** TB/day of op log

Headline lesson: a collaborative editor's load is **fan-out and connection state, not
bandwidth**. Operations are tiny (~100 bytes), but every one is rebroadcast to every
collaborator (4M inbound → 12M outbound msgs/sec), and the system holds millions of
persistent websocket connections — so the scaling unit is messages and connections, not
CPU or bytes. The op log grows ~1 TB/day, relentlessly, which is why snapshots and
compaction are mandatory rather than optional.

## Numerical & Terminology Invariants

- The two guarantees are **convergence** (all replicas reach an identical state) and
  **intention preservation** (no edit is silently lost) — never last-write-wins on text.
- Edits are **operations** applied **optimistically** to the local replica, then
  reconciled: **OT** transforms concurrent ops under a server-assigned total order;
  **CRDTs** make ops commutative via unique element ids so merges are order-independent.
- One document's live session is **single-writer / single-ordering** (shard by doc_id);
  the **op log is the source of truth**, bounded by periodic **snapshots** + compaction.
- **Presence** (cursors) is ephemeral, lossy, and on a separate channel — never the op log.
- The dominant load is **fan-out messages over persistent connections**, not bytes.

## Out of Scope

Rich-text schema details, the editor/rendering UI, document search, sharing/ACL design
(noted, not designed), deep offline-first mobile sync, in-doc calls, real OT/CRDT library
integration (teaching artifact), and any change to other tutorials.
