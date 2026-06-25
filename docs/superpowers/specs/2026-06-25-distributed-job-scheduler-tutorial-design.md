# Distributed Job Scheduler Tutorial — Design Spec

**Date:** 2026-06-25
**Status:** Approved for planning
**Curriculum slug:** `distributed-job-scheduler` (sequence 30, Advanced)

## Goal

Author the twelfth complete curriculum tutorial — and the first **reliable-scheduled-
execution** one: an interview-grade walkthrough of designing a **Distributed Job Scheduler**
(cron-at-scale, à la Airflow's scheduler, Quartz, Temporal, or a cloud scheduler) that fires
millions of scheduled jobs on time, runs each one reliably even when workers crash, never
duplicates a job's *effect*, retries transient failures with backoff, and survives the
synchronized "everything fires at midnight" thundering herd — all with no single point of
failure.

This is a deliberate change of shape from the prior tutorials. It *looks* like the most
mundane problem imaginable — a cron table that runs a job at a time — and the point is to
show that doing that **reliably, at scale, on a fleet that crashes** is hard. The job must
fire even if the worker running it dies (**at-least-once execution**), but it must not run
twice harmfully, which forces **leasing** (so exactly one worker owns a due job) plus
**idempotency** (so an unavoidable retry is safe). The schedule must be durable and the
scheduler itself must not be a single point of failure (**leader election**). Failures must
**retry with backoff** and eventually dead-letter. And because humans schedule jobs at round
times, a huge fraction fire at the same instant — a **thundering herd** the design must
smear and shard. It reuses idempotency from the Payment System and the queue/worker pattern
from the Notification Service, but centers them on *time-triggered, reliably-executed* work.

Reuses the existing tutorial infrastructure (App Router static routes, MDX, typed registry,
learning components, diagram primitives, shared `CapacityTable`). New work is
scheduler-specific content, a capacity module + wrapper, one architecture diagram, four
flow-sequence diagrams, and the registry/curriculum wiring.

## Framing & Scope

**What we design:** a service where users register jobs — one-time ("run at 2 a.m. tonight")
or recurring (a cron expression) — and the system guarantees each runs at its scheduled time,
reliably, exactly-once in *effect*, with retries and observability. The defining tensions are:

- **Reliable execution despite crashes (at-least-once + leasing)** — a worker can die mid-job,
  so the system must re-run it, which means a job can execute more than once; a **lease /
  visibility timeout** ensures only one worker owns a due job at a time, and re-claims it if
  that worker dies, giving at-least-once without permanent duplication.
- **Exactly-once *effect* via idempotency** — since at-least-once allows a retry after a job
  already did its work (crash between doing and acknowledging), jobs must be **idempotent** (or
  use dedupe keys / fencing tokens), so running twice is harmless.
- **No single point of failure + the thundering herd** — the scheduler that decides "what's
  due now" must be **leader-elected** and durable, and because jobs cluster at round times
  (top of the hour, midnight), a naive design fires a massive synchronized burst; the schedule
  must be **sharded** and firings **smeared/jittered** so peak load is survivable.

**In scope:** scheduling and time triggers (cron, one-time, recurring), reliable execution
and at-least-once, leasing and coordination/leader election, idempotency / exactly-once
effects, retries / backoff / dead-letter, and scaling / the thundering herd. **Out of scope
(mention, then set aside):** the internals of the workers' actual job logic (we schedule and
deliver; the job's work is the user's), complex DAG/workflow dependencies between jobs (a
workflow engine like a full Airflow/Temporal is a richer problem), the consensus algorithm
internals behind leader election (we use a coordination service), and the UI.

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
| 8 | `scheduling-triggers` | Scheduling & Time Triggers | advanced |
| 9 | `reliable-execution` | Reliable Execution & At-Least-Once | advanced |
| 10 | `leasing-coordination` | Leasing & Coordination | advanced |
| 11 | `idempotency-exactly-once` | Idempotency & Exactly-Once Effects | advanced |
| 12 | `retries-failures` | Retries, Backoff & Failure Handling | advanced |
| 13 | `hot-partitions` | Hot Partitions & the Thundering Herd | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **Interview Framing** — what a job scheduler is and why it exists (run work on a schedule
   without a babysitter). The reframe: it *looks* like a cron table, but the hard part is
   firing reliably at scale on a crashing fleet — at-least-once execution with leasing,
   idempotent effects, no single point of failure, and surviving the synchronized thundering
   herd. Scope; a `Callout variant="interview"` 45-min allocation.
2. **Requirements** — `RequirementsTable`. Functional: schedule one-time and recurring (cron)
   jobs; run each at its time; retry on failure; expose job status/history; cancel/update a
   job. Non-functional: **reliable execution (at-least-once, no missed jobs)**, **no harmful
   duplication (exactly-once effect)**, **durability of the schedule**, **no single point of
   failure**, fire reasonably on time (low scheduling latency), scale to millions of jobs.
