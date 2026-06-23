# Notification Service Tutorial — Design Spec

**Date:** 2026-06-23
**Status:** Approved for planning
**Curriculum slug:** `notification-service` (sequence 4, Intermediate)

## Goal

Author the fourth curriculum tutorial — and the first **Intermediate**, **async /
queue-centric** one: an interview-grade walkthrough of designing a **multi-channel
Notification Service** that fans out push, SMS, and email reliably, with retries,
deduplication, and user preferences.

This is a deliberate change of shape from the first three tutorials (all read-heavy
storage systems). The centerpiece is the **asynchronous delivery pipeline**: an
event is accepted fast, fanned out across channels through message queues, delivered
by per-channel workers to external providers, retried with backoff on failure, and
dead-lettered when it can't be delivered — all **idempotently**, because at-least-once
queues plus flaky providers make duplicate-suppression mandatory.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed
registry, learning components, diagram primitives, shared `CapacityTable`). New work
is Notification-specific content, a capacity module + wrapper, one architecture
diagram, four flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a service other systems call to notify a user ("your order
shipped"). The service resolves the user's channel preferences, renders per-channel
templates, and delivers via external providers (APNs/FCM for push, an SMS gateway,
an email provider), reliably and at scale. The defining tensions are:

- **Decoupling** — accept the send request in milliseconds and do the slow,
  failure-prone provider delivery asynchronously, so a flaky SMS gateway never blocks
  the caller.
- **Reliability** — at-least-once delivery with retries and a dead-letter queue, made
  safe by **idempotency** so retries and duplicate requests don't spam the user.
- **Fan-out** — one logical notification becomes N per-channel deliveries, each with
  its own preference checks, rate limits, and provider.

**In scope:** the async ingestion→queue→fan-out→channel-worker→provider pipeline,
delivery guarantees and idempotency/dedup, retries with backoff + DLQ, user
preferences (channels, opt-out, quiet hours, per-user rate limiting), templates,
scaling, and failure modes.

**Out of scope (mention, then set aside):** in-app notification feeds / inbox
(closer to the News Feed problem), the WebSocket fan-out for real-time presence (the
Chat problem), marketing-campaign authoring tools, and building the email/SMS
providers themselves (we integrate with them).

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
| 8 | `fanout-pipeline` | Fan-out Pipeline | advanced |
| 9 | `delivery-guarantees` | Delivery Guarantees & Idempotency | advanced |
| 10 | `retries-dlq` | Retries & Dead-Letter Queue | advanced |
| 11 | `user-preferences` | Preferences & Rate Limiting | advanced |
| 12 | `scalability-evolution` | Scalability & Evolution | advanced |
| 13 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 14 | `security-abuse` | Security & Abuse | advanced |
| 15 | `observability` | Observability | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a notification service does, why async (decouple from
   slow providers), where it sits (a platform service other systems call). Scope; a
   `Callout variant="interview"` with a 45-min allocation. Reframe: the hard parts are
   reliable async delivery and idempotency, not "call the SMS API."
2. **Requirements** — `RequirementsTable`. Functional: accept a send request; fan out
   to multiple channels (push/SMS/email); honor user preferences and opt-outs; retry
   transient failures; dedup duplicate sends; templated content; delivery status.
   Non-functional: accept latency p99 < 50 ms (async); at-least-once delivery; no
   duplicate user-visible notifications (idempotent); 99.9% availability; high
   throughput; bounded delivery latency (seconds, not the accept path).
3. **Capacity Estimates** — `NotificationCapacity` fed by `lib/notification-estimates.ts`.
   Derive accept QPS, the **fan-out amplification** (sends → deliveries → attempts with
   retries), peak delivery QPS, and daily delivery volume. Headline: the delivery tier,
   amplified by fan-out and retries, is what you size — not ingestion.
4. **Entity Model** — `EntityModel name="Notification"` for the per-channel delivery
   record (id, request_id, user_id, channel, idempotency_key, template_id, status,
   attempts, next_attempt_at, provider_message_id, created_at). Prose on the related
   `NotificationRequest`, `UserPreference`, and `Template` entities.
5. **API Design** — `ApiContract`: `POST /v1/notifications` returning **202 Accepted**
   (async) with an `Idempotency-Key` request header, and `GET /v1/notifications/{id}`
   for status. Note 202-not-200 because delivery is asynchronous.
6. **High-Level Architecture** — `NotificationArchitecture` diagram: producer → API /
   ingestion → message queue → fan-out service → per-channel queues → channel workers →
   external providers, plus a preference service, a dedup/idempotency store, and a DLQ.
7. **Detailed Flows** — `SendFanoutSequence`, `RetryBackoffSequence`,
   `DeadLetterSequence`, `IdempotentSendSequence`.
8. **Fan-out Pipeline (centerpiece)** — why async + queues; the topology (single
   ingestion queue → fan-out → per-channel queues so a slow channel can't head-of-line
   block others); per-channel workers and provider adapters; back-pressure.
9. **Delivery Guarantees & Idempotency** — at-least-once is the practical default;
   exactly-once is a myth across external providers, so you get **effectively-once**
   via idempotency keys + a dedup store (check-and-set on the key) so retries and
   duplicate requests don't notify the user twice.
10. **Retries & DLQ** — classify failures (transient vs permanent); exponential backoff
    with jitter; per-attempt and total retry budgets; the **dead-letter queue** for
    exhausted/poison messages; replay from the DLQ after a fix.
11. **Preferences & Rate Limiting** — per-user channel preferences, global/granular
    opt-out (and legal must-honor for some channels), quiet hours, and per-user rate
    limiting / digest collapsing so the service never floods a user. Ties back to the
    Rate Limiter tutorial.
12. **Scalability & Evolution** — `TradeoffTable` of stages: synchronous direct-send →
    async single queue + workers → per-channel queues + autoscaled worker pools →
    partitioned/sharded by user + multi-region providers.
13. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): provider outage, queue
    backlog/lag, poison message, duplicate delivery, worker crash mid-delivery,
    dedup-store outage, preference-service outage.
