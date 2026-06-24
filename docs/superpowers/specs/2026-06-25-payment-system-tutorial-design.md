# Payment System Tutorial — Design Spec

**Date:** 2026-06-25
**Status:** Approved for planning
**Curriculum slug:** `payment-system` (sequence 18, Advanced)

## Goal

Author the tenth complete curriculum tutorial — and the first **money-movement /
correctness-under-failure** one: an interview-grade walkthrough of designing a **Payment
System** that processes payments **exactly once**, records every movement in an immutable
**double-entry ledger**, drives each payment through a durable **state machine**, survives
the **dual-write problem** between the ledger and external payment providers, and
**reconciles** its books against external systems so money is never lost or created.

This is a deliberate change of shape from the prior tutorials. It is the problem where
**throughput is not the hard part** — a large processor runs only a few thousand payments a
second, trivial next to a cache's tens of millions of reads. The hard part is
**correctness**: retries are inevitable, so the same charge must not happen twice
(**idempotency**); the books must always balance and never be mutated (**double-entry
ledger**); a write to the internal ledger and a call to an external bank can't share one ACID
transaction, so the system must avoid both lost and duplicated payments (**transactional
outbox / saga**); and internal records must be proven to match the external world
(**reconciliation**). It revisits the idempotency and concurrency ideas from the Ticket
Booking and URL Shortener tutorials, but raises the stakes to real money.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is
payment-specific content, a capacity module + wrapper, one architecture diagram, four
flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a payment processing service that a merchant or app calls to charge a
customer, move the money via an external payment service provider (PSP) or card network,
record it in a ledger, and support refunds — correctly, even when networks time out and
services crash. The defining tensions are:

- **Exactly-once under inevitable retries** — clients and networks retry, so the same
  logical payment can arrive many times; an **idempotency key** must make duplicates return
  the original result instead of charging again. This is the single most important property.
- **An immutable, always-balanced ledger** — money must be conserved. A **double-entry
  ledger** records every movement as equal debits and credits in an append-only log;
  balances are *derived* from it, and corrections are *new reversing entries*, never edits.
- **Coordinating with an external world you don't control** — the ledger write and the PSP
  call cannot be one transaction (the **dual-write problem**). A **transactional outbox** (or
  saga) plus idempotent PSP calls avoids losing a payment or double-charging, and
  **reconciliation** against PSP/bank statements catches any residual drift.

**In scope:** idempotency and exactly-once, the double-entry ledger, the payment lifecycle /
state machine, distributed transactions (dual-write, outbox, saga), reconciliation, security
and compliance (PCI scope, tokenization, fraud — at a design level), scaling, and failure
modes.

