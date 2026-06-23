# Ticket Booking System Tutorial — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Curriculum slug:** `ticket-booking` (sequence 16, Advanced)

## Goal

Author the fifth complete curriculum tutorial — and the first **strongly-consistent,
high-contention** one: an interview-grade walkthrough of designing a **Ticket Booking
System** that sells limited inventory (seats) under heavy concurrent demand **without
ever overselling a single seat**.

This is a deliberate change of shape from the prior tutorials (read-heavy storage and
async fan-out). The centerpiece is **concurrency control**: the core invariant — one
seat is sold at most once — must hold while a million people stampede a hot on-sale.
Everything follows from that: a reservation/hold lifecycle, atomic conditional updates
(optimistic vs pessimistic locking), strong consistency on the inventory of record, an
idempotent hold→pay→confirm saga, and contention management (virtual waiting room,
sharding by event).

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed
registry, learning components, diagram primitives, shared `CapacityTable`). New work is
ticket-booking-specific content, a capacity module + wrapper, one architecture diagram,
four flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a system where users browse a seat map for an event, hold seats
while they pay, and confirm a booking — and where the same seat must never be sold to
two people. The defining tensions are:

- **Correctness under contention** — at a hot on-sale, far more users than seats arrive
  in seconds, all racing for the same rows. The system must serialize access to each
  seat so exactly one buyer wins, and reject the rest instantly.
- **Reservations** — buying takes time (choosing, paying), so a seat is **held** with a
  TTL while the user checks out, then **booked** on payment, or **released** on expiry.
- **Strong consistency** — inventory is the source of truth; you cannot oversell on
  stale/eventually-consistent reads, so seat state lives in a strongly consistent store
  and changes through atomic, conditional transactions.

**In scope:** the seat/inventory model, the hold→pay→confirm reservation lifecycle,
concurrency control (optimistic vs pessimistic locking, atomic conditional updates),
strong consistency on inventory, the idempotent payment saga and compensation,
high-contention on-sale management (waiting room, sharding), scaling, failure modes,
and abuse (scalper bots).

**Out of scope (mention, then set aside):** dynamic/surge pricing engines, seat-map
rendering/UX, fraud-scoring ML, the payment processor's internals (we integrate with
one), and post-purchase ticket transfer/resale marketplaces.

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
| 8 | `reservation-lifecycle` | Reservation Lifecycle | advanced |
| 9 | `concurrency-control` | Concurrency Control | advanced |
| 10 | `strong-consistency` | Strong Consistency | advanced |
| 11 | `payment-saga` | Payment & Booking Saga | advanced |
| 12 | `high-contention` | High-Contention On-Sales | advanced |
| 13 | `scalability-evolution` | Scalability & Evolution | advanced |
| 14 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 15 | `security-abuse` | Security & Abuse | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a booking system does, the no-oversell invariant, why
   contention makes it hard. Scope; a `Callout variant="interview"` 45-min allocation.
   Reframe: the hard part is correctness under concurrency, not CRUD on events.
2. **Requirements** — `RequirementsTable`. Functional: browse availability; hold seats
   with a TTL; confirm with payment; release on expiry/cancel; idempotent booking.
   Non-functional: **never oversell** (hard invariant), strong consistency on
   inventory, hold-then-pay latency, availability, survive on-sale spikes, fairness.
3. **Capacity Estimates** — `TicketBookingCapacity` fed by `lib/ticket-booking-estimates.ts`.
   Derive daily inventory, the **contention ratio** (users per seat), peak hold-attempt
   QPS, and peak availability-read QPS. Headline: writes are modest QPS but **highly
   contended**; reads dominate; most hold attempts on a hot seat must be rejected fast.
4. **Entity Model** — `EntityModel name="Seat"` (id, event_id, label, status
   available|held|booked, hold_id, held_until, version, price). Prose on Event, Hold,
   Booking. The `version` column is the hook for optimistic locking.
5. **API Design** — `ApiContract`: `POST /v1/holds` (atomic seat hold → 201 or **409
   Conflict** if taken), `POST /v1/bookings` (confirm a hold + pay, idempotent), and a
   note on `GET /v1/events/{id}/seats` availability (cached read path).
6. **High-Level Architecture** — `TicketBookingArchitecture`: client → (waiting room) →
   booking service → strongly-consistent inventory store (sharded by event) → hold
   expiry worker → payment provider → booking store; availability cache for reads.
7. **Detailed Flows** — `HoldSeatSequence`, `ContentionSequence` (two users race, one
   wins), `ConfirmPaymentSequence`, `HoldExpirySequence`.
8. **Reservation Lifecycle** — the seat state machine `available → held → booked`, with
   `held → available` on expiry/cancel; the hold TTL; why holds (decouple slow checkout
   from inventory) and why they must expire (or seats leak, unsellable).
