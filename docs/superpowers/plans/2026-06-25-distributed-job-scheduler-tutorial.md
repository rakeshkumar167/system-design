# Distributed Job Scheduler Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the twelfth complete curriculum tutorial — an Advanced, reliable-scheduled-execution walkthrough of a Distributed Job Scheduler: scheduling/time triggers, reliable at-least-once execution, leasing and coordination/leader election, idempotency / exactly-once effects, retries/backoff/dead-letter, and the thundering-herd of synchronized firings — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first eleven tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **at-least-once execution + leasing**, **leader election (no SPOF)**, **idempotent/exactly-once effects**, and the **thundering herd**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the eleven existing tutorials.
- Invariants: execution is **at-least-once** (a job runs even if its worker crashes — re-claimed after the **lease/visibility-timeout** expires — so it may run more than once, never silently skipped); a **lease** ensures exactly one worker owns a due job; **leader election** via a coordination service means the scheduler has **no single point of failure**; **exactly-once delivery is impossible**, so target **exactly-once *effect*** via **idempotent jobs**/dedupe keys/fencing tokens; failures **retry with exponential backoff + jitter** up to **max attempts** then **dead-letter**; jobs cluster at round times → a **thundering herd**, so shard the schedule and smear/jitter firings; the **worker fleet is sized by concurrency** (Little's law), not the average trigger rate; the durable job + next-fire-time is the **source of truth**, runs are immutable history.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                                  # MODIFY: register distributed-job-scheduler MDX
├── components/
│   ├── diagrams/
│   │   ├── distributed-job-scheduler-architecture.tsx         # NEW: HLD (client, scheduler, job store, coordination, dispatch queue, workers, history, DLQ)
│   │   └── job-scheduler-flows.tsx                             # NEW: schedule / dispatch-execute / lease-recovery / retry-backoff sequences
│   └── learning/
│       └── distributed-job-scheduler-capacity.tsx             # NEW: wrapper over CapacityTable
├── content/tutorials/distributed-job-scheduler.mdx           # NEW: full tutorial content
├── lib/
│   ├── distributed-job-scheduler-estimates.ts                 # NEW: pure capacity calc
│   ├── tutorial-registry.ts                                   # MODIFY: add distributed-job-scheduler entry (18 sections)
│   └── curriculum.ts                                          # MODIFY: flip distributed-job-scheduler to available
├── mdx-components.tsx                                         # MODIFY: register new components
├── tests/
│   ├── distributed-job-scheduler-estimates.test.ts            # NEW
│   ├── distributed-job-scheduler-content.test.ts              # NEW
│   ├── diagrams.test.tsx                                      # MODIFY: scheduler diagram assertions
│   ├── tutorial-registry.test.ts                              # MODIFY: twelve tutorials
│   └── curriculum.test.ts                                     # MODIFY: twelve available problems (distributed-job-scheduler appends at seq 30, end of list)
└── e2e/pilot.spec.ts                                         # MODIFY: scheduler flow + coming-soon count 22→21
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Distributed Job Scheduler capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/distributed-job-scheduler-estimates.ts`, `tests/distributed-job-scheduler-estimates.test.ts`, `components/learning/distributed-job-scheduler-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/distributed-job-scheduler-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateDistributedJobSchedulerCapacity } from "@/lib/distributed-job-scheduler-estimates";