**Out of scope (mention, then set aside):** the internals of card networks / bank rails and
ISO 8583 wire formats, building a fraud-ML model (named, not designed), full PCI-DSS audit
mechanics, FX/multi-currency conversion math, lending/credit and payouts scheduling beyond a
mention, and the merchant-facing UI.

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
| 8 | `idempotency` | Idempotency & Exactly-Once | advanced |
| 9 | `double-entry-ledger` | The Double-Entry Ledger | advanced |
| 10 | `payment-lifecycle` | Payment Lifecycle & State Machine | advanced |
| 11 | `distributed-transactions` | Distributed Transactions & the Dual-Write Problem | advanced |
| 12 | `reconciliation` | Reconciliation | advanced |
| 13 | `security-compliance` | Security & Compliance | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a payment system does and why it exists. The reframe: it
   *looks* like "move money from A to B with an API call," but the hard part is **correctness
   under failure** — exactly-once via idempotency, an always-balanced immutable ledger,
   coordinating with external banks without dual-write bugs, and reconciliation. Note
   throughput is modest; correctness and durability dominate. Scope; a `Callout
   variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: charge a customer, capture/authorize,
   refund, record every movement in a ledger, expose payment status, reconcile against the
   PSP. Non-functional: **exactly-once / no double charge**, **money conservation (books
   always balance)**, **durability of the ledger (never lose a committed entry)**, strong
   consistency for balances, high availability, auditability; throughput is moderate.
3. **Capacity Estimates** — `PaymentSystemCapacity` fed by `lib/payment-system-estimates.ts`.
   Derive **avg & peak payments/sec**, **daily money volume**, **ledger entries/sec**, and
   **ledger storage over the retention window**. Headline: the system is *not* a high-QPS
   problem (~5.8k payments/sec peak) — the challenge is that each payment fans into several
   immutable ledger entries retained for years, and $5B/day means a single mistake is real
   money. Correctness, not scale, is the constraint.
4. **Entity Model** — `EntityModel name="Payment"` plus the ledger entities. Payment (id,
   idempotency_key, amount, currency, status, payer/payee, psp_ref). Prose on **LedgerEntry**
   (immutable, account + debit/credit + transaction id), **Account** (balance derived from
   entries), and **IdempotencyKey** (request fingerprint → stored result). The key point: the
   ledger is the source of truth; the Payment row is a projection/state holder.
5. **API Design** — `ApiContract`: `POST /payments` with an `Idempotency-Key` header
   (create/charge, idempotent), `POST /payments/{id}/refund` (idempotent), `GET
   /payments/{id}` (status). Emphasize the idempotency-key contract and that a retry returns
   the original result.
6. **High-Level Architecture** — `PaymentSystemArchitecture`: client → Payment API
   (idempotency) → Payment Orchestrator (state machine) → Ledger Service → Ledger DB
   (append-only); a transactional Outbox/queue dispatching to the external PSP/Bank; a
   Reconciliation service comparing ledger vs PSP. Caption names exactly-once, the
   double-entry ledger as the **source of truth**, the outbox, and reconciliation.
7. **Detailed Flows** — `AuthCaptureSequence` (charge: state machine + ledger posting + PSP),
   `IdempotentRetrySequence` (a retried request with the same key returns the original result,
   no second charge), `ReconciliationSequence` (compare ledger against the PSP settlement
   file, flag mismatches), `RefundSequence` (a refund as a new reversing double-entry).
8. **Idempotency & Exactly-Once** — the first deep dive: why retries are inevitable
   (timeouts, at-least-once networks), the **idempotency key** (client-supplied, stored with
   the result), how a duplicate returns the stored response instead of re-executing, key
   scope/TTL, and the race where two identical requests arrive at once (unique constraint /
   insert-first). Include a `<KnowledgeCheck>`.
9. **The Double-Entry Ledger** — the heart: every movement is equal **debits and credits**
   across accounts, the ledger is **append-only and immutable**, balances are **derived**
   (sum of entries), money is conserved (entries always sum to zero), and corrections are
   **reversing entries**, never mutations. Why this gives auditability and makes bugs
   detectable. Include a `<KnowledgeCheck>`.
10. **Payment Lifecycle & State Machine** — a payment is a durable **state machine**:
    `initiated → authorized → captured → settled`, with `failed`, `refunded`, `disputed`
    branches; each transition is persisted before acting, transitions are idempotent, and the
    state drives what happens on recovery. Authorize vs capture vs settle. Include a
    `<KnowledgeCheck>`.
11. **Distributed Transactions & the Dual-Write Problem** — the ledger write and the external
    PSP call can't be one ACID transaction. Naive dual-write loses or duplicates payments on a
    crash between the two. Fix with a **transactional outbox** (write intent + outbox row in
    one DB transaction, a dispatcher calls the PSP idempotently and records the result) or a
    **saga** with compensations. Include a `<KnowledgeCheck>`.
12. **Reconciliation** — internal ledger vs the external truth: ingest the PSP/bank
    **settlement file**, match each transaction, and classify discrepancies (missing in
    ledger, missing at PSP, amount mismatch, timing). Auto-resolve where safe, flag the rest;
    reconciliation is the safety net that turns silent drift into a caught exception. Include
    a `<KnowledgeCheck>`.
13. **Security & Compliance** — PCI-DSS scope minimization via **tokenization** (never store
    raw PANs; vault + token), encryption in transit/at rest, the principle of keeping card
    data out of your systems, fraud screening as a pluggable check before authorization, and
    auditability from the immutable ledger.
14. **Scalability & Evolution** — `TradeoffTable`: single service + one ACID DB → idempotency
    + outbox + async PSP dispatch → partitioned ledger by account + read replicas for
    balances → multi-region with regulated data residency.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): timeout after charging (unknown
    state), crash between ledger and PSP (dual-write), duplicate request race, PSP outage /
    slow, ledger imbalance / corruption detected, reconciliation mismatch, refund of a
    never-captured payment.
16. **Trade-offs & Alternatives** — `DecisionRecord`: idempotent API + immutable double-entry
    ledger + state machine + transactional outbox + reconciliation; axes: outbox vs 2PC vs
    saga, strong vs eventual consistency for balances, synchronous vs asynchronous PSP
    settlement, store-vs-tokenize card data.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, payment-specific
- `lib/payment-system-estimates.ts` — pure capacity calc with typed
  `PaymentSystemCapacityAssumptions` / `PaymentSystemCapacityResults`.
- `components/learning/payment-system-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `PaymentSystemCapacity`.
- `components/diagrams/payment-system-architecture.tsx` — `PaymentSystemArchitecture`.
  `role="img"` + caption naming exactly-once, the double-entry ledger as source of truth,
  outbox, reconciliation.
