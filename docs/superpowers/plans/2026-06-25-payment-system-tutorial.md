# Payment System Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the tenth complete curriculum tutorial — an Advanced, correctness-under-failure walkthrough of a Payment System: idempotency/exactly-once, the double-entry ledger, the payment state machine, the dual-write problem (transactional outbox/saga), reconciliation, and security/compliance — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first nine tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **idempotency**, the **double-entry ledger**, the **dual-write problem**, and **reconciliation**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the nine existing tutorials.
- Invariants: payments processed **exactly once** via a client **idempotency key** (a retry returns the original result, never a double charge); an **append-only immutable double-entry ledger** where every movement is equal **debits and credits**, **balances are derived**, and corrections are **reversing entries**; the ledger is the **source of truth**, the Payment row a projection; a payment is a durable **state machine**; the ledger write and external **PSP** call can't be one ACID transaction (**dual-write problem**), solved with a **transactional outbox**/saga + idempotent PSP calls; **reconciliation** compares ledger vs external settlement; **money is conserved**. Throughput is modest — correctness and durability dominate.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register payment-system MDX
├── components/
│   ├── diagrams/
│   │   ├── payment-system-architecture.tsx              # NEW: HLD (client, payment API, orchestrator, ledger svc/DB, outbox, PSP, reconciliation)
│   │   └── payment-flows.tsx                             # NEW: auth-capture / idempotent-retry / reconciliation / refund sequences
│   └── learning/
│       └── payment-system-capacity.tsx                  # NEW: wrapper over CapacityTable
├── content/tutorials/payment-system.mdx                # NEW: full tutorial content
├── lib/
│   ├── payment-system-estimates.ts                      # NEW: pure capacity calc
│   ├── tutorial-registry.ts                             # MODIFY: add payment-system entry (18 sections)
│   └── curriculum.ts                                    # MODIFY: flip payment-system to available
├── mdx-components.tsx                                   # MODIFY: register new components
├── tests/
│   ├── payment-system-estimates.test.ts                 # NEW
│   ├── payment-system-content.test.ts                   # NEW
│   ├── diagrams.test.tsx                                # MODIFY: payment-system diagram assertions
│   ├── tutorial-registry.test.ts                        # MODIFY: ten tutorials
│   └── curriculum.test.ts                               # MODIFY: ten available problems (payment-system inserts at seq 18, mid-list)
└── e2e/pilot.spec.ts                                   # MODIFY: payment-system flow + coming-soon count 16→15
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Payment System capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/payment-system-estimates.ts`, `tests/payment-system-estimates.test.ts`, `components/learning/payment-system-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/payment-system-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculatePaymentSystemCapacity } from "@/lib/payment-system-estimates";

