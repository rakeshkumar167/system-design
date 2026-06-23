# Ticket Booking System Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the fifth complete curriculum tutorial — an Advanced, strongly-consistent, high-contention walkthrough of a Ticket Booking System (no-oversell invariant, reservations/holds, optimistic vs pessimistic locking, payment saga, on-sale contention) — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first four tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **concurrency control / no oversell**, **the hold reservation lifecycle**, **strong consistency on inventory**, and **the idempotent payment saga**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the four existing tutorials.
- Hard invariant: **never oversell**. A contended seat hold is an **atomic conditional update** (compare-and-set on `version` / `UPDATE … WHERE status='available'`) or a row lock — never read-modify-write. Inventory of record is **strongly consistent**; holds have a **TTL** and are released on expiry; the hold→pay→confirm path is an **idempotent saga**; a taken seat returns **409 Conflict**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register ticket-booking MDX
├── components/
│   ├── diagrams/
│   │   ├── ticket-booking-architecture.tsx              # NEW: HLD (waiting room, booking service, inventory store, hold worker, payment, booking store, availability cache)
│   │   └── booking-flows.tsx                            # NEW: hold / contention / confirm-payment / hold-expiry sequences
│   └── learning/
│       └── ticket-booking-capacity.tsx                  # NEW: wrapper over CapacityTable
├── content/tutorials/ticket-booking.mdx                 # NEW: full tutorial content
├── lib/
│   ├── ticket-booking-estimates.ts                      # NEW: pure capacity calc
│   ├── tutorial-registry.ts                             # MODIFY: add ticket-booking entry (18 sections)
│   └── curriculum.ts                                    # MODIFY: flip ticket-booking to available
├── mdx-components.tsx                                   # MODIFY: register new components
├── tests/
│   ├── ticket-booking-estimates.test.ts                 # NEW
│   ├── ticket-booking-content.test.ts                   # NEW
│   ├── diagrams.test.tsx                                # MODIFY: ticket-booking diagram assertions
│   ├── tutorial-registry.test.ts                        # MODIFY: five tutorials
│   └── curriculum.test.ts                               # MODIFY: five available problems
└── e2e/pilot.spec.ts                                    # MODIFY: ticket-booking flow + count 21→20
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Ticket Booking capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/ticket-booking-estimates.ts`, `tests/ticket-booking-estimates.test.ts`, `components/learning/ticket-booking-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/ticket-booking-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateTicketBookingCapacity } from "@/lib/ticket-booking-estimates";