9. **Concurrency Control (centerpiece)** — preventing oversell: the lost-update/double-
   sell race; **optimistic** (compare-and-set on `version` / conditional `UPDATE …
   WHERE status='available'`) vs **pessimistic** (`SELECT … FOR UPDATE` row lock);
   why the conditional update is a single atomic op that serializes per seat; trade-offs
   under high contention.
10. **Strong Consistency** — inventory is the system of record and cannot be eventually
    consistent: a stale read oversells. Seat state lives in a strongly-consistent store,
    changes are transactional, and reads on the *write* path are linearizable; the
    availability *display* can be cached/approximate, but the hold is authoritative.
11. **Payment & Booking Saga** — hold → pay → confirm as a saga: the hold reserves
    inventory, payment runs against an external provider (seconds, may fail), confirm
    flips held→booked **idempotently**; compensation when payment succeeds but confirm
    fails, or payment fails (release the hold). Idempotency keys throughout.
12. **High-Contention On-Sales** — the thundering herd when a popular event opens:
    a **virtual waiting room / queue** to admit users at a controlled rate, sharding
    inventory by event so one hot event's load is isolated, fast-failing rejected holds,
    and fairness (queue position vs lottery).
13. **Scalability & Evolution** — `TradeoffTable`: single DB with row locks → optimistic
    concurrency + availability cache → shard by event + waiting room → multi-region with
    inventory pinned to a home region.
14. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): inventory-DB outage, hold
    worker lag (leaked seats), payment succeeds/confirm fails (double-charge risk),
    client abandons hold, hot-event shard saturation, waiting-room outage, split-brain
    on inventory.
15. **Security & Abuse** — scalper bots (rate limits, CAPTCHAs, queue fairness, per-user
    purchase caps), payment fraud, hold hoarding (holding inventory to deny others),
    inventory enumeration.
16. **Trade-offs & Alternatives** — `DecisionRecord`: optimistic concurrency +
    strongly-consistent inventory + hold saga + waiting room; axes: optimistic vs
    pessimistic, strong vs eventual on inventory, hold-TTL length, sync vs queued admission.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck`, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, ticket-booking-specific
- `lib/ticket-booking-estimates.ts` — pure capacity calc with typed
  `TicketBookingCapacityAssumptions` / `TicketBookingCapacityResults`.
- `components/learning/ticket-booking-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `TicketBookingCapacity`.
- `components/diagrams/ticket-booking-architecture.tsx` — `TicketBookingArchitecture`:
  waiting room → booking service → strongly-consistent inventory (sharded) → hold expiry
  worker → payment provider → booking store + availability cache. `role="img"` + caption
  naming inventory / hold / strong consistency / oversell.
- `components/diagrams/booking-flows.tsx` — `HoldSeatSequence`, `ContentionSequence`,
  `ConfirmPaymentSequence`, `HoldExpirySequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `ticket-booking` entry (18 sections).
- `lib/curriculum.ts` — flip `ticket-booking` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/ticket-booking.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the fifth slug's MDX.

## Capacity Model (exact)

`lib/ticket-booking-estimates.ts` is a pure function (no time constant needed; on-sale
contention is modeled with an explicit window).

Assumptions used in the MDX embed and the test:
```ts
{
  eventsPerDay: 1000,
  seatsPerEvent: 50_000,
  peakConcurrentUsers: 1_000_000,
  onsaleWindowSeconds: 60,
  availabilityReadsPerHold: 20,
}
```

Results (deterministic):
- `dailyInventory` = 1000 × 50,000 = **50,000,000** seats/day
- `contentionRatio` = 1,000,000 / 50,000 = **20** (users competing per seat)
- `peakHoldAttemptsPerSecond` = 1,000,000 / 60 ≈ **16,666.67**
- `peakAvailabilityReadsPerSecond` = 16,666.67 × 20 ≈ **333,333.33**

Headline lesson: the **write path is modest in raw QPS (~17k hold attempts/sec) but
brutally contended** — 20 users fight over every seat, so 19 of 20 attempts on a hot
seat must be rejected instantly and correctly. Reads (availability) dominate at ~333k/sec
and can be cached/approximate; the hold is the authoritative, strongly-consistent write.

## Numerical & Terminology Invariants

- The hard invariant is **never oversell**: one seat is sold at most once.
- A contended seat hold is an **atomic conditional update** (compare-and-set on
  `version`, or `UPDATE … WHERE status='available'`) / a row lock — never read-modify-write.
- Inventory of record is **strongly consistent**; availability *display* may be cached.
- A hold has a **TTL** and must be **released on expiry**, or seats leak and become
  unsellable.
- The hold→pay→confirm path is a **saga** with **idempotent** confirm and compensation.
- A taken seat returns **409 Conflict**; booking is **idempotent** via an idempotency key.

## Out of Scope

Dynamic/surge pricing, seat-map rendering, fraud ML, the payment processor internals,
resale marketplaces, real DB/payment integration (teaching artifact), and any change to
other tutorials.
