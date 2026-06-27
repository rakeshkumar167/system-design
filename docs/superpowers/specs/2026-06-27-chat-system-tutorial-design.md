# Chat System Tutorial — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Curriculum slug:** `chat-system` (sequence 10, Advanced)

## Goal

Author the eighteenth complete curriculum tutorial — and the first **real-time messaging /
persistent-connection** one: an interview-grade walkthrough of designing a **Chat System** (à la
WhatsApp, Messenger, Slack DMs) that delivers 1:1 and group messages in real time, to recipients who
may be online or offline, with **ordering** and **delivery guarantees** (sent / delivered / read),
**presence**, and message history — over millions of long-lived connections.

This is a change of shape from the prior tutorials. It *looks* like a CRUD app over a `messages` table
— POST a message, store it, the recipient GETs it — and the point is to show that request/response is
the wrong model: messages must be **pushed** to recipients the instant they arrive, which means
**persistent bidirectional connections** (WebSockets), held open for every online user across a fleet
of **stateful gateway servers**. Three problems dominate, and storing the message is the easy one.
First, the **connection layer**: holding millions of persistent connections, and — because a user is
connected to exactly one gateway — routing a message to *the specific gateway* that holds the
recipient's connection (a user→gateway **session registry**). Second, **delivery and guarantees**:
online recipients get a real-time push; **offline** recipients have the message queued in a per-user
**mailbox** and delivered on reconnect; and the whole thing is **at-least-once** with client **ACKs**
and **dedup**, driving the **sent → delivered → read** receipt state machine. Third, **ordering**:
messages in a conversation must appear in a single consistent order (per-conversation **sequence
numbers**), and **group chat** fans a message out to many members' mailboxes. Plus **presence**
(online / last-seen / typing), which is cheap per event but expensive in fan-out. The reframe to lead
with: *it looks like storing and fetching messages, but the server can't wait to be asked — it must
push over a persistent connection, so the design is a stateful fleet of WebSocket gateways holding
millions of connections, a registry that routes each message to the recipient's gateway, an
online-push / offline-mailbox delivery model with ACK-based at-least-once guarantees, per-conversation
ordering, and presence. Persisting a message is trivial; delivering it in real time to whichever of a
billion users is connected where, in order, exactly once as the user sees it, is the design.*

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry, learning
components, diagram primitives, shared `CapacityTable`). New work is chat-specific content, a capacity
module + wrapper, one architecture diagram, four flow-sequence diagrams, and the registry/curriculum
wiring.

## Framing & Scope

**What we design:** a system that delivers 1:1 and group messages in real time between users who may be
online or offline, with ordering, delivery/read receipts, presence, and durable history. The defining
tensions are:

- **Persistent connections & routing (the centerpiece)** — real-time push requires a **persistent
  bidirectional connection** (WebSocket) per online user, held on a **stateful gateway**; since a user
  is on exactly one gateway, delivering a message means looking up the recipient's gateway in a
  **session registry** and routing to it. Managing millions of these connections is the core scaling
  problem.
- **Delivery model & guarantees** — **online** recipients get a direct push; **offline** recipients
  have messages stored in a per-user **mailbox/inbox** and delivered on reconnect; delivery is
  **at-least-once** with client **ACKs** and **idempotent dedup** (by client-generated message id),
  and the **sent → delivered → read** receipts are a small state machine.