14. **Security & Abuse** — authN/authZ for senders, per-sender rate limits (spam
    prevention), PII in payloads (minimize, encrypt, short retention), provider
    credential management, unsubscribe/compliance (CAN-SPAM/GDPR), template injection.
15. **Observability** — SLIs/SLOs: accept latency, end-to-end delivery latency, per-
    channel success/failure rates, retry rate, DLQ depth, queue lag, dedup hit rate.
16. **Trade-offs & Alternatives** — `DecisionRecord` for async-queue + at-least-once +
    idempotent + per-channel-queue + DLQ; axes: sync vs async, at-least-once vs
    exactly-once, single vs per-channel queues, push vs pull workers.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`,
diagram primitives, shared `CapacityTable`.

### New, Notification-specific
- `lib/notification-estimates.ts` — pure capacity calc with typed
  `NotificationCapacityAssumptions` / `NotificationCapacityResults`.
- `components/learning/notification-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `NotificationCapacity`.
- `components/diagrams/notification-architecture.tsx` — `NotificationArchitecture`:
  ingestion → queue → fan-out → per-channel queues → channel workers → providers, with
  preference store, dedup store, DLQ. `role="img"` + caption naming queue / fan-out /
  retries / dead-letter.
- `components/diagrams/notification-flows.tsx` — `SendFanoutSequence`,
  `RetryBackoffSequence`, `DeadLetterSequence`, `IdempotentSendSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `notification-service` entry (18 sections).
- `lib/curriculum.ts` — flip `notification-service` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/notification-service.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the fourth slug's MDX.

## Capacity Model (exact)

`lib/notification-estimates.ts` uses `SECONDS_PER_DAY = 24*60*60 = 86_400`.

Assumptions used in the MDX embed and the test:
```ts
{
  notificationsPerDay: 500_000_000,
  fanoutFactor: 2,           // avg channels per notification
  peakMultiplier: 4,
  retryOverheadPercent: 20,  // extra delivery attempts from retries
  avgPayloadBytes: 1000,
}
```

Results (deterministic):
- `averageSendQps` = 500,000,000 / 86,400 ≈ **5787.04**
- `averageDeliveryQps` = 5787.04 × 2 ≈ **11574.07**
- `peakDeliveryQps` = 11574.07 × 4 ≈ **46296.30**
- `deliveryAttemptsPerSecond` = 11574.07 × 1.20 ≈ **13888.89**
- `dailyDeliveries` = 500,000,000 × 2 = **1,000,000,000**

Headline lesson: **fan-out and retries amplify load downstream.** 500M sends/day is
~5.8k accept QPS, but fan-out doubles that to ~11.6k deliveries/sec, retries push
attempts to ~13.9k/sec, and peak hits ~46k deliveries/sec — so you size the *delivery*
tier and provider throughput, not the cheap accept path.

## Numerical & Terminology Invariants

- Stated send volume matches the fan-out/retry derivation.
- The accept API returns **202 Accepted** (async), not 200.
- Default delivery guarantee is **at-least-once**; exactly-once across external
  providers is unattainable, so the system is **idempotent / effectively-once** via an
  idempotency key + dedup store.
- Retries use **exponential backoff with jitter**; exhausted/poison messages go to a
  **dead-letter queue**, not infinite retry.
- Per-channel queues prevent a slow channel from head-of-line blocking the others.

## Out of Scope

In-app notification inbox/feed, real-time WebSocket presence, marketing-campaign
tooling, building the providers themselves, real queue/provider integration (teaching
artifact), and any change to other tutorials.