describe("calculateTicketBookingCapacity", () => {
  const result = calculateTicketBookingCapacity({
    eventsPerDay: 1000,
    seatsPerEvent: 50_000,
    peakConcurrentUsers: 1_000_000,
    onsaleWindowSeconds: 60,
    availabilityReadsPerHold: 20,
  });

  it("derives the daily seat inventory", () => {
    expect(result.dailyInventory).toBe(50_000_000);
  });
  it("derives the contention ratio (users per seat)", () => {
    expect(result.contentionRatio).toBe(20);
  });
  it("derives peak hold attempts per second across the on-sale window", () => {
    expect(result.peakHoldAttemptsPerSecond).toBeCloseTo(16666.67, 2);
  });
  it("derives peak availability reads per second", () => {
    expect(result.peakAvailabilityReadsPerSecond).toBeCloseTo(333333.33, 1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/ticket-booking-estimates.test.ts`.

**Step 3: Implement** `lib/ticket-booking-estimates.ts`:
```ts
export interface TicketBookingCapacityAssumptions {
  /** Events going on sale per day. */
  eventsPerDay: number;
  /** Seats per event (the contended inventory). */
  seatsPerEvent: number;
  /** Peak concurrent users at a hot on-sale. */
  peakConcurrentUsers: number;
  /** Seconds over which the on-sale crush arrives. */
  onsaleWindowSeconds: number;
  /** Availability (seat-map) reads per hold attempt. */
  availabilityReadsPerHold: number;
}

export interface TicketBookingCapacityResults {
  dailyInventory: number;
  contentionRatio: number;
  peakHoldAttemptsPerSecond: number;
  peakAvailabilityReadsPerSecond: number;
}

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. The point it teaches: the write path is
 * modest in raw QPS but brutally contended (many users per seat), while reads dominate
 * and can be cached.
 */
export function calculateTicketBookingCapacity(
  a: TicketBookingCapacityAssumptions,
): TicketBookingCapacityResults {
  const dailyInventory = a.eventsPerDay * a.seatsPerEvent;
  const contentionRatio = a.peakConcurrentUsers / a.seatsPerEvent;
  const peakHoldAttemptsPerSecond = a.peakConcurrentUsers / a.onsaleWindowSeconds;
  const peakAvailabilityReadsPerSecond =
    peakHoldAttemptsPerSecond * a.availabilityReadsPerHold;

  return {
    dailyInventory,
    contentionRatio,
    peakHoldAttemptsPerSecond,
    peakAvailabilityReadsPerSecond,
  };
}
```

**Step 4: Run to verify it passes** (4 tests).

**Step 5: Create the wrapper** `components/learning/ticket-booking-capacity.tsx`, mirroring
`components/learning/notification-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateTicketBookingCapacity,
  type TicketBookingCapacityAssumptions,
} from "@/lib/ticket-booking-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function TicketBookingCapacity({
  assumptions,
}: {
  assumptions: TicketBookingCapacityAssumptions;
}) {
  const r = calculateTicketBookingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Events / day", value: fmt(assumptions.eventsPerDay) },
    { label: "Seats / event", value: fmt(assumptions.seatsPerEvent) },
    { label: "Peak concurrent users", value: fmt(assumptions.peakConcurrentUsers) },
    { label: "On-sale window", value: `${fmt(assumptions.onsaleWindowSeconds)} s` },
    { label: "Reads / hold", value: fmt(assumptions.availabilityReadsPerHold) },
  ];

  const results: ResultRow[] = [
    { label: "Daily inventory", value: fmt(r.dailyInventory), consequence: "Seats sold per day — a bounded, finite resource, unlike unbounded content systems." },
    { label: "Contention ratio", value: `${fmt(r.contentionRatio)}:1`, consequence: "Users competing per seat. 19 of every 20 hold attempts on a hot seat must be rejected — instantly and correctly." },
    { label: "Peak hold attempts / sec", value: fmt(r.peakHoldAttemptsPerSecond), consequence: "Modest raw QPS, but every attempt contends on a tiny, strongly-consistent inventory — correctness, not throughput, is the challenge." },
    { label: "Peak availability reads / sec", value: fmt(r.peakAvailabilityReadsPerSecond), consequence: "Reads dominate by 20×; the seat-map display is cached and approximate, while the hold is the authoritative write." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `TicketBookingCapacity` in `mdx-components.tsx`.

**Step 7: Verify and commit**
```bash
npm test -- tests/ticket-booking-estimates.test.ts tests/notification-estimates.test.ts
npm run typecheck && npm run lint
git add lib/ticket-booking-estimates.ts tests/ticket-booking-estimates.test.ts components/learning/ticket-booking-capacity.tsx mdx-components.tsx
git commit -m "feat: add ticket booking capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/notification-architecture.tsx` (HLD) and
`components/diagrams/notification-flows.tsx` / `paste-flows.tsx` (sequences) — do not
invent new SVG conventions.

**Files:** Create `components/diagrams/ticket-booking-architecture.tsx`, `components/diagrams/booking-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { TicketBookingArchitecture } from "@/components/diagrams/ticket-booking-architecture";
import {
  HoldSeatSequence,
  ContentionSequence,
  ConfirmPaymentSequence,
  HoldExpirySequence,
} from "@/components/diagrams/booking-flows";

describe("TicketBookingArchitecture", () => {
  it("exposes the ticket booking architecture to non-visual readers", () => {
    render(<TicketBookingArchitecture />);
    expect(
      screen.getByRole("img", { name: /ticket booking architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/oversell/i)).toBeInTheDocument();
  });
});

describe("booking flow sequences", () => {
  it("renders the hold, contention, confirm, and expiry sequences", () => {
    render(<HoldSeatSequence />);
    expect(screen.getByRole("img", { name: /hold/i })).toBeInTheDocument();
    render(<ContentionSequence />);
    expect(screen.getByRole("img", { name: /contention|race|conflict/i })).toBeInTheDocument();
    render(<ConfirmPaymentSequence />);
    expect(screen.getByRole("img", { name: /confirm|payment/i })).toBeInTheDocument();
    render(<HoldExpirySequence />);
    expect(screen.getByRole("img", { name: /expir/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha (hit on prior tutorials): if a phrase a test
asserts via `getByText` also appears in a node label AND the caption, the query finds
multiple matches and fails. Keep the asserted phrase **"oversell"** in the **caption
only**, and use distinct node labels (e.g. node "Inventory DB", caption text "…never
oversell…").

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `ticket-booking-architecture.tsx` exporting
`TicketBookingArchitecture`, following the `notification-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Client` (infra) → `Waiting Room` (queue) → `Booking Service` (service).
- `Booking Service` → `Inventory DB` (store, strongly consistent, sharded by event) via an atomic conditional hold (use `create` variant labeled "atomic hold").
- `Hold Expiry Worker` (service/queue) sweeping the `Inventory DB` to release expired holds (use `control` variant labeled "release expired").
- `Booking Service` → `Payment` (external) and → `Booking Store` (store) on confirm.
- An `Availability Cache` (cache) serving seat-map reads (use `redirect` variant for the read path).
- `title` contains "Ticket booking architecture"; `caption` names **inventory**, **hold**, **strong consistency**, and the word **oversell** and explains the no-oversell invariant + hold lifecycle in prose. (Per the gotcha, keep "oversell" in the caption; label nodes distinctly.)

**Step 4: Implement the flow sequences** `booking-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel` helpers from `notification-flows.tsx` or `paste-flows.tsx`).
Each `title` contains the keyword the test matches:
- `HoldSeatSequence` — title contains "hold"; actors Client, Booking Service, Inventory DB; steps: `POST /v1/holds`, atomic conditional `UPDATE seat SET status='held', version+1 WHERE status='available'` (1 row updated), `201` hold with `held_until`. Caption: the hold is one atomic conditional update — the seat is reserved or the attempt fails.
- `ContentionSequence` — title contains "contention" (or "race"/"conflict"); actors User A, User B, Inventory DB; steps: both target the same seat; A's conditional update succeeds (1 row), B's matches 0 rows and returns `409 Conflict` (`control` variant). Caption: exactly one buyer wins; the other is rejected instantly — no oversell.
- `ConfirmPaymentSequence` — title contains "confirm" (or "payment"); actors Client, Booking Service, Payment, Inventory DB/Booking Store; steps: `POST /v1/bookings` with idempotency key, charge Payment (`external`), on success flip held→booked idempotently and write the booking, `201`. Caption: hold→pay→confirm saga; confirm is idempotent.
- `HoldExpirySequence` — title contains "expir"; actors Hold Expiry Worker, Inventory DB; steps: hold TTL passes, worker finds expired holds and releases them held→available (`control` variant). Caption: unpaid holds must expire and release, or seats leak and become unsellable.

**Step 5: Register** all five in `mdx-components.tsx`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/ticket-booking-architecture.tsx components/diagrams/booking-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add ticket booking architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "four tutorials" tests to
"five".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/ticket-booking.mdx` (skeleton).

IMPORTANT: there are currently FOUR available tutorials (url-shortener, rate-limiter, pastebin, notification-service). You add a FIFTH. Note `ticket-booking` is sequence 16, so in the curriculum's available-by-sequence ordering it comes AFTER the other four. Read each test file BEFORE editing to match its exact phrasing.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all FIVE tutorials are registered and `ticket-booking` has 18 sections. Change any "returns undefined for unregistered" slug that is now registered to a still-missing one like `distributed-cache`.

**Step 2:** `tests/curriculum.test.ts` — available slugs become (in sequence order) `["url-shortener", "rate-limiter", "pastebin", "notification-service", "ticket-booking"]`; assert `getProblem("ticket-booking")?.title === "Ticket Booking System"`. (ticket-booking is sequence 16, so it sorts last among the available.)

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `ticket-booking` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add:
```ts
"ticket-booking": {
  slug: "ticket-booking",
  title: "Design a Ticket Booking System",
  description:
    "An interview-grade walkthrough of a ticket booking system that sells limited inventory under heavy contention without overselling: the seat reservation lifecycle, optimistic vs pessimistic concurrency control, strong consistency on inventory, the idempotent hold-pay-confirm payment saga, high-contention on-sale management, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Distributed locking", "Inventory", "Strong consistency", "Reservations"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "reservation-lifecycle", label: "Reservation Lifecycle", depth: "advanced" },
    { id: "concurrency-control", label: "Concurrency Control", depth: "advanced" },
    { id: "strong-consistency", label: "Strong Consistency", depth: "advanced" },
    { id: "payment-saga", label: "Payment & Booking Saga", depth: "advanced" },
    { id: "high-contention", label: "High-Contention On-Sales", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "security-abuse", label: "Security & Abuse", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import TicketBookingContent from "@/content/tutorials/ticket-booking.mdx";` and `"ticket-booking": TicketBookingContent,` to the content map.

**Step 7:** Create `content/tutorials/ticket-booking.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids exactly as above), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/ticket-booking
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/ticket-booking.mdx
git commit -m "feat: register ticket booking tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus, orchestrator)

Replace the skeleton's first nine sections (framing → concurrency control) with complete
content embedding the components from Tasks 1–2. Authored by the orchestrator. Per spec
section notes 1–9, in particular:
- `capacity-estimates` — `<TicketBookingCapacity assumptions={{ eventsPerDay: 1000, seatsPerEvent: 50000, peakConcurrentUsers: 1000000, onsaleWindowSeconds: 60, availabilityReadsPerHold: 20 }} />` then read off the contention lesson.
- `entity-model` — `EntityModel name="Seat"` (id, event_id, label, status, hold_id, held_until, version, price) + prose on Event, Hold, Booking.
- `api-design` — `ApiContract` for `POST /v1/holds` (201 or **409 Conflict**) and `POST /v1/bookings` (idempotent confirm + pay); note the cached `GET …/seats`.
- `high-level-architecture` — `<TicketBookingArchitecture />` + component prose.
- `detailed-flows` — `<HoldSeatSequence />`, `<ContentionSequence />`, `<ConfirmPaymentSequence />`, `<HoldExpirySequence />` with prose.
- `reservation-lifecycle` — the seat state machine available→held→booked, hold TTL, why holds and why they must expire.
- `concurrency-control` — the centerpiece: oversell race, optimistic (compare-and-set / conditional UPDATE) vs pessimistic (SELECT … FOR UPDATE), atomic-conditional-update as the fix; include a `<KnowledgeCheck>` here.

End: `npm run build` compiles; `npm test` green. Commit `content: author ticket booking sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus, orchestrator)

Complete the tutorial (strong consistency → FAQ) and add the structural content test.
Per spec notes 10–18, including a `TradeoffTable` for scaling stages, a `FailureMatrix`
with ≥ 6 rows, a `DecisionRecord`, ≥ 6 `<KnowledgeCheck>` total (distributed through the
deep-dive sections too), and one `<Faq items={[...]} />` with ≥ 12 entries.

Then create `tests/ticket-booking-content.test.ts` (mirror `tests/notification-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<TicketBookingCapacity`, `<TicketBookingArchitecture`, and the four sequences `<HoldSeatSequence`, `<ContentionSequence`, `<ConfirmPaymentSequence`, `<HoldExpirySequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test -- tests/ticket-booking-content.test.ts` and `npm run build` pass. Commit
`content: complete ticket booking tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 20), and run
full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 21 to 20 (five tutorials now available) and add:
```ts
test("learner can open the ticket booking tutorial", async ({ page }) => {
  await page.goto("/learn/ticket-booking");
  await expect(
    page.getByRole("heading", { name: /design a ticket booking system/i }),
  ).toBeVisible();
  await page.goto("/learn/ticket-booking#concurrency-control");
  await expect(page.locator("#concurrency-control")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /ticket booking architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Verify the actual current count in the file and decrement by one if it differs from 21.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify ticket booking tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/notification-service.mdx` and `pastebin.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — the atomic hold/write), `redirect` (green — availability read / success), `async` (violet dashed — waiting-room admission), `control` (amber dashed — conflict/rejection/expiry/release), `muted` (telemetry dotted), `ingress` (plain). Node kinds: `queue` for the waiting room and expiry worker, `external` for the payment provider, `service` for booking service, `store` for inventory/booking DBs, `cache` for the availability cache.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep the asserted phrase "oversell" in the caption only; distinct node labels).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/ticket-booking-estimates.test.ts`.