describe("calculateDistributedJobSchedulerCapacity", () => {
  const result = calculateDistributedJobSchedulerCapacity({
    scheduledJobs: 100_000_000,
    avgRunsPerJobPerDay: 24,
    peakFactor: 20,
    avgJobDurationSec: 30,
    avgRecordBytes: 1_000,
    historyRetentionDays: 30,
  });

  it("derives total daily executions", () => {
    expect(result.dailyExecutions).toBe(2_400_000_000);
  });
  it("derives average executions per second", () => {
    expect(result.avgExecutionsPerSecond).toBeCloseTo(27777.78, 1);
  });
  it("derives peak (thundering-herd) executions per second", () => {
    expect(result.peakExecutionsPerSecond).toBeCloseTo(555555.56, 1);
  });
  it("derives concurrent in-flight jobs (Little's law)", () => {
    expect(result.concurrentJobs).toBeCloseTo(833333.33, 1);
  });
  it("derives execution-history storage over the retention window in TB", () => {
    expect(result.historyStorageTb).toBe(72);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/distributed-job-scheduler-estimates.test.ts`.

**Step 3: Implement** `lib/distributed-job-scheduler-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface DistributedJobSchedulerCapacityAssumptions {
  /** Total scheduled jobs (one-time + recurring). */
  scheduledJobs: number;
  /** Average runs per job per day. */
  avgRunsPerJobPerDay: number;
  /** Peak-to-average multiplier from synchronized (round-time) firing. */
  peakFactor: number;
  /** Average job execution duration, in seconds. */
  avgJobDurationSec: number;
  /** Average serialized size of one execution-history record, in bytes. */
  avgRecordBytes: number;
  /** Days execution history is retained. */
  historyRetentionDays: number;
}

export interface DistributedJobSchedulerCapacityResults {
  dailyExecutions: number;
  avgExecutionsPerSecond: number;
  peakExecutionsPerSecond: number;
  concurrentJobs: number;
  historyStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the average trigger rate is
 * modest, but a thundering herd (jobs scheduled at round times) spikes it ~20×, so the system
 * is sized for the synchronized burst; by Little's law the worker fleet is sized by
 * concurrency (not trigger rate); and execution history — not the tiny job definitions — is
 * the storage driver.
 */
export function calculateDistributedJobSchedulerCapacity(
  a: DistributedJobSchedulerCapacityAssumptions,
): DistributedJobSchedulerCapacityResults {
  const dailyExecutions = a.scheduledJobs * a.avgRunsPerJobPerDay;
  const avgExecutionsPerSecond = dailyExecutions / SECONDS_PER_DAY;
  const peakExecutionsPerSecond = avgExecutionsPerSecond * a.peakFactor;
  const concurrentJobs = avgExecutionsPerSecond * a.avgJobDurationSec;
  const historyStorageTb =
    (dailyExecutions * a.avgRecordBytes * a.historyRetentionDays) / BYTES_PER_TB;

  return {
    dailyExecutions,
    avgExecutionsPerSecond,
    peakExecutionsPerSecond,
    concurrentJobs,
    historyStorageTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/distributed-job-scheduler-capacity.tsx`, mirroring
`components/learning/distributed-logging-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateDistributedJobSchedulerCapacity,
  type DistributedJobSchedulerCapacityAssumptions,
} from "@/lib/distributed-job-scheduler-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedJobSchedulerCapacity({
  assumptions,
}: {
  assumptions: DistributedJobSchedulerCapacityAssumptions;
}) {
  const r = calculateDistributedJobSchedulerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Scheduled jobs", value: fmt(assumptions.scheduledJobs) },
    { label: "Runs / job / day", value: fmt(assumptions.avgRunsPerJobPerDay) },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Avg job duration", value: `${fmt(assumptions.avgJobDurationSec)} s` },
    { label: "Avg record size", value: `${fmt(assumptions.avgRecordBytes)} B` },
    { label: "History retention", value: `${fmt(assumptions.historyRetentionDays)} d` },
  ];

  const results: ResultRow[] = [
    { label: "Daily executions", value: fmt(r.dailyExecutions), consequence: "Billions of runs a day — but the rate, not the count, is what stresses the system." },
    { label: "Avg executions / sec", value: fmt(r.avgExecutionsPerSecond), consequence: "The steady-state trigger rate is modest — a single scheduler tier can find this many due jobs." },
    { label: "Peak executions / sec", value: fmt(r.peakExecutionsPerSecond), consequence: "Jobs cluster at round times (midnight, top of hour), so peak is ~20× the average — a thundering herd to shard and smear." },
    { label: "Concurrent jobs", value: fmt(r.concurrentJobs), consequence: "By Little's law (rate × duration), this many jobs run at once — the worker fleet is sized by concurrency, not trigger rate." },
    { label: "History storage (30 d)", value: `${fmt(r.historyStorageTb)} TB`, consequence: "Job definitions are tiny; the immutable record of every run is the storage driver — retained, then expired." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `DistributedJobSchedulerCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/distributed-job-scheduler-estimates.test.ts tests/distributed-logging-estimates.test.ts
npm run typecheck && npm run lint
git add lib/distributed-job-scheduler-estimates.ts tests/distributed-job-scheduler-estimates.test.ts components/learning/distributed-job-scheduler-capacity.tsx mdx-components.tsx
git commit -m "feat: add distributed job scheduler capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/distributed-logging-architecture.tsx` (HLD) and
`components/diagrams/cache-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/distributed-job-scheduler-architecture.tsx`, `components/diagrams/job-scheduler-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { DistributedJobSchedulerArchitecture } from "@/components/diagrams/distributed-job-scheduler-architecture";
import {
  ScheduleJobSequence,
  DispatchExecuteSequence,
  LeaseRecoverySequence,
  RetryBackoffSequence,
} from "@/components/diagrams/job-scheduler-flows";

describe("DistributedJobSchedulerArchitecture", () => {
  it("exposes the job scheduler architecture to non-visual readers", () => {
    render(<DistributedJobSchedulerArchitecture />);
    expect(
      screen.getByRole("img", { name: /job scheduler architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/at-least-once/i)).toBeInTheDocument();
  });
});

describe("job scheduler flow sequences", () => {
  it("renders the schedule, dispatch, lease-recovery, and retry sequences", () => {
    render(<ScheduleJobSequence />);
    expect(screen.getByRole("img", { name: /schedul/i })).toBeInTheDocument();
    render(<DispatchExecuteSequence />);
    expect(screen.getByRole("img", { name: /dispatch/i })).toBeInTheDocument();
    render(<LeaseRecoverySequence />);
    expect(screen.getByRole("img", { name: /recover/i })).toBeInTheDocument();
    render(<RetryBackoffSequence />);
    expect(screen.getByRole("img", { name: /retry/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"at-least-once"** in the
**caption only** (NOT in any node label and NOT in the `DiagramFrame` title). Also: all four
flow titles render into the same test DOM in one test, so each regex must match exactly one
title — use distinct, mutually exclusive title keywords ("schedule", "dispatch", "recovery",
"retry") and ensure NO title contains another flow's keyword (e.g. avoid "schedule"/"dispatch"
/"recover"/"retry" appearing in more than one title; in particular do NOT put the word
"execute" in a way that clashes — only the dispatch title is matched by `/dispatch/i`).

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `distributed-job-scheduler-architecture.tsx` exporting
`DistributedJobSchedulerArchitecture`, following the `distributed-logging-architecture.tsx` pattern (a
`const N` node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`,
edges before nodes, a `Legend`). It must show:
- `Client API` (infra, sublabel "schedule jobs") → `Scheduler` (service, sublabel "scan due (leader)") via `ingress` ("POST job").
- `Scheduler` → `Job Store` (store, sublabel "defs + schedule") via `create` ("persist + read due").
- `Scheduler` → `Dispatch Queue` (queue, sublabel "due jobs") via `async` ("enqueue due jobs").
- `Dispatch Queue` → `Workers` (service, sublabel "lease + execute") via `redirect` ("deliver (lease)").
- `Workers` → `Dispatch Queue` via `control` ("ack / extend lease").
- `Workers` → `History Store` (store, sublabel "run records") via `create` ("write result").
- `Workers` → `Retry / DLQ` (queue, sublabel "backoff + dead-letter") via `control` ("on failure").
- `Coordination` (service, sublabel "election + leases") → `Scheduler` via `muted` ("leader election").
- `title` contains "Distributed job scheduler architecture"; `caption` names **at-least-once**
  execution, **leasing**, **leader election (no single point of failure)**, and the durable
  schedule as the source of truth, in prose. (Per the gotcha, keep "at-least-once" in the
  caption only; distinct node labels.)
- Node kinds: `infra` for the client, `service` for scheduler/workers/coordination, `store` for
  the job store and history store, `queue` for the dispatch queue and the retry/DLQ.
- Suggested geometry (viewBox `0 0 880 500`): client {24,230}, scheduler {190,230},
  jobStore {190,90}, coordination {190,370}, dispatchQueue {400,230}, workers {590,230},
  historyStore {760,90}, dlq {590,370} — `w` ≈ 140–150, `h` ≈ 56 (store `h` ≈ 60). Adjust to
  avoid overlaps.

**Step 4: Implement the flow sequences** `job-scheduler-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `cache-flows.tsx` verbatim).
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive:
- `ScheduleJobSequence` — title contains "schedule" (e.g. "Sequence: schedule a job — persist a durable trigger"); actors Client, Scheduler, Job Store; steps: client submits a one-time/cron job, scheduler validates and computes the next fire time, persists the job to the store with its schedule index, returns the job id. Caption: scheduling persists a durable job with its next fire time; the schedule is the source of truth and survives restarts.
- `DispatchExecuteSequence` — title contains "dispatch" (e.g. "Sequence: dispatch a due job to a worker"); actors Scheduler, Dispatch Queue, Worker, Job Store; steps: scheduler scans and finds a due job, enqueues it, a worker claims it under a lease, runs it, marks it done and the scheduler computes the next fire time. Caption: the scheduler finds due jobs and enqueues them; a worker claims one under a lease and executes; the lease guards against a crashed worker (at-least-once).
- `LeaseRecoverySequence` — title contains "recovery" (e.g. "Sequence: lease recovery — re-claim a crashed worker's job"); actors Worker A, Dispatch Queue, Worker B; steps: Worker A claims a job under a lease and starts running, Worker A crashes (lease not renewed), the lease expires and the job becomes visible again, Worker B re-claims and runs it to completion. Caption: if a worker dies mid-job, its lease expires and another worker re-claims the job, so it still runs (at-least-once) — which is why jobs must be idempotent. Use `control` for the lease-expiry.
- `RetryBackoffSequence` — title contains "retry" (e.g. "Sequence: retry with backoff, then dead-letter"); actors Worker, Job Store, Retry / DLQ; steps: worker runs the job, it fails, increment the attempt count, if under max re-enqueue with exponential backoff + jitter, if over max move to the dead-letter queue. Caption: a failed job retries with exponential backoff up to a max, then is dead-lettered for inspection — transient failures self-heal, permanent ones are quarantined. Use `control` for the failure/DLQ.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/distributed-job-scheduler-architecture.tsx components/diagrams/job-scheduler-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add distributed job scheduler architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "eleven tutorials" tests to "twelve".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/distributed-job-scheduler.mdx` (skeleton).

IMPORTANT: there are currently ELEVEN available tutorials. You add a TWELFTH. `distributed-job-scheduler` is **sequence 30**, the highest of any available tutorial, so in the curriculum's available-by-sequence ordering it **appends at the end**, after `cloud-drive` (seq 23). Read each test file BEFORE editing to match its exact phrasing. Do NOT change the `getTutorial("api-gateway")` undefined test — api-gateway stays coming-soon. The curriculum total is 33 — do NOT change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all TWELVE tutorials are registered. In the sorted `Object.keys(tutorials)` array, `"distributed-job-scheduler"` sorts between `"distributed-cache"` and `"distributed-logging"`. Add `expect(getTutorial("distributed-job-scheduler")?.sections).toHaveLength(18);`. Update the two descriptive `it(...)` strings to mention the Job Scheduler. Leave the `getTutorial("api-gateway")` undefined test as-is.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "distributed-job-scheduler"]` (distributed-job-scheduler is seq 30, appended last). Add `expect(getProblem("distributed-job-scheduler")?.title).toBe("Distributed Job Scheduler");`. Update the descriptive `it(...)` string. Do NOT touch the 33 count/sequence assertions.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `distributed-job-scheduler` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"distributed-job-scheduler": {
  slug: "distributed-job-scheduler",
  title: "Design a Distributed Job Scheduler",
  description:
    "An interview-grade walkthrough of a distributed job scheduler: scheduling and time triggers, reliable at-least-once execution, leasing and leader-election coordination, idempotency and exactly-once effects, retries with backoff and dead-letter, the thundering herd of synchronized firings, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["At-least-once execution", "Leasing", "Time-based triggers", "Idempotency"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "scheduling-triggers", label: "Scheduling & Time Triggers", depth: "advanced" },
    { id: "reliable-execution", label: "Reliable Execution & At-Least-Once", depth: "advanced" },
    { id: "leasing-coordination", label: "Leasing & Coordination", depth: "advanced" },
    { id: "idempotency-exactly-once", label: "Idempotency & Exactly-Once Effects", depth: "advanced" },
    { id: "retries-failures", label: "Retries, Backoff & Failure Handling", depth: "advanced" },
    { id: "hot-partitions", label: "Hot Partitions & the Thundering Herd", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import DistributedJobSchedulerContent from "@/content/tutorials/distributed-job-scheduler.mdx";` and `"distributed-job-scheduler": DistributedJobSchedulerContent,` to the content map.

**Step 7:** Create `content/tutorials/distributed-job-scheduler.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence. Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/distributed-job-scheduler
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/distributed-job-scheduler.mdx
git commit -m "feat: register distributed job scheduler tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks
1–3, then installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have
registered the embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<DistributedJobSchedulerCapacity assumptions={{ scheduledJobs: 100000000, avgRunsPerJobPerDay: 24, peakFactor: 20, avgJobDurationSec: 30, avgRecordBytes: 1000, historyRetentionDays: 30 }} />` then read off the thundering-herd / concurrency-sizes-workers / history-is-the-storage lessons.
- `entity-model` — `EntityModel name="Job"` (id, schedule/cron, next_fire_time, payload, status, idempotency_key, max_retries) + prose on the Schedule/trigger, JobRun/Execution (immutable attempt), Lease (owner + expiry), schedule index.
- `api-design` — `ApiContract` for `POST /jobs` (one-time/cron, idempotency key), `DELETE /jobs/{id}`, `GET /jobs/{id}`.
- `high-level-architecture` — `<DistributedJobSchedulerArchitecture />` + component prose.
- `detailed-flows` — `<ScheduleJobSequence />`, `<DispatchExecuteSequence />`, `<LeaseRecoverySequence />`, `<RetryBackoffSequence />` with prose.
- deep dives `scheduling-triggers`, `reliable-execution`, `leasing-coordination`, `idempotency-exactly-once`, `retries-failures`, `hot-partitions` per spec, with a `<KnowledgeCheck>` in scheduling-triggers, reliable-execution, leasing-coordination, idempotency-exactly-once, and retries-failures.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/distributed-job-scheduler-content.test.ts` (mirror `tests/distributed-logging-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<DistributedJobSchedulerCapacity`, `<DistributedJobSchedulerArchitecture`, and the four sequences `<ScheduleJobSequence`, `<DispatchExecuteSequence`, `<LeaseRecoverySequence`, `<RetryBackoffSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with
real embeds and generates `/learn/distributed-job-scheduler`) all green. Commit `content: complete distributed job scheduler tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 21), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 22 to 21 (twelve tutorials now available — verify the current value is 22 first) and add:
```ts
test("learner can open the distributed job scheduler tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-job-scheduler");
  await expect(
    page.getByRole("heading", { name: /design a distributed job scheduler/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-job-scheduler#leasing-coordination");
  await expect(page.locator("#leasing-coordination")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /job scheduler architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify distributed job scheduler tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/distributed-logging.mdx` and `payment-system.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — write / persist / store), `redirect` (green — read / deliver), `async` (violet dashed — enqueue due jobs), `control` (amber dashed — lease / ack / retry / failure), `muted` (telemetry dotted — leader election), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for scheduler/workers/coordination, `store` for the job store and history store, `queue` for the dispatch queue and the retry/DLQ.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "at-least-once" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "schedule"/"dispatch"/"recovery"/"retry" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/distributed-job-scheduler-estimates.test.ts`.
- **distributed-job-scheduler is seq 30 — it APPENDS at the end** of the curriculum available-by-sequence ordering (after cloud-drive). The curriculum total is 33 (unchanged); do not touch the 33 count assertions.