describe("calculatePaymentSystemCapacity", () => {
  const result = calculatePaymentSystemCapacity({
    dailyPayments: 100_000_000,
    avgPaymentValueUsd: 50,
    peakFactor: 5,
    ledgerEntriesPerPayment: 4,
    avgEntryBytes: 500,
    retentionYears: 7,
  });

  it("derives average payments per second", () => {
    expect(result.avgPaymentsPerSecond).toBeCloseTo(1157.41, 1);
  });
  it("derives peak payments per second", () => {
    expect(result.peakPaymentsPerSecond).toBeCloseTo(5787.04, 1);
  });
  it("derives daily money volume in USD", () => {
    expect(result.dailyVolumeUsd).toBe(5_000_000_000);
  });
  it("derives ledger entries per second", () => {
    expect(result.ledgerEntriesPerSecond).toBeCloseTo(4629.63, 1);
  });
  it("derives ledger storage over the retention window in TB", () => {
    expect(result.ledgerStorageTb).toBeCloseTo(511, 5);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/payment-system-estimates.test.ts`.

**Step 3: Implement** `lib/payment-system-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;
const BYTES_PER_TB = 1_000_000_000_000;

export interface PaymentSystemCapacityAssumptions {
  /** Payments processed per day. */
  dailyPayments: number;
  /** Average value of a payment, in USD. */
  avgPaymentValueUsd: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Immutable ledger entries written per payment (double-entry + fees). */
  ledgerEntriesPerPayment: number;
  /** Average serialized size of one ledger entry, in bytes. */
  avgEntryBytes: number;
  /** Years the immutable ledger is retained. */
  retentionYears: number;
}

export interface PaymentSystemCapacityResults {
  avgPaymentsPerSecond: number;
  peakPaymentsPerSecond: number;
  dailyVolumeUsd: number;
  ledgerEntriesPerSecond: number;
  ledgerStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a payment system is NOT a
 * high-QPS problem (a few thousand payments/sec at peak) — the weight is that each payment
 * fans into several immutable ledger entries retained for years, and billions of dollars a
 * day flow through, so the design optimizes for correctness, durability, and auditability
 * rather than raw scale.
 */
export function calculatePaymentSystemCapacity(
  a: PaymentSystemCapacityAssumptions,
): PaymentSystemCapacityResults {
  const avgPaymentsPerSecond = a.dailyPayments / SECONDS_PER_DAY;
  const peakPaymentsPerSecond = avgPaymentsPerSecond * a.peakFactor;
  const dailyVolumeUsd = a.dailyPayments * a.avgPaymentValueUsd;
  const ledgerEntriesPerSecond = avgPaymentsPerSecond * a.ledgerEntriesPerPayment;
  const ledgerStorageTb =
    (a.dailyPayments *
      a.ledgerEntriesPerPayment *
      a.avgEntryBytes *
      DAYS_PER_YEAR *
      a.retentionYears) /
    BYTES_PER_TB;

  return {
    avgPaymentsPerSecond,
    peakPaymentsPerSecond,
    dailyVolumeUsd,
    ledgerEntriesPerSecond,
    ledgerStorageTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/payment-system-capacity.tsx`, mirroring
`components/learning/cloud-drive-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculatePaymentSystemCapacity,
  type PaymentSystemCapacityAssumptions,
} from "@/lib/payment-system-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PaymentSystemCapacity({
  assumptions,
}: {
  assumptions: PaymentSystemCapacityAssumptions;
}) {
  const r = calculatePaymentSystemCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily payments", value: fmt(assumptions.dailyPayments) },
    { label: "Avg payment value", value: `$${fmt(assumptions.avgPaymentValueUsd)}` },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Ledger entries / payment", value: fmt(assumptions.ledgerEntriesPerPayment) },
    { label: "Avg entry size", value: `${fmt(assumptions.avgEntryBytes)} B` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
  ];

  const results: ResultRow[] = [
    { label: "Avg payments / sec", value: fmt(r.avgPaymentsPerSecond), consequence: "Throughput is modest — this is not a high-QPS problem; correctness is the constraint, not scale." },
    { label: "Peak payments / sec", value: fmt(r.peakPaymentsPerSecond), consequence: "Even at peak, a few thousand a second — a single well-built node could nearly serve it." },
    { label: "Daily money volume", value: `$${fmt(r.dailyVolumeUsd)}`, consequence: "Billions a day flow through — one double-charge or lost payment is real money and a compliance incident." },
    { label: "Ledger entries / sec", value: fmt(r.ledgerEntriesPerSecond), consequence: "Each payment fans into several immutable double-entry rows — the ledger is the write-heavy, append-only core." },
    { label: "Ledger storage (7 yr)", value: `${fmt(r.ledgerStorageTb)} TB`, consequence: "The ledger is append-only and retained for years for audit — it is never mutated, only grown." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `PaymentSystemCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/payment-system-estimates.test.ts tests/cloud-drive-estimates.test.ts
npm run typecheck && npm run lint
git add lib/payment-system-estimates.ts tests/payment-system-estimates.test.ts components/learning/payment-system-capacity.tsx mdx-components.tsx
git commit -m "feat: add payment system capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/cloud-drive-architecture.tsx` (HLD) and
`components/diagrams/cache-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/payment-system-architecture.tsx`, `components/diagrams/payment-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { PaymentSystemArchitecture } from "@/components/diagrams/payment-system-architecture";
import {
  AuthCaptureSequence,
  IdempotentRetrySequence,
  ReconciliationSequence,
  RefundSequence,
} from "@/components/diagrams/payment-flows";

describe("PaymentSystemArchitecture", () => {
  it("exposes the payment system architecture to non-visual readers", () => {
    render(<PaymentSystemArchitecture />);
    expect(
      screen.getByRole("img", { name: /payment system architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/source of truth/i)).toBeInTheDocument();
  });
});

describe("payment flow sequences", () => {
  it("renders the auth-capture, idempotent-retry, reconciliation, and refund sequences", () => {
    render(<AuthCaptureSequence />);
    expect(screen.getByRole("img", { name: /authoriz/i })).toBeInTheDocument();
    render(<IdempotentRetrySequence />);
    expect(screen.getByRole("img", { name: /idempoten|retry/i })).toBeInTheDocument();
    render(<ReconciliationSequence />);
    expect(screen.getByRole("img", { name: /reconcil/i })).toBeInTheDocument();
    render(<RefundSequence />);
    expect(screen.getByRole("img", { name: /refund/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"source of truth"** in the
**caption only** (NOT in any node label and NOT in the `DiagramFrame` title). No node
label/sublabel may contain "source of truth". Also: all four flow titles render into the same
test DOM in one test, so each regex must match exactly one title — use distinct, mutually
exclusive title keywords ("authorize", "idempotent"/"retry", "reconciliation", "refund") and
do NOT let any of those words appear in more than one title.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `payment-system-architecture.tsx` exporting
`PaymentSystemArchitecture`, following the `cloud-drive-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Client` (infra, sublabel "merchant / app") → `Payment API` (service, sublabel "idempotency keys") via `ingress` ("POST /payments + key").
- `Payment API` → `Idempotency Store` (store, sublabel "dedup keys") via `create` ("check / store key").
- `Payment API` → `Payment Orchestrator` (service, sublabel "state machine") via `redirect` ("process (deduped)").
- `Payment Orchestrator` → `Ledger Service` (service, sublabel "double-entry") via `create` ("record entries").
- `Ledger Service` → `Ledger DB` (store, sublabel "append-only") via `create` ("append debit + credit").
- `Payment Orchestrator` → `Outbox / Events` (queue, sublabel "async dispatch") via `async` ("intent (outbox)").
- `Outbox / Events` → `PSP / Bank` (external, sublabel "card network") via `async` ("call PSP idempotently").
- `Reconciliation` (service, sublabel "ledger vs PSP") → `Ledger DB` via `redirect` ("read ledger") and `PSP / Bank` → `Reconciliation` via `muted` ("settlement file").
- `title` contains "Payment system architecture"; `caption` names **exactly-once / idempotency**, the **double-entry ledger** as the **source of truth**, the **outbox** dual-write fix, and **reconciliation**, in prose. (Per the gotcha, keep "source of truth" in the caption only; distinct node labels.)
- Node kinds: `infra` for the client, `service` for Payment API/Orchestrator/Ledger/Reconciliation, `store` for the idempotency store and ledger DB, `queue` for the outbox, `external` for the PSP/Bank.
- Suggested geometry (viewBox `0 0 860 480`): client {24,210}, paymentApi {196,210}, idempotencyStore {196,360}, orchestrator {400,90}, ledgerSvc {400,210}, reconciliation {400,330}, psp {640,90}, ledgerDb {640,210}, outbox {640,330} — `w` ≈ 150, `h` ≈ 56 (store `h` ≈ 60). Adjust to avoid overlaps.

**Step 4: Implement the flow sequences** `payment-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `cache-flows.tsx` verbatim).
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive:
- `AuthCaptureSequence` — title contains "authorize" (e.g. "Sequence: authorize & capture — state machine and double-entry posting"); actors Client, Payment Orchestrator, Ledger Service, PSP; steps: POST payment with idempotency key, orchestrator persists state initiated→authorized, post pending double-entry, call PSP to authorize+capture, PSP confirms, ledger posts debit+credit (state captured), return result. Caption: a payment advances through a durable state machine; each movement is recorded as equal debits and credits; the external PSP actually moves the money.
- `IdempotentRetrySequence` — title contains "idempotent" or "retry" (e.g. "Sequence: idempotent retry — duplicate request returns the original result"); actors Client, Payment API, Idempotency Store, Payment Orchestrator; steps: client sends payment (key K), API stores K + begins, response lost to a timeout, client retries with the SAME key K, API finds K already completed in the store, returns the stored original result WITHOUT charging again. Caption: retries are inevitable; the idempotency key makes a duplicate request return the original result instead of charging twice — exactly-once. Use `control` for the timeout/retry detect.
- `ReconciliationSequence` — title contains "reconciliation" (e.g. "Sequence: reconciliation — internal ledger versus PSP settlement"); actors Reconciliation, Ledger DB, PSP; steps: fetch the PSP settlement file, read the internal ledger for the period, match line by line, detect a mismatch (present at PSP, missing in ledger), raise a discrepancy for resolution. Caption: reconciliation compares the internal ledger against the external PSP settlement to catch any drift; mismatches are flagged and resolved so the books stay correct. Use `control` for the mismatch.
- `RefundSequence` — title contains "refund" (e.g. "Sequence: refund — a reversing double-entry transaction"); actors Client, Payment Orchestrator, Ledger Service, PSP; steps: refund request (idempotency key), orchestrator validates the original captured payment, call PSP refund, PSP confirms, ledger posts REVERSING entries (credit customer, debit merchant), state refunded. Caption: a refund is not a deletion — it's a new reversing double-entry transaction, preserving the immutable audit trail. Use `create` for the reversing post.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/payment-system-architecture.tsx components/diagrams/payment-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add payment system architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "nine tutorials" tests to "ten".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/payment-system.mdx` (skeleton).

IMPORTANT: there are currently NINE available tutorials. You add a TENTH. `payment-system` is **sequence 18**, so in the curriculum's available-by-sequence ordering it inserts **between `ticket-booking` (seq 16) and `collaborative-doc-editor` (seq 22)** — NOT at the end. Read each test file BEFORE editing to match its exact phrasing. Do NOT change the `getTutorial("api-gateway")` undefined test — api-gateway stays coming-soon.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all TEN tutorials are registered. In the sorted `Object.keys(tutorials)` array, `"payment-system"` sorts between `"notification-service"` and `"pastebin"`. Add `expect(getTutorial("payment-system")?.sections).toHaveLength(18);`. Update the two descriptive `it(...)` strings to mention Payment System. Leave the `getTutorial("api-gateway")` undefined test as-is.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "payment-system", "collaborative-doc-editor", "cloud-drive"]` (payment-system is seq 18, inserted after ticket-booking and before collaborative-doc-editor). Add `expect(getProblem("payment-system")?.title).toBe("Payment System");`. Update the descriptive `it(...)` string.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `payment-system` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object does not matter for the sorted-keys test, but keep it tidy — e.g. after the `ticket-booking` entry or at the end before `};`):
```ts
"payment-system": {
  slug: "payment-system",
  title: "Design a Payment System",
  description:
    "An interview-grade walkthrough of a payment system: exactly-once processing with idempotency keys, the immutable double-entry ledger, the payment lifecycle state machine, the dual-write problem and the transactional outbox, reconciliation against external providers, security and compliance, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 37,
  concepts: ["Double-entry ledger", "Idempotency", "Consistency", "Reconciliation"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "idempotency", label: "Idempotency & Exactly-Once", depth: "advanced" },
    { id: "double-entry-ledger", label: "The Double-Entry Ledger", depth: "advanced" },
    { id: "payment-lifecycle", label: "Payment Lifecycle & State Machine", depth: "advanced" },
    { id: "distributed-transactions", label: "Distributed Transactions & the Dual-Write Problem", depth: "advanced" },
    { id: "reconciliation", label: "Reconciliation", depth: "advanced" },
    { id: "security-compliance", label: "Security & Compliance", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import PaymentSystemContent from "@/content/tutorials/payment-system.mdx";` and `"payment-system": PaymentSystemContent,` to the content map.

**Step 7:** Create `content/tutorials/payment-system.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/payment-system
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/payment-system.mdx
git commit -m "feat: register payment system tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks
1–3, then installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have
registered the embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<PaymentSystemCapacity assumptions={{ dailyPayments: 100000000, avgPaymentValueUsd: 50, peakFactor: 5, ledgerEntriesPerPayment: 4, avgEntryBytes: 500, retentionYears: 7 }} />` then read off the correctness-not-scale lesson.
- `entity-model` — `EntityModel name="Payment"` (id, idempotency_key, amount, currency, status, payer/payee, psp_ref) + prose on LedgerEntry (immutable, account/debit/credit/txn), Account (balance derived), IdempotencyKey (fingerprint → result); the ledger is the source of truth, Payment a projection.
- `api-design` — `ApiContract` for `POST /payments` (with `Idempotency-Key` header), `POST /payments/{id}/refund`, `GET /payments/{id}`.
- `high-level-architecture` — `<PaymentSystemArchitecture />` + component prose.
- `detailed-flows` — `<AuthCaptureSequence />`, `<IdempotentRetrySequence />`, `<ReconciliationSequence />`, `<RefundSequence />` with prose.
- deep dives `idempotency`, `double-entry-ledger`, `payment-lifecycle`, `distributed-transactions`, `reconciliation`, `security-compliance` per spec, each of the first five with a `<KnowledgeCheck>`.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/payment-system-content.test.ts` (mirror `tests/cloud-drive-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<PaymentSystemCapacity`, `<PaymentSystemArchitecture`, and the four sequences `<AuthCaptureSequence`, `<IdempotentRetrySequence`, `<ReconciliationSequence`, `<RefundSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with
real embeds and generates `/learn/payment-system`) all green. Commit `content: complete payment system tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 15), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 16 to 15 (ten tutorials now available — verify the current value is 16 first) and add:
```ts
test("learner can open the payment system tutorial", async ({ page }) => {
  await page.goto("/learn/payment-system");
  await expect(
    page.getByRole("heading", { name: /design a payment system/i }),
  ).toBeVisible();
  await page.goto("/learn/payment-system#double-entry-ledger");
  await expect(page.locator("#double-entry-ledger")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /payment system architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.)

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify payment system tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/cloud-drive.mdx` and `ticket-booking.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — write / ledger post / store), `redirect` (green — read / process path), `async` (violet dashed — outbox / PSP dispatch), `control` (amber dashed — timeout / retry / mismatch detect), `muted` (telemetry dotted — settlement file), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for the API/orchestrator/ledger/reconciliation services, `store` for the idempotency store and ledger DB, `queue` for the outbox, `external` for the PSP/Bank.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "source of truth" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "authorize"/"idempotent"(or "retry")/"reconciliation"/"refund" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/payment-system-estimates.test.ts`.
- **payment-system is seq 18 — it inserts MID-LIST** (after ticket-booking, before collaborative-doc-editor) in the curriculum available-by-sequence ordering. Do NOT append it at the end.