3. **Capacity Estimates** — `DistributedJobSchedulerCapacity` fed by
   `lib/distributed-job-scheduler-estimates.ts`. Derive **daily executions**, **avg & peak
   (thundering-herd) executions/sec**, **concurrent in-flight jobs (Little's law → worker
   fleet)**, and **execution-history storage**. Headline: trigger rate is modest on average but
   spikes ~20× at round times, concurrency (not trigger rate) sizes the worker fleet, and run
   history is the storage driver.
4. **Entity Model** — `EntityModel name="Job"` (id, schedule/cron, next_fire_time, payload,
   status, idempotency_key, max_retries). Prose on the **Schedule/trigger**, the **JobRun /
   Execution** (an immutable attempt record), the **Lease** (who owns a run + expiry), and the
   schedule **index** (jobs ordered by next_fire_time). Key point: the durable job + next-fire-
   time is the source of truth; runs are immutable history.
5. **API Design** — `ApiContract`: `POST /jobs` (schedule, one-time or cron, with an
   idempotency key), `DELETE /jobs/{id}` (cancel), `GET /jobs/{id}` (status + recent runs).
   Emphasize the cron/one-time schedule and idempotent creation.
6. **High-Level Architecture** — `DistributedJobSchedulerArchitecture`: client → scheduler
   (leader-elected, scans the job store for due jobs) → dispatch queue → workers (lease,
   execute) → history store; a coordination service for leader election + leases; a retry/DLQ
   path. Caption names at-least-once, leasing, leader election (no SPOF), and the schedule as
   source of truth.
7. **Detailed Flows** — `ScheduleJobSequence` (persist a durable job + next fire time),
   `DispatchExecuteSequence` (scheduler finds due → enqueue → worker leases + executes →
   mark done + compute next fire), `LeaseRecoverySequence` (worker dies → lease expires →
   another worker re-claims → at-least-once), `RetryBackoffSequence` (failure → backoff retry →
   dead-letter past max attempts).
8. **Scheduling & Time Triggers** — first deep dive: one-time vs recurring (cron) jobs; how to
   find "what's due now" efficiently at scale — a time-ordered index / time buckets scanned by
   the scheduler vs in-memory timer wheels; computing the next fire time after each run;
   scheduling latency vs scan frequency. Include a `<KnowledgeCheck>`.
9. **Reliable Execution & At-Least-Once** — the durable job **state machine** (scheduled →
   claimed → running → succeeded/failed); persist before acting; ensure a job runs even if the
   worker crashes mid-execution by re-claiming after the lease expires; why this yields
   **at-least-once** (and never at-most-once for important jobs). Include a `<KnowledgeCheck>`.
