# Notification Service Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the fourth curriculum tutorial — an Intermediate, async/queue-centric walkthrough of a multi-channel Notification Service (fan-out, message queues, idempotency, retries, DLQ) — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first three tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes vs. the storage tutorials are the **asynchronous fan-out pipeline**, **at-least-once + idempotency**, **retries with backoff + dead-letter queue**, and **user preferences / rate limiting**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the rendered URL Shortener, Rate Limiter, or Pastebin tutorials.
- The accept API returns **202 Accepted** (async). Delivery is **at-least-once**, made safe by **idempotency** (key + dedup store). Retries use **exponential backoff with jitter**; exhausted messages go to a **dead-letter queue**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                              # MODIFY: register notification-service MDX
├── components/
│   ├── diagrams/
│   │   ├── notification-architecture.tsx                  # NEW: HLD (ingestion, queue, fan-out, per-channel queues, workers, providers, DLQ)
│   │   └── notification-flows.tsx                         # NEW: send-fanout / retry-backoff / dead-letter / idempotent sequences
│   └── learning/
│       └── notification-capacity.tsx                      # NEW: wrapper over CapacityTable
├── content/tutorials/notification-service.mdx             # NEW: full tutorial content
├── lib/
│   ├── notification-estimates.ts                          # NEW: pure capacity calc
│   ├── tutorial-registry.ts                               # MODIFY: add notification-service entry (18 sections)
│   └── curriculum.ts                                      # MODIFY: flip notification-service to available
├── mdx-components.tsx                                     # MODIFY: register new components
├── tests/
│   ├── notification-estimates.test.ts                     # NEW
│   ├── notification-content.test.ts                       # NEW
│   ├── diagrams.test.tsx                                  # MODIFY: notification diagram assertions
│   ├── tutorial-registry.test.ts                          # MODIFY: four tutorials
│   └── curriculum.test.ts                                 # MODIFY: four available problems
└── e2e/pilot.spec.ts                                      # MODIFY: notification flow + count 22→21
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Notification capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/notification-estimates.ts`, `tests/notification-estimates.test.ts`, `components/learning/notification-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/notification-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateNotificationCapacity } from "@/lib/notification-estimates";