- **Ordering, groups, and presence** — messages within a conversation get a **monotonic
  per-conversation sequence number** so all participants see one order; **group chat** fans a message
  out to all members (write to each member's mailbox); **presence** (online/last-seen/typing) is
  ephemeral, heartbeat-driven, and costly mainly in fan-out.

**In scope:** the WebSocket connection layer and gateway fleet, the session registry / message routing,
the online-push vs offline-mailbox delivery model, delivery guarantees and receipts, ordering and
consistency, group-chat fan-out, and presence/typing — plus scaling, failure modes, and trade-offs.
**Out of scope (mention, then set aside):** end-to-end encryption protocol internals (mention as a
layer), audio/video calling (a separate real-time-media system), the **Notification Service** that
sends a push notification when a user is offline (a separate system we hand off to), rich media
upload/storage internals (treated as a blob reference), and spam/abuse beyond a mention.

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
| 8 | `connection-layer` | WebSockets & Connection Management | advanced |
| 9 | `message-delivery` | Message Delivery & the Mailbox | advanced |
| 10 | `delivery-guarantees` | Delivery Guarantees & Receipts | advanced |
| 11 | `ordering-consistency` | Ordering & Consistency | advanced |
| 12 | `group-chat-fanout` | Group Chat & Fan-out | advanced |
| 13 | `presence-typing` | Presence, Typing & Last-Seen | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a chat system is (real-time 1:1 + group messaging with presence and
   history). The reframe: it *looks* like CRUD over messages, but the server must **push** over a
   **persistent connection**, so the design is a stateful **WebSocket gateway fleet**, a **session
   registry** to route to the recipient's gateway, **online-push / offline-mailbox** delivery with
   **at-least-once + ACK** guarantees, per-conversation **ordering**, and **presence**. Scope; a
   `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: send/receive 1:1 messages; group chat; deliver
   to offline users (on reconnect); delivery + read receipts; presence/last-seen; message history.
   Non-functional: **real-time latency** (sub-second delivery), **persistent connections** (millions
   concurrent), **reliability** (no lost messages — at-least-once + dedup), **ordering** (consistent
   per conversation), **availability**, **durability** (history persisted). Eventual presence
   consistency acceptable.
3. **Capacity Estimates** — `ChatSystemCapacity` fed by `lib/chat-system-estimates.ts`. Derive
   **messages/sec**, **peak concurrent connections**, **gateway server fleet**, **daily message
   storage (TB)**, and **connection memory (TB)**. Headline: the signature constraint is holding ~**100M
   persistent connections** (20% of 500M DAU online at peak), needing ~**1,000 stateful gateways**
   (~100k conns each) and ~**1 TB** of connection memory; message throughput (~**231k msgs/sec**, ~**4
   TB/day**) is ordinary — the connections, not the message rate, are the hard part.
4. **Entity Model** — `EntityModel name="Message"` (message_id, conversation_id, sender_id, content,
   seq, created_at, status). Prose on the **Conversation** (1:1 or group + members), the per-user
   **Mailbox** (offline/pending messages), the **session registry** (user→gateway connection mapping),
   and that messages are **ordered by a per-conversation seq** and **deduped by client-generated
   message_id**.
5. **API Design** — `ApiContract`: `GET /ws` (WebSocket upgrade — establish the persistent connection,
   authenticate), `POST /messages` (send a message — logically over the socket; returns the assigned
   seq + ack), and `GET /conversations/{id}/messages` (paginated history / offline sync on reconnect).
   Emphasize that the real "API" is a persistent socket carrying framed events, not request/response.
6. **High-Level Architecture** — `ChatArchitecture`: sender's client ↔ a **WebSocket gateway**; gateway
   → **message service** which **persists** to the message store, **looks up** the recipient's gateway
   in the **session registry**, and **routes** the message to it for a real-time push to the recipient
   — or, if offline, writes it to the recipient's **mailbox**; a **presence service** tracks online
   state via heartbeats. Caption names the persistent-connection gateways, the session-registry
   routing, online-push vs offline-mailbox, and presence.
7. **Detailed Flows** — `SendMessageSequence` (client → gateway → message service → persist → look up
   recipient session → route to recipient gateway → push), `OfflineDeliverySequence` (recipient offline
   → store in mailbox → on reconnect, sync/pull pending → deliver), `DeliveryReceiptSequence` (recipient
   ACKs delivered → propagated to sender → read receipt on open), `PresenceUpdateSequence` (heartbeat →
   presence service updates status → fan-out to subscribers).
8. **WebSockets & Connection Management** — why request/response (polling/long-polling) is wrong and
   **WebSockets** (persistent, full-duplex) are right for server-push; the **gateway fleet** holds
   millions of stateful connections (sized by connections/server); a user is on **one** gateway, so a
   **session registry** maps user→gateway for routing; handling **connection lifecycle** (auth on
   connect, heartbeats/keepalive, reconnect with backoff, graceful gateway drain). Include a
   `<KnowledgeCheck>`.
9. **Message Delivery & the Mailbox** — the two delivery paths: **online** (route through the session
   registry to the recipient's gateway and push immediately) and **offline** (write to the recipient's
   **mailbox/inbox**, a per-user durable queue of undelivered messages, drained on reconnect). The
   message is **persisted first** (durability), then delivered; group sends fan out to each member's
   mailbox. Hand off to the **Notification Service** for an out-of-app push when offline. Include a
   `<KnowledgeCheck>`.
10. **Delivery Guarantees & Receipts** — networks drop, so delivery is **at-least-once**: the server
    retries until the client **ACKs**, and the client **dedups** by the **client-generated message_id**
    (idempotency), so a redelivered message isn't shown twice. The **sent → delivered → read** lifecycle
    is a small state machine driven by ACKs (server-stored, delivered-ACK, read-ACK), each propagated
    back to the sender. Exactly-once *display* = at-least-once delivery + idempotent dedup. Include a
    `<KnowledgeCheck>`.
11. **Ordering & Consistency** — within a conversation, all participants must see **one order**, so each
    message gets a **monotonic per-conversation sequence number** assigned by the message service (the
    conversation is the ordering/partition unit); clients order by seq, not by wall-clock (clocks skew).
    Concurrent sends are serialized by the sequencer; gaps trigger a re-sync. Cross-conversation order
    doesn't matter. Include a `<KnowledgeCheck>`.
12. **Group Chat & Fan-out** — a group message must reach all members: **fan-out on write** to each
    member's mailbox/connection (like the News Feed, but smaller groups and stronger delivery needs).
    Small groups are cheap; **large groups** (thousands) are the hot-user analog — bounded fan-out,
    possibly pull for very large broadcast groups. One copy of the message in the store, fanned out as
    references; per-member delivery state. Include a `<KnowledgeCheck>`.
13. **Presence, Typing & Last-Seen** — **presence** (online/offline/last-seen) and **typing**
    indicators are **ephemeral**, **heartbeat**-driven state held in a fast store, not the durable
    message path. The cost isn't storage but **fan-out**: every presence change must notify everyone
    subscribed to that user, which can amplify badly — so presence is often throttled, batched, and
    scoped to open conversations. Last-seen is a timestamp updated on heartbeat/disconnect.
14. **Scalability & Evolution** — `TradeoffTable`: HTTP polling → long-polling → WebSocket gateways +
    session registry + mailbox → globally distributed gateways, sharded mailboxes, regional presence,
    with the Notification Service for offline push.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): gateway dies (connections drop → clients
    reconnect to another, re-register; in-flight redelivered via at-least-once), session-registry loss
    (can't route → rebuild from reconnects; degrade), message-store outage (can't persist → reject send
    over accept-and-lose), mailbox lag (offline delivery delayed; sync on reconnect), duplicate delivery
    (idempotent dedup by message_id), out-of-order/gap (re-sync by seq), presence storm (throttle/batch).
    Guiding rule: **never lose or duplicate a message as the user sees it; degrade presence before
    messaging.**
16. **Trade-offs & Alternatives** — `DecisionRecord`: WebSocket gateways + session-registry routing,
    online-push/offline-mailbox, at-least-once + client dedup, per-conversation seq ordering, group
    fan-out, ephemeral presence. Axes: WebSocket vs long-poll, push-to-gateway vs shared message bus,
    at-least-once+dedup vs exactly-once, per-conversation seq vs global order, presence fan-out vs cost.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `FailureMatrix`,
`DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram primitives, shared `CapacityTable`.

### New, chat-specific
- `lib/chat-system-estimates.ts` — pure capacity calc with typed
  `ChatSystemCapacityAssumptions` / `ChatSystemCapacityResults`.
- `components/learning/chat-system-capacity.tsx` — wrapper over `CapacityTable`, registered as
  `ChatSystemCapacity`.
- `components/diagrams/chat-system-architecture.tsx` — `ChatArchitecture`. `role="img"` + caption
  naming the persistent-connection gateways, session-registry routing, online-push/offline-mailbox,
  and presence.
- `components/diagrams/chat-system-flows.tsx` — `SendMessageSequence`, `OfflineDeliverySequence`,
  `DeliveryReceiptSequence`, `PresenceUpdateSequence`. (NOTE: `PresenceSequence` and
  `ReconnectSyncSequence` already exist from collab-editor — use the distinct names above to avoid
  collisions; no aliasing needed.)

### Wiring
- `lib/tutorial-registry.ts` — add the `chat-system` entry (18 sections).
- `lib/curriculum.ts` — flip `chat-system` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/chat-system.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the eighteenth slug's MDX.
- `tests/tutorial-registry.test.ts` — the "returns undefined for unregistered" slug must change from
  `chat-system` (now registered) to a still-`coming-soon` slug — **`object-storage`** (seq 12).

## Capacity Model (exact)

`lib/chat-system-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`, `BYTES_PER_TB = 1e12`.
Integer `gatewayServersNeeded` uses `Math.ceil`; float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  dailyActiveUsers: 500_000_000,
  messagesPerUserPerDay: 40,
  peakOnlineFraction: 0.2,
  connectionsPerServer: 100_000,
  avgMessageBytes: 200,
  bytesPerConnection: 10_000,
}
```

Results (deterministic):
- `messagesPerSec` = 500,000,000 × 40 / 86,400 ≈ **231,481.48** /s
- `concurrentConnections` = 500,000,000 × 0.2 = **100,000,000**
- `gatewayServersNeeded` = ceil(100,000,000 / 100,000) = **1,000**
- `dailyStorageTb` = 500,000,000 × 40 × 200 / 1e12 = **4** TB
- `connectionMemoryTb` = 100,000,000 × 10,000 / 1e12 = **1** TB

Headline lesson: the message *throughput* is ordinary — 500M users × 40 messages/day is ~**231,481
messages/sec** and ~**4 TB/day** of stored history, a routine write rate. The **signature constraint is
the connections**: at peak ~20% of 500M users are online, so the system must hold ~**100 million
persistent WebSocket connections** simultaneously, which is what forces a fleet of ~**1,000 stateful
gateway servers** (~100k connections each) and ~**1 TB** of connection memory — and, because each user
sits on exactly one gateway, a **session registry** to route every message to the right gateway. That
is the fundamental difference from a request/response service: you don't scale by adding stateless
boxes behind a load balancer; you hold millions of long-lived, stateful connections and route between
them. The system is hard because of the **connection layer and routing**, not because storing a message
is difficult.

## Numerical & Terminology Invariants

- Real-time delivery requires a **persistent bidirectional connection** (**WebSocket**) per online
  user, held on a **stateful gateway**; a user is on **one** gateway, so a **session registry**
  (user→gateway) routes each message.
- **Connections are the constraint:** ~**100M** concurrent connections (20% of 500M DAU), ~**1,000**
  gateways (~100k conns each), ~**1 TB** connection memory; message rate ~**231k/sec**, ~**4 TB/day** —
  ordinary.
- Delivery: **online push** vs **offline mailbox** (per-user pending queue, drained on reconnect);
  **at-least-once** + client **ACK** + **dedup by client message_id** ⇒ exactly-once *display*; the
  **sent → delivered → read** receipt state machine.
- **Ordering** by a **monotonic per-conversation sequence number** (the conversation is the partition
  unit); clients order by seq, not wall-clock. **Group chat** = fan-out on write to members' mailboxes.
- **Presence/typing** is **ephemeral, heartbeat-driven**; its cost is **fan-out**, so it's throttled
  and scoped. Offline out-of-app pushes hand off to the **Notification Service**.

## Out of Scope

End-to-end encryption protocol internals (mention as a layer), audio/video calling, the Notification
Service that sends offline push notifications, rich-media upload/storage internals (blob reference),
spam/abuse beyond a mention, and any change to other tutorials.