10. **Leasing & Coordination** — a **lease / visibility timeout** so exactly one worker owns a
    due job while it runs (others can't double-run it); lease renewal (heartbeat) for long
    jobs; expiry → re-claim on crash; **leader election** (via a coordination service like
    etcd/ZooKeeper) so the scheduler has no single point of failure; fencing tokens to stop a
    zombie holder. Include a `<KnowledgeCheck>`.
11. **Idempotency & Exactly-Once Effects** — at-least-once means a job can run twice (crash
    after doing the work, before acknowledging), so **exactly-once delivery is impossible** but
    **exactly-once *effect*** is achievable via **idempotent jobs**, dedupe/idempotency keys,
    and fencing tokens. The lesson: make the work idempotent rather than chase impossible
    exactly-once delivery. Include a `<KnowledgeCheck>`.
12. **Retries, Backoff & Failure Handling** — failed jobs retried with **exponential backoff +
    jitter**, capped at **max attempts**, then **dead-lettered** for inspection; distinguishing
    transient vs permanent failures; handling **stuck / long-running** jobs (lease expiry,
    timeouts) and the poison-pill that fails forever. Include a `<KnowledgeCheck>`.
13. **Hot Partitions & the Thundering Herd** — humans schedule at round times, so a huge
    fraction of jobs fire at `00:00` / the top of the hour, creating a synchronized burst that
    can overwhelm the system; mitigate by **sharding the schedule** (partition the job space),
    **smearing/jittering** fire times, and scaling workers elastically; hot time-buckets and
    how to spread them.
14. **Scalability & Evolution** — `TradeoffTable`: single cron box → durable store + worker
    pool → leader-elected scheduler + sharded schedule + lease-based at-least-once → multi-
    region / partitioned scheduler with smeared firing.
15. **Resiliency & Failure Modes** — `FailureMatrix` (≥ 6): worker crash mid-job (lease
    re-claim), scheduler/leader failure (re-election), duplicate execution (idempotency),
    missed/late firing (scan lag, clock skew), thundering-herd overload, poison-pill job
    (retries forever → DLQ), job-store outage.
16. **Trade-offs & Alternatives** — `DecisionRecord`: leader-elected scheduler + durable store
    + dispatch queue + lease-based at-least-once + idempotent jobs + backoff/DLQ; axes: poll/
    scan vs timer-wheel, at-least-once vs at-most-once, push (queue) vs pull (workers poll),
    leader-elected single scheduler vs sharded schedulers.
17. **Interview Summary** — 60-second answer + likely follow-ups.
18. **Knowledge Checks & FAQ** — ≥ 6 `KnowledgeCheck` total, ≥ 12 `Faq` entries.

## Components

### Reused as-is
`Callout`, `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`,
`FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `DiagramFrame`, diagram
primitives, shared `CapacityTable`.

### New, scheduler-specific
- `lib/distributed-job-scheduler-estimates.ts` — pure capacity calc with typed
  `DistributedJobSchedulerCapacityAssumptions` / `DistributedJobSchedulerCapacityResults`.
- `components/learning/distributed-job-scheduler-capacity.tsx` — wrapper over `CapacityTable`,
  registered as `DistributedJobSchedulerCapacity`.
- `components/diagrams/distributed-job-scheduler-architecture.tsx` —
  `DistributedJobSchedulerArchitecture`. `role="img"` + caption naming at-least-once, leasing,
  leader election (no SPOF), the schedule as source of truth.
- `components/diagrams/job-scheduler-flows.tsx` — `ScheduleJobSequence`,
  `DispatchExecuteSequence`, `LeaseRecoverySequence`, `RetryBackoffSequence`.

### Wiring
- `lib/tutorial-registry.ts` — add the `distributed-job-scheduler` entry (18 sections).
- `lib/curriculum.ts` — flip `distributed-job-scheduler` status to `available`.
- `mdx-components.tsx` — register the new components.
- `content/tutorials/distributed-job-scheduler.mdx` — the full content.
- `app/learn/[slug]/page.tsx` — resolve the twelfth slug's MDX.

## Capacity Model (exact)

`lib/distributed-job-scheduler-estimates.ts` is a pure function. `SECONDS_PER_DAY = 86_400`,
`BYTES_PER_TB = 1e12`. Float-derived results use `toBeCloseTo`.

Assumptions used in the MDX embed and the test:
```ts
{
  scheduledJobs: 100_000_000,
  avgRunsPerJobPerDay: 24,
  peakFactor: 20,
  avgJobDurationSec: 30,
  avgRecordBytes: 1_000,
  historyRetentionDays: 30,
}
```

Results (deterministic):
- `dailyExecutions` = 100,000,000 × 24 = **2,400,000,000** runs/day
- `avgExecutionsPerSecond` = 2,400,000,000 / 86,400 ≈ **27,777.78** /sec
- `peakExecutionsPerSecond` = avg × 20 ≈ **555,555.56** /sec
- `concurrentJobs` = avgExecutionsPerSecond × 30 ≈ **833,333.33** in flight
- `historyStorageTb` = 2,400,000,000 × 1,000 × 30 / 1e12 = **72** TB

Headline lesson: the average trigger rate (~**28k/sec**) is modest, but the **thundering
herd** spikes it ~20× to ~**556k/sec** because humans schedule at round times (midnight, top
of the hour) — so the system is sized for the *synchronized burst*, not the average, and the
schedule must be sharded and firings smeared. By Little's law there are ~**833k jobs in
flight** at once, so the **worker fleet is sized by concurrency, not trigger rate**, and must
scale elastically. And **run history is the storage driver** (~**72 TB** over 30 days): the
job *definitions* are tiny, but the immutable record of every execution is what grows and must
be retained then expired. The hard parts are the spiky distribution and reliable concurrent
execution, not raw storage.

## Numerical & Terminology Invariants

- Execution is **at-least-once**: a job runs even if its worker crashes (re-claimed after the
  **lease/visibility-timeout** expires), so it can run more than once — never silently skipped.
- A **lease** ensures exactly one worker owns a due job at a time; **leader election** (via a
  coordination service) means the scheduler has **no single point of failure**; **fencing
  tokens** stop a zombie lease holder.
- **Exactly-once delivery is impossible**; the system targets **exactly-once *effect*** via
  **idempotent jobs** / dedupe keys.
- Failures **retry with exponential backoff + jitter** up to **max attempts**, then
  **dead-letter**.
- Jobs cluster at round times → a **thundering herd**; the schedule is **sharded** and firings
  **smeared/jittered**; the **worker fleet is sized by concurrency** (Little's law), not the
  average trigger rate. The durable job + next-fire-time is the **source of truth**; runs are
  immutable history.

## Out of Scope

The workers' actual job logic, multi-job DAG/workflow dependencies (a full workflow engine),
the consensus-algorithm internals behind leader election, the UI, and any change to other
tutorials.