describe("calculateNotificationCapacity", () => {
  const result = calculateNotificationCapacity({
    notificationsPerDay: 500_000_000,
    fanoutFactor: 2,
    peakMultiplier: 4,
    retryOverheadPercent: 20,
    avgPayloadBytes: 1000,
  });

  it("derives average accept QPS from daily volume", () => {
    expect(result.averageSendQps).toBeCloseTo(5787.04, 2);
  });
  it("amplifies deliveries by the fan-out factor", () => {
    expect(result.averageDeliveryQps).toBeCloseTo(11574.07, 1);
  });
  it("derives peak delivery QPS", () => {
    expect(result.peakDeliveryQps).toBeCloseTo(46296.3, 1);
  });
  it("adds retry overhead to delivery attempts", () => {
    expect(result.deliveryAttemptsPerSecond).toBeCloseTo(13888.89, 1);
  });
  it("derives total daily deliveries", () => {
    expect(result.dailyDeliveries).toBe(1_000_000_000);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/notification-estimates.test.ts`.

**Step 3: Implement** `lib/notification-estimates.ts`:
```ts
export interface NotificationCapacityAssumptions {
  /** Logical notifications accepted per day. */
  notificationsPerDay: number;
  /** Average channels per notification (the fan-out amplification). */
  fanoutFactor: number;
  /** Peak-to-average traffic multiplier. */
  peakMultiplier: number;
  /** Extra delivery attempts from retries, as a percent (20 = +20%). */
  retryOverheadPercent: number;
  /** Average rendered payload size per delivery, in bytes. */
  avgPayloadBytes: number;
}

export interface NotificationCapacityResults {
  averageSendQps: number;
  averageDeliveryQps: number;
  peakDeliveryQps: number;
  deliveryAttemptsPerSecond: number;
  dailyDeliveries: number;
}

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. The point it teaches: fan-out and
 * retries amplify load downstream, so the delivery tier — not ingestion — is sized.
 */
export function calculateNotificationCapacity(
  a: NotificationCapacityAssumptions,
): NotificationCapacityResults {
  const averageSendQps = a.notificationsPerDay / SECONDS_PER_DAY;
  const averageDeliveryQps = averageSendQps * a.fanoutFactor;
  const peakDeliveryQps = averageDeliveryQps * a.peakMultiplier;
  const deliveryAttemptsPerSecond =
    averageDeliveryQps * (1 + a.retryOverheadPercent / 100);
  const dailyDeliveries = a.notificationsPerDay * a.fanoutFactor;

  return {
    averageSendQps,
    averageDeliveryQps,
    peakDeliveryQps,
    deliveryAttemptsPerSecond,
    dailyDeliveries,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/notification-capacity.tsx`, mirroring
`components/learning/pastebin-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateNotificationCapacity,
  type NotificationCapacityAssumptions,
} from "@/lib/notification-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function NotificationCapacity({
  assumptions,
}: {
  assumptions: NotificationCapacityAssumptions;
}) {
  const r = calculateNotificationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Notifications / day", value: fmt(assumptions.notificationsPerDay) },
    { label: "Fan-out factor", value: `${fmt(assumptions.fanoutFactor)}× channels` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Retry overhead", value: `${fmt(assumptions.retryOverheadPercent)}%` },
    { label: "Avg payload", value: `${fmt(assumptions.avgPayloadBytes)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Accept QPS (avg)", value: fmt(r.averageSendQps), consequence: "The accept path is cheap — a thin API returns 202 and enqueues; it is never the bottleneck." },
    { label: "Delivery QPS (avg)", value: fmt(r.averageDeliveryQps), consequence: "Fan-out doubles the load: one notification becomes N per-channel deliveries to push through queues." },
    { label: "Delivery QPS (peak)", value: fmt(r.peakDeliveryQps), consequence: "Provision the delivery tier and provider throughput for peak, not average." },
    { label: "Delivery attempts / sec", value: fmt(r.deliveryAttemptsPerSecond), consequence: "Retries add overhead on top of fan-out — the real work the channel workers perform." },
    { label: "Daily deliveries", value: fmt(r.dailyDeliveries), consequence: "A billion provider calls a day — the scale that justifies async queues and autoscaled workers." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `NotificationCapacity` in `mdx-components.tsx`.

**Step 7: Verify and commit**
```bash
npm test -- tests/notification-estimates.test.ts tests/pastebin-estimates.test.ts
npm run typecheck && npm run lint
git add lib/notification-estimates.ts tests/notification-estimates.test.ts components/learning/notification-capacity.tsx mdx-components.tsx
git commit -m "feat: add notification service capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/pastebin-architecture.tsx` (HLD) and
`components/diagrams/paste-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/notification-architecture.tsx`, `components/diagrams/notification-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { NotificationArchitecture } from "@/components/diagrams/notification-architecture";
import {
  SendFanoutSequence,
  RetryBackoffSequence,
  DeadLetterSequence,
  IdempotentSendSequence,
} from "@/components/diagrams/notification-flows";

describe("NotificationArchitecture", () => {
  it("exposes the notification architecture to non-visual readers", () => {
    render(<NotificationArchitecture />);
    expect(
      screen.getByRole("img", { name: /notification architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/dead.?letter/i)).toBeInTheDocument();
  });
});

describe("notification flow sequences", () => {
  it("renders the fan-out, retry, dead-letter, and idempotent sequences", () => {
    render(<SendFanoutSequence />);
    expect(screen.getByRole("img", { name: /fan.?out/i })).toBeInTheDocument();
    render(<RetryBackoffSequence />);
    expect(screen.getByRole("img", { name: /retry|backoff/i })).toBeInTheDocument();
    render(<DeadLetterSequence />);
    expect(screen.getByRole("img", { name: /dead.?letter/i })).toBeInTheDocument();
    render(<IdempotentSendSequence />);
    expect(screen.getByRole("img", { name: /idempoten|duplicate/i })).toBeInTheDocument();
  });
});
```
NOTE on a known gotcha (seen in the Pastebin build): if a node label string also
appears in the caption, `getByText` finds multiple matches and fails. Keep the exact
phrase the test asserts (`dead-letter`) in the **caption** and use a distinct node
label (e.g. node `"DLQ"` with caption text "dead-letter queue"). Same for any phrase
a test matches with `getByText`.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `notification-architecture.tsx` exporting
`NotificationArchitecture`, following the `pastebin-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Producer` (infra) → `Ingestion API` (service) → `Ingestion Queue` (queue).
- `Fan-out Service` (service) consuming the ingestion queue, consulting a `Preference Store` (store) and a `Dedup Store` (store/cache), and publishing to `Per-channel Queues` (queue) — represent push/SMS/email (one queue node labeled e.g. "Channel Queues" is fine).
- `Channel Workers` (service) consuming per-channel queues and calling `Providers` (external) — APNs/FCM, SMS gateway, email.
- A `DLQ` (queue) fed by exhausted retries (use a `control` variant edge labeled "exhausted → DLQ").
- `title` contains "Notification architecture"; `caption` names **queue**, **fan-out**, **retries**, and the phrase **dead-letter** and explains async decoupling + idempotency in prose. (Per the gotcha above, keep "dead-letter" in the caption and label the node "DLQ".)

**Step 4: Implement the flow sequences** `notification-flows.tsx`, exporting four
components (copy the `Sequence`/`StepLabel` helpers from `paste-flows.tsx`). Each `title`
contains the keyword the test matches:
- `SendFanoutSequence` — title contains "fan-out"; actors Producer, Ingestion API, Ingestion Queue, Fan-out Service, Channel Queues; steps: `POST /v1/notifications`, `202 Accepted` (reply), enqueue, fan-out consumes, checks preferences, publishes one message per enabled channel. Caption: accept is fast and async; fan-out amplifies.
- `RetryBackoffSequence` — title contains "retry" or "backoff"; actors Channel Worker, Provider, Channel Queue; steps: deliver → provider transient failure (`5xx`/timeout, `control` variant) → re-enqueue with exponential backoff + jitter → later attempt succeeds (`200`/accepted). Caption: transient failures retried with backoff.
- `DeadLetterSequence` — title contains "dead-letter"; actors Channel Worker, Provider, DLQ; steps: repeated failures exhaust the retry budget → message moved to the DLQ (`control` variant) → alert. Caption: poison/exhausted messages are dead-lettered, not retried forever.
- `IdempotentSendSequence` — title contains "idempotent" or "duplicate"; actors Producer, Ingestion API, Dedup Store; steps: two requests with the same `Idempotency-Key` → first does check-and-set on the dedup store and proceeds → second finds the key already set and is suppressed (`control` variant, returns the same `202`/notification id). Caption: at-least-once + idempotency = effectively-once.

**Step 5: Register** all five in `mdx-components.tsx`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/notification-architecture.tsx components/diagrams/notification-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add notification service architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling
MDX skeleton with all 18 section ids, and update the two existing "three tutorials"
tests to "four".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/notification-service.mdx` (skeleton).

IMPORTANT: there are currently THREE available tutorials (url-shortener, rate-limiter, pastebin). You add a FOURTH. Read each test file BEFORE editing to match its exact phrasing.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all FOUR tutorials are registered and `notification-service` has 18 sections. Change any "returns undefined for unregistered" slug that is now registered to a still-missing one like `distributed-cache`.

**Step 2:** `tests/curriculum.test.ts` — available slugs become `["url-shortener", "rate-limiter", "pastebin", "notification-service"]` (sequence order); assert `getProblem("notification-service")?.title === "Notification Service"`.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `notification-service` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add:
```ts
"notification-service": {
  slug: "notification-service",
  title: "Design a Notification Service",
  description:
    "An interview-grade walkthrough of a multi-channel notification service: an asynchronous fan-out pipeline over message queues, at-least-once delivery made safe with idempotency, retries with backoff and a dead-letter queue, user preferences and rate limiting, scaling, and failure modes.",
  difficulty: "Intermediate",
  readingMinutes: 34,
  concepts: ["Fan-out", "Message queues", "Idempotency", "Retries"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "fanout-pipeline", label: "Fan-out Pipeline", depth: "advanced" },
    { id: "delivery-guarantees", label: "Delivery Guarantees & Idempotency", depth: "advanced" },
    { id: "retries-dlq", label: "Retries & Dead-Letter Queue", depth: "advanced" },
    { id: "user-preferences", label: "Preferences & Rate Limiting", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "security-abuse", label: "Security & Abuse", depth: "advanced" },
    { id: "observability", label: "Observability", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import NotificationServiceContent from "@/content/tutorials/notification-service.mdx";` and `"notification-service": NotificationServiceContent,` to the content map.

**Step 7:** Create `content/tutorials/notification-service.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids exactly as above), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/notification-service
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/notification-service.mdx
git commit -m "feat: register notification service tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus, orchestrator)

Replace the skeleton's first nine sections (framing → delivery guarantees) with
complete content embedding the components from Tasks 1–2. Authored by the orchestrator.
Per spec section notes 1–9, in particular:
- `capacity-estimates` — `<NotificationCapacity assumptions={{ notificationsPerDay: 500000000, fanoutFactor: 2, peakMultiplier: 4, retryOverheadPercent: 20, avgPayloadBytes: 1000 }} />` then read off the fan-out/retry amplification lesson.
- `entity-model` — `EntityModel name="Notification"` (the per-channel delivery record) + prose on NotificationRequest, UserPreference, Template.
- `api-design` — `ApiContract` for `POST /v1/notifications` returning **202** with `Idempotency-Key`, and `GET /v1/notifications/{id}`.
- `high-level-architecture` — `<NotificationArchitecture />` + component prose.
- `detailed-flows` — `<SendFanoutSequence />`, `<RetryBackoffSequence />`, `<DeadLetterSequence />`, `<IdempotentSendSequence />` with prose.
- `fanout-pipeline` — async + queues; per-channel queues prevent head-of-line blocking.
- `delivery-guarantees` — at-least-once; effectively-once via idempotency key + dedup store.

End: `npm run build` compiles; `npm test` green. Commit `content: author notification service sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus, orchestrator)

Complete the tutorial (retries/DLQ → FAQ) and add the structural content test.
Per spec notes 10–18, including a `TradeoffTable` for scaling stages, a `FailureMatrix`
with ≥ 6 rows, a `DecisionRecord`, ≥ 6 `<KnowledgeCheck>` total (distributed through the
deep-dive sections too), and one `<Faq items={[...]} />` with ≥ 12 entries.

Then create `tests/notification-content.test.ts` (mirror `tests/pastebin-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<NotificationCapacity`, `<NotificationArchitecture`, and the four sequences `<SendFanoutSequence`, `<RetryBackoffSequence`, `<DeadLetterSequence`, `<IdempotentSendSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test -- tests/notification-content.test.ts` and `npm run build` pass. Commit
`content: complete notification service tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 21), and run
full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 22 to 21 (four tutorials now available) and add:
```ts
test("learner can open the notification service tutorial", async ({ page }) => {
  await page.goto("/learn/notification-service");
  await expect(
    page.getByRole("heading", { name: /design a notification service/i }),
  ).toBeVisible();
  await page.goto("/learn/notification-service#delivery-guarantees");
  await expect(page.locator("#delivery-guarantees")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /notification architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the pastebin test, avoids the numbered/hidden-on-mobile TOC link issue.) Verify the actual current count in the file and decrement by one if it differs from 22.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify notification service tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/pastebin.mdx` and `rate-limiter.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — accept/publish path), `redirect` (green — successful delivery), `async` (violet dashed — queue consumption/fan-out), `control` (amber dashed — failure/retry/DLQ/dedup-suppress), `muted` (telemetry dotted), `ingress` (plain). Node kinds: `queue` for queues/DLQ, `external` for providers, `service` for workers/services, `store`/`cache` for preference & dedup stores.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep the asserted phrase in the caption, distinct node labels).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/notification-estimates.test.ts`.