- `components/diagrams/payment-flows.tsx` — `AuthCaptureSequence`, `IdempotentRetrySequence`,
  `ReconciliationSequence`, `RefundSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `payment-system` entry (18 sections).
- `lib/curriculum.ts` — flip `payment-system` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/payment-system.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the tenth slug's MDX.

## Capacity Model (exact)

`lib/payment-system-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`,
`DAYS_PER_YEAR = 365`, `BYTES_PER_TB = 1e12`. Float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  dailyPayments: 100_000_000,
  avgPaymentValueUsd: 50,
  peakFactor: 5,
  ledgerEntriesPerPayment: 4,
  avgEntryBytes: 500,
  retentionYears: 7,
}
```

Results (deterministic):
- `avgPaymentsPerSecond` = 100,000,000 / 86,400 ≈ **1,157.41** /sec
- `peakPaymentsPerSecond` = avg × 5 ≈ **5,787.04** /sec
- `dailyVolumeUsd` = 100,000,000 × 50 = **5,000,000,000** ($5B/day)
- `ledgerEntriesPerSecond` = avg × 4 ≈ **4,629.63** /sec
- `ledgerStorageTb` = 100,000,000 × 4 × 500 × 365 × 7 / 1e12 = **511** TB (over 7 years)

Headline lesson: peak throughput is only ~**5.8k payments/sec** — this is *not* a
high-QPS scaling problem; a single node could nearly serve it. The real weight is that each
payment fans into ~4 **immutable** ledger entries (~4.6k entries/sec) retained for **7
years** (~**511 TB**), and ~**$5B/day** flows through, so a lone double-charge or lost
payment is real money and a compliance incident. The design optimizes for **correctness,
durability, and auditability**, not for raw scale — which is why idempotency, the
double-entry ledger, the outbox, and reconciliation dominate every later section.

## Numerical & Terminology Invariants

- Payments are processed **exactly once** via a client-supplied **idempotency key**; a
  retried request returns the **original result**, never a second charge.
- The **double-entry ledger** is **append-only and immutable**; every movement is equal
  **debits and credits**; **balances are derived** from entries; corrections are **reversing
  entries**, never edits. The ledger is the **source of truth**; the Payment row is a
  projection.
- A payment is a durable **state machine** (`initiated → authorized → captured → settled`,
  plus `failed`/`refunded`/`disputed`); transitions are persisted before acting and are
  idempotent.
- The ledger write and the external **PSP** call cannot be one ACID transaction (**dual-write
  problem**); a **transactional outbox** (or saga) plus idempotent PSP calls prevents lost or
  duplicated payments.
- **Reconciliation** compares the internal ledger against the external PSP/bank settlement to
  catch drift; **money is conserved** end to end.

## Out of Scope

Card-network/bank rail internals and ISO 8583, building a fraud-ML model, full PCI-DSS audit
mechanics, FX/multi-currency math, payouts/lending, the UI, and any change to other
tutorials.
