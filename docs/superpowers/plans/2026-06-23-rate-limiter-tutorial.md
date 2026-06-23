# Rate Limiter Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the second complete curriculum tutorial — an algorithm-first walkthrough of designing a distributed rate-limiting service — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the URL Shortener pilot. New work is a pure capacity module, three rate-limiter SVG/interactive diagram components, a shared `CapacityTable` extraction, the registry/curriculum wiring, and the MDX content. The five rate-limiting algorithms are the centerpiece, shown with an interactive client visualizer that progressively enhances a static SVG fallback.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts, not running limiters.
- Reading experience works without client JS; interactive pieces (visualizer, knowledge checks) progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the rendered URL Shortener tutorial.
- Default failure posture for the design is **fail-open**, stated explicitly with its risk.
- Recommended algorithms for the stated design: **token bucket** (burst tolerance) and **sliding window counter** (smooths the fixed-window boundary spike).

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                         # MODIFY: register rate-limiter MDX
├── components/
│   ├── diagrams/
│   │   ├── rate-limit-visualizer.tsx                 # NEW: interactive algorithm visualizer (client)
│   │   ├── rate-limiter-architecture.tsx             # NEW: distributed HLD
│   │   └── rate-limit-flows.tsx                      # NEW: allow / throttle / fail-open sequences
│   └── learning/
│       ├── capacity-table.tsx                        # NEW: shared data-driven capacity presentation
│       ├── capacity-model.tsx                        # MODIFY: thin URL-shortener wrapper over CapacityTable
│       └── rate-limiter-capacity.tsx                 # NEW: rate-limiter wrapper over CapacityTable
├── content/tutorials/rate-limiter.mdx                # NEW: full tutorial content
├── lib/
│   ├── rate-limiter-estimates.ts                     # NEW: pure capacity calc
│   ├── tutorial-registry.ts                          # MODIFY: add rate-limiter entry (15 sections)
│   └── curriculum.ts                                 # MODIFY: flip rate-limiter to available
├── mdx-components.tsx                                # MODIFY: register new components
├── tests/
│   ├── rate-limiter-estimates.test.ts                # NEW
│   ├── rate-limit-visualizer.test.tsx                # NEW
│   ├── rate-limiter-content.test.ts                  # NEW
│   ├── diagrams.test.tsx                             # MODIFY: rate-limiter diagram assertions
│   ├── tutorial-registry.test.ts                     # MODIFY: two tutorials
│   └── curriculum.test.ts                            # MODIFY: two available problems
└── e2e/pilot.spec.ts                                 # MODIFY: rate-limiter flow + count 24→23
```

---

### Task 1: Capacity Calculation and Shared Capacity Table

Extract the URL Shortener's capacity presentation into a reusable, data-driven
`CapacityTable`, keep `CapacityModel` as a thin wrapper so the existing tutorial
is byte-for-byte unchanged in output, then add the rate-limiter capacity
calculation and its wrapper.

**Files:**
- Create: `lib/rate-limiter-estimates.ts`
- Test: `tests/rate-limiter-estimates.test.ts`
- Create: `components/learning/capacity-table.tsx`
- Modify: `components/learning/capacity-model.tsx`
- Create: `components/learning/rate-limiter-capacity.tsx`
- Modify: `mdx-components.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `RateLimiterCapacityAssumptions`, `RateLimiterCapacityResults`, `calculateRateLimiterCapacity(a)` from `lib/rate-limiter-estimates.ts`.
  - `CapacityTable({ assumptions: AssumptionRow[]; results: ResultRow[] })` where `AssumptionRow = { label: string; value: string }` and `ResultRow = { label: string; value: string; consequence: string }`, from `components/learning/capacity-table.tsx`.
  - `RateLimiterCapacity({ assumptions: RateLimiterCapacityAssumptions })` from `components/learning/rate-limiter-capacity.tsx`, registered in MDX as `RateLimiterCapacity`.

- [ ] **Step 1: Write the failing calculation test**

```ts
// tests/rate-limiter-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateRateLimiterCapacity } from "@/lib/rate-limiter-estimates";

describe("calculateRateLimiterCapacity", () => {
  const result = calculateRateLimiterCapacity({
    peakRequestsPerSecond: 1_000_000,
    checksPerRequest: 1,
    activeKeys: 50_000_000,
    bytesPerCounter: 80,
    redisOpsPerNode: 100_000,
  });

  it("derives counter operations from request volume", () => {
    expect(result.counterOpsPerSecond).toBe(1_000_000);
  });

  it("derives counter memory from active keys", () => {
    // 50M keys * 80 bytes = 4e9 bytes = 4 GB
    expect(result.counterMemoryGB).toBeCloseTo(4, 3);
  });

  it("derives the Redis node count needed for peak ops", () => {
    // 1,000,000 ops / 100,000 ops-per-node = 10 nodes
    expect(result.redisNodesForOps).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/rate-limiter-estimates.test.ts`
Expected: FAIL — `@/lib/rate-limiter-estimates` does not exist.

- [ ] **Step 3: Implement the pure calculation**

```ts
// lib/rate-limiter-estimates.ts
export interface RateLimiterCapacityAssumptions {
  /** Peak inbound requests per second across the fleet. */
  peakRequestsPerSecond: number;
  /** Limiter checks performed per request (usually 1; more with layered policies). */
  checksPerRequest: number;
  /** Distinct counter keys live in any window (the cardinality driver). */
  activeKeys: number;
  /** Bytes per counter entry, including key, value, and TTL overhead. */
  bytesPerCounter: number;
  /** Atomic counter ops a single Redis node sustains per second. */
  redisOpsPerNode: number;
}

export interface RateLimiterCapacityResults {
  counterOpsPerSecond: number;
  counterMemoryGB: number;
  redisNodesForOps: number;
}

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting is
 * the presentation layer's job. Memory uses decimal GB (10^9 bytes), how cloud
 * memory is billed.
 */
export function calculateRateLimiterCapacity(
  a: RateLimiterCapacityAssumptions,
): RateLimiterCapacityResults {
  const counterOpsPerSecond = a.peakRequestsPerSecond * a.checksPerRequest;
  const counterMemoryGB = (a.activeKeys * a.bytesPerCounter) / 1e9;
  const redisNodesForOps = Math.ceil(counterOpsPerSecond / a.redisOpsPerNode);

  return { counterOpsPerSecond, counterMemoryGB, redisNodesForOps };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/rate-limiter-estimates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Extract the shared `CapacityTable`**

Move the presentational markup out of `capacity-model.tsx` into a new component.
This is the exact markup currently in `capacity-model.tsx`, parameterized over
pre-formatted rows.

```tsx
// components/learning/capacity-table.tsx
export interface AssumptionRow {
  label: string;
  value: string;
}

export interface ResultRow {
  label: string;
  value: string;
  consequence: string;
}

export function CapacityTable({
  assumptions,
  results,
}: {
  assumptions: AssumptionRow[];
  results: ResultRow[];
}) {
  return (
    <div className="not-prose my-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Assumptions
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {assumptions.map((row) => (
            <div key={row.label} className="flex flex-col">
              <dt className="text-xs text-ink-muted">{row.label}</dt>
              <dd className="font-mono text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((res) => (
          <div key={res.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-muted">{res.label}</p>
              <p className="font-mono text-lg font-semibold text-accent">{res.value}</p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {res.consequence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Reduce `CapacityModel` to a thin wrapper**

Replace the entire body of `components/learning/capacity-model.tsx` so it computes
its rows and renders `CapacityTable`. Its public props (`{ assumptions: CapacityAssumptions }`)
are unchanged, so `url-shortener.mdx` and its rendered output are untouched.

```tsx
// components/learning/capacity-model.tsx
import {
  calculateUrlShortenerCapacity,
  type CapacityAssumptions,
} from "@/lib/url-shortener-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CapacityModel({ assumptions }: { assumptions: CapacityAssumptions }) {
  const r = calculateUrlShortenerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New links / month", value: fmt(assumptions.newLinksPerMonth) },
    { label: "Read : write ratio", value: `${fmt(assumptions.readWriteRatio)}:1` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Bytes / mapping", value: `${fmt(assumptions.bytesPerMapping)} B` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
    { label: "Cache coverage", value: `${fmt(assumptions.cacheCoveragePercent)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Average write QPS", value: fmt(r.averageWriteQps), consequence: "Tiny. A single write node handles this — writes are never the bottleneck." },
    { label: "Average read QPS", value: fmt(r.averageReadQps), consequence: "Reads dominate by 100×. The redirect path is what we must scale and cache." },
    { label: "Peak read QPS", value: fmt(r.peakReadQps), consequence: "Provision for peak, not average. Drives cache sizing and replica count." },
    { label: "Total stored mappings", value: fmt(r.totalMappings), consequence: "Billions of rows over 5 years — too big for one node, so we partition." },
    { label: "Mapping storage", value: `${fmt(r.mappingStorageTB, 1)} TB`, consequence: "Modest for a sharded key-value store; metadata, not media, dominates." },
    { label: "Cache working set", value: `${fmt(r.cacheWorkingSetGB)} GB`, consequence: "Hot set fits in a distributed in-memory cache — most reads never touch disk." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

- [ ] **Step 7: Create the rate-limiter capacity wrapper**

```tsx
// components/learning/rate-limiter-capacity.tsx
import {
  calculateRateLimiterCapacity,
  type RateLimiterCapacityAssumptions,
} from "@/lib/rate-limiter-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function RateLimiterCapacity({
  assumptions,
}: {
  assumptions: RateLimiterCapacityAssumptions;
}) {
  const r = calculateRateLimiterCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Peak requests / sec", value: fmt(assumptions.peakRequestsPerSecond) },
    { label: "Checks / request", value: fmt(assumptions.checksPerRequest) },
    { label: "Active counter keys", value: fmt(assumptions.activeKeys) },
    { label: "Bytes / counter", value: `${fmt(assumptions.bytesPerCounter)} B` },
    { label: "Redis ops / node", value: fmt(assumptions.redisOpsPerNode) },
  ];

  const results: ResultRow[] = [
    { label: "Counter ops / sec", value: fmt(r.counterOpsPerSecond), consequence: "Every request is one atomic increment — this is the load the counter tier must absorb." },
    { label: "Counter memory", value: `${fmt(r.counterMemoryGB, 1)} GB`, consequence: "Counters are tiny; the whole working set fits in memory, so reads never touch disk." },
    { label: "Redis nodes (for ops)", value: fmt(r.redisNodesForOps), consequence: "Ops/sec, not memory, sizes the cluster — drives sharding by counter key." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

- [ ] **Step 8: Register `RateLimiterCapacity` in MDX**

In `mdx-components.tsx`, add the import and include it in `teachingComponents`:

```tsx
import { RateLimiterCapacity } from "@/components/learning/rate-limiter-capacity";
// ...
const teachingComponents = {
  // ...existing entries...
  RateLimiterCapacity,
};
```

- [ ] **Step 9: Verify nothing regressed and commit**

Run:
```bash
npm test -- tests/rate-limiter-estimates.test.ts tests/url-shortener-estimates.test.ts
npm run typecheck
npm run lint
```
Expected: all pass; the URL Shortener estimate test still passes unchanged.

```bash
git add lib/rate-limiter-estimates.ts tests/rate-limiter-estimates.test.ts \
  components/learning/capacity-table.tsx components/learning/capacity-model.tsx \
  components/learning/rate-limiter-capacity.tsx mdx-components.tsx
git commit -m "feat: add rate limiter capacity model and shared capacity table"
```

---

### Task 2: Interactive Algorithm Visualizer

A client component that teaches all five algorithms. It renders an accessible
static description (works with no JS) and progressively enhances into a
step-driven simulator: a "Send request" button advances the simulation and shows
whether each request is allowed or rejected and the current counter/token state.
Step-driven (not time-driven), so it inherently respects `prefers-reduced-motion`.

**Files:**
- Create: `components/diagrams/rate-limit-visualizer.tsx`
- Test: `tests/rate-limit-visualizer.test.tsx`
- Modify: `mdx-components.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RateLimitVisualizer({ algorithm })` where
  `algorithm: "fixed-window" | "sliding-window-log" | "sliding-window-counter" | "token-bucket" | "leaky-bucket"`, registered in MDX as `RateLimitVisualizer`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/rate-limit-visualizer.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RateLimitVisualizer } from "@/components/diagrams/rate-limit-visualizer";

describe("RateLimitVisualizer", () => {
  it("exposes the algorithm meaning to non-visual readers", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    expect(
      screen.getByRole("img", { name: /token bucket/i }),
    ).toBeInTheDocument();
  });

  it("renders a usable control and an initial state without interaction", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    expect(screen.getByRole("button", { name: /send request/i })).toBeEnabled();
    // The current allowance is shown before any interaction.
    expect(screen.getByTestId("rlv-status")).toHaveTextContent(/ready|allowed|tokens/i);
  });

  it("updates the simulation when a request is sent", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    const before = screen.getByTestId("rlv-status").textContent;
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    const after = screen.getByTestId("rlv-status").textContent;
    expect(after).not.toEqual(before);
  });

  it("can be reset", () => {
    render(<RateLimitVisualizer algorithm="fixed-window" />);
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByTestId("rlv-status")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/rate-limit-visualizer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the visualizer**

Build `components/diagrams/rate-limit-visualizer.tsx` as a `"use client"` component
meeting this contract (the implementer writes the full body; the structure and
rules below are exact):

- A pure, in-file reducer drives one config + simulation per algorithm, so behavior
  is deterministic and unit-testable through interaction. Fixed demo parameters:
  **limit/capacity = 5**, **window = 10 s**, **token refill = 1 token / 2 s**,
  **leaky-bucket leak = 1 / 2 s**. Each "Send request" advances a small fixed time
  step (e.g. +2 s) and submits one request.
- Per-algorithm rules:
  - **fixed-window** — count resets to 0 at each 10 s boundary; allow while count < 5; show the count and the window boundary.
  - **sliding-window-log** — keep request timestamps in the trailing 10 s; allow while the log size < 5; show the log fill.
  - **sliding-window-counter** — weighted sum of the previous and current fixed window by elapsed fraction; allow while the estimate < 5; show the estimate.
  - **token-bucket** — start full at 5 tokens; refill 1 token / 2 s up to capacity; allow if ≥ 1 token, then decrement; show token count.
  - **leaky-bucket** — queue of capacity 5 that leaks 1 / 2 s; allow if there is room after leaking; show queue depth.
- Rendering:
  - The visual layer is an SVG with `role="img"` and an `aria-label` that names the
    algorithm (e.g. `"Token bucket rate limiter"`), wrapped so it scales to width
    and respects the existing diagram styling. It shows the current state (filled
    vs empty slots / tokens / queue cells).
  - A `data-testid="rlv-status"` live region (`aria-live="polite"`) renders a text
    sentence describing the latest outcome and current allowance — meaningful before
    any click (initial state) and updated on each step.
  - Controls: a "Send request" button and a "Reset" button, both keyboard-focusable
    with visible focus, labeled via accessible names.
- No `setInterval`/auto-animation; all motion is user-driven, so reduced-motion
  needs no special-casing. Any CSS transitions on state change must be disabled
  under `prefers-reduced-motion` (the global stylesheet already gates transitions).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/rate-limit-visualizer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Register `RateLimitVisualizer` in MDX**

In `mdx-components.tsx`, add the import and the entry to `teachingComponents`:

```tsx
import { RateLimitVisualizer } from "@/components/diagrams/rate-limit-visualizer";
// ...
const teachingComponents = {
  // ...existing entries...
  RateLimitVisualizer,
};
```

- [ ] **Step 6: Verify and commit**

Run:
```bash
npm test -- tests/rate-limit-visualizer.test.tsx
npm run typecheck
npm run lint
```
Expected: all pass.

```bash
git add components/diagrams/rate-limit-visualizer.tsx tests/rate-limit-visualizer.test.tsx mdx-components.tsx
git commit -m "feat: add interactive rate limit algorithm visualizer"
```

---

### Task 3: Architecture and Flow Diagrams

Two static SVG diagram components built from the existing primitives in
`components/diagrams/diagram-primitives.tsx` and framed by `DiagramFrame`.

**Files:**
- Create: `components/diagrams/rate-limiter-architecture.tsx`
- Create: `components/diagrams/rate-limit-flows.tsx`
- Modify: `tests/diagrams.test.tsx`
- Modify: `mdx-components.tsx`

**Interfaces:**
- Consumes: `DiagramFrame`, `DiagramDefs`, `DiagramText`, `Edge`, `Node`, `Legend`, `anchors`, `NodeGeom` from the diagram modules.
- Produces:
  - `RateLimiterArchitecture()` from `rate-limiter-architecture.tsx`.
  - `AllowSequence()`, `ThrottleSequence()`, `FailOpenSequence()` from `rate-limit-flows.tsx`.
  - All registered in MDX under those names.

- [ ] **Step 1: Write the failing diagram tests**

Append to `tests/diagrams.test.tsx`:

```tsx
import { RateLimiterArchitecture } from "@/components/diagrams/rate-limiter-architecture";
import {
  AllowSequence,
  ThrottleSequence,
  FailOpenSequence,
} from "@/components/diagrams/rate-limit-flows";

describe("RateLimiterArchitecture", () => {
  it("exposes the limiter architecture to non-visual readers", () => {
    render(<RateLimiterArchitecture />);
    expect(
      screen.getByRole("img", { name: /rate limiter architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/fail open/i)).toBeInTheDocument();
  });
});

describe("rate limit flow sequences", () => {
  it("renders the allow, throttle, and fail-open sequences", () => {
    render(<AllowSequence />);
    expect(screen.getByRole("img", { name: /allow/i })).toBeInTheDocument();
    render(<ThrottleSequence />);
    expect(screen.getByRole("img", { name: /throttle|429/i })).toBeInTheDocument();
    render(<FailOpenSequence />);
    expect(screen.getByRole("img", { name: /fail.?open/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/diagrams.test.tsx`
Expected: FAIL — new modules do not exist.

- [ ] **Step 3: Implement the architecture diagram**

Create `components/diagrams/rate-limiter-architecture.tsx` following the exact
pattern of `architecture-diagram.tsx` (a `const N` node-geometry map, `DiagramFrame`
with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before nodes, a `Legend`).
The diagram must show: `Client → API Gateway → Limiter middleware`, the limiter
calling a `Counter Store (Redis)` for an atomic increment, the **fail-open** edge
(a `control`-variant dashed edge labeled "fail open" from the limiter to the
upstream service when the store is unreachable), and the allowed request continuing
to `Backend Service`. The `title` must contain "Rate limiter architecture" and the
`caption` must contain the phrase "fail open" and explain the atomic-increment and
fallback behavior in prose.

- [ ] **Step 4: Implement the flow sequences**

Create `components/diagrams/rate-limit-flows.tsx` exporting three components, each a
`DiagramFrame`-wrapped SVG sequence (mirror the structure of
`components/diagrams/request-flow-diagrams.tsx`). Each `title` contains the keyword
the test matches:
- `AllowSequence` — title contains "allow"; shows gateway → limiter `INCR` → under
  limit → `200 OK` with `X-RateLimit-Remaining`.
- `ThrottleSequence` — title contains "throttle" or "429"; shows `INCR` → over limit
  → `429 Too Many Requests` with `Retry-After`.
- `FailOpenSequence` — title contains "fail open"; shows the counter store timing
  out and the limiter allowing the request (fail-open) while emitting an alert.

- [ ] **Step 5: Register the diagrams in MDX**

In `mdx-components.tsx`, import and add to `teachingComponents`:
`RateLimiterArchitecture`, `AllowSequence`, `ThrottleSequence`, `FailOpenSequence`.

- [ ] **Step 6: Verify and commit**

Run:
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck
npm run lint
```
Expected: all pass.

```bash
git add components/diagrams/rate-limiter-architecture.tsx components/diagrams/rate-limit-flows.tsx \
  tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add rate limiter architecture and flow diagrams"
```

---

### Task 4: Registry, Curriculum Wiring, Route, and Content Skeleton

Register the tutorial, flip its curriculum status, wire the route, and add a
compiling MDX skeleton with all 15 section ids. Update the two existing tests that
assert "only URL Shortener" so they reflect two tutorials. This task ends with the
route building and statically generating.

**Files:**
- Modify: `lib/tutorial-registry.ts`
- Modify: `lib/curriculum.ts`
- Modify: `tests/tutorial-registry.test.ts`
- Modify: `tests/curriculum.test.ts`
- Modify: `app/learn/[slug]/page.tsx`
- Create: `content/tutorials/rate-limiter.mdx` (skeleton)

**Interfaces:**
- Consumes: `TutorialMeta`/`TutorialSection` types, `Problem` types.
- Produces: `getTutorial("rate-limiter")` returns a 15-section meta; `/learn/rate-limiter` statically generated.

- [ ] **Step 1: Update the registry test for two tutorials**

Replace the first two `it` blocks in `tests/tutorial-registry.test.ts`:

```ts
it("registers the URL Shortener and Rate Limiter tutorials", () => {
  expect(Object.keys(tutorials).sort()).toEqual(["rate-limiter", "url-shortener"]);
});

it("describes the URL Shortener's eighteen sections and the Rate Limiter's fifteen", () => {
  expect(getTutorial("url-shortener")?.sections).toHaveLength(18);
  expect(getTutorial("rate-limiter")?.sections).toHaveLength(15);
});
```

Delete the now-incorrect `it("returns undefined for unavailable tutorials", ...)`
block that uses `rate-limiter`; replace it with a still-unavailable slug:

```ts
it("returns undefined for unregistered tutorials", () => {
  expect(getTutorial("pastebin")).toBeUndefined();
});
```

- [ ] **Step 2: Update the curriculum test for two available problems**

Replace the `"only exposes URL Shortener as available"` block in
`tests/curriculum.test.ts`:

```ts
it("exposes URL Shortener and Rate Limiter as available", () => {
  expect(
    problems.filter((p) => p.status === "available").map((p) => p.slug),
  ).toEqual(["url-shortener", "rate-limiter"]);
  expect(getProblem("rate-limiter")?.title).toBe("Rate Limiter");
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts`
Expected: FAIL — registry has one tutorial; `rate-limiter` is still `coming-soon`.

- [ ] **Step 4: Flip the curriculum status**

In `lib/curriculum.ts`, change the `rate-limiter` entry's `status` from
`"coming-soon"` to `"available"`. (Leave its sequence, summary, and concepts.)

- [ ] **Step 5: Add the registry entry**

In `lib/tutorial-registry.ts`, add a `"rate-limiter"` key to `tutorials` with these
exact sections (ids must match the MDX and the content test):

```ts
"rate-limiter": {
  slug: "rate-limiter",
  title: "Design a Rate Limiter",
  description:
    "An algorithm-first, interview-grade walkthrough of a distributed rate limiter: the five classic algorithms, limit policies, the allow/throttle API, distributed counting, consistency, scaling, and failure modes.",
  difficulty: "Foundational",
  readingMinutes: 30,
  concepts: ["Token bucket", "Sliding window", "Distributed counters", "Fail-open"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "limit-policies", label: "Limit Policies & Keys", depth: "interview-ready" },
    { id: "algorithms", label: "Algorithms", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "distributed-counting", label: "Distributed Counting", depth: "advanced" },
    { id: "consistency-races", label: "Consistency & Races", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "observability", label: "Observability", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

- [ ] **Step 6: Wire the route**

In `app/learn/[slug]/page.tsx`, add the import and content map entry:

```tsx
import RateLimiterContent from "@/content/tutorials/rate-limiter.mdx";
// ...
const content: Record<string, ComponentType> = {
  "url-shortener": UrlShortenerContent,
  "rate-limiter": RateLimiterContent,
};
```

- [ ] **Step 7: Create the compiling MDX skeleton**

Create `content/tutorials/rate-limiter.mdx` with all 15 `h2` headings in order, each
with one placeholder sentence. This establishes the route; Tasks 5–6 replace the
body. Example (repeat the pattern for every id in the registry list above):

```mdx
<h2 id="interview-framing">Interview Framing</h2>

A rate limiter caps how many requests a client may make in a time window. _(Full content in Task 5.)_

<h2 id="requirements">Requirements</h2>

We separate functional behavior from non-functional targets. _(Full content in Task 5.)_
```

- [ ] **Step 8: Verify route builds and commit**

Run:
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck
npm run build
```
Expected: tests pass; build statically generates `/learn/rate-limiter` alongside `/learn/url-shortener`.

```bash
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts \
  tests/curriculum.test.ts app/learn/[slug]/page.tsx content/tutorials/rate-limiter.mdx
git commit -m "feat: register rate limiter tutorial route and skeleton"
```

---

### Task 5: Author Content — Sections 1–7 (Framing through Architecture)

Replace the skeleton's first seven sections with complete, technically consistent
content, embedding the components from Tasks 1–3. Verification is via the
production build (the MDX must compile with the real embeds); the structural
content test is authored in Task 6 once the knowledge checks and FAQ exist, so this
task ends green.

**Files:**
- Modify: `content/tutorials/rate-limiter.mdx` (sections 1–7)

**Interfaces:**
- Consumes: `Callout`, `RequirementsTable`, `EntityModel`, `TradeoffTable`, `ApiContract`, `RateLimitVisualizer`, `RateLimiterCapacity`, `RateLimiterArchitecture` (all registered in MDX).
- Produces: the authored front half of the tutorial.

- [ ] **Step 1: Author sections 1–7**

Write the content, keeping every number internally consistent. Required embeds and substance:

- **`interview-framing`** — what/why/where rate limiting sits; a `Callout variant="interview"` with a 45-minute time allocation; an explicit in-scope/out-of-scope statement (out: DDoS at L3/L4, WAF, billing dashboards).
- **`requirements`** — a `RequirementsTable` with functional items (enforce N/window/key, named policies, tiered limits, return remaining quota, disable a policy) and non-functional targets: **enforcement overhead p99 < 1 ms**, **availability 99.99%**, **accuracy tolerance ±1 request**, **fail-open default**, **horizontal scalability**.
- **`limit-policies`** — an `EntityModel name="RateLimitPolicy"` (fields: `name`, `limit`, `window_seconds`, `algorithm`, `scope`) and prose on the composite counter key (policy + identity dimension: user / IP / API-key / global) and tiered plans; note that key cardinality drives capacity.
- **`algorithms`** — the centerpiece. One `<RateLimitVisualizer algorithm="..." />` for each of the five algorithms (`fixed-window`, `sliding-window-log`, `sliding-window-counter`, `token-bucket`, `leaky-bucket`), each with a paragraph on mechanism, memory cost, and burst behavior. Close with a `TradeoffTable` comparing the five across {Algorithm, Memory, Burst handling, Accuracy, Best for} and `recommendedRow` pointing at token bucket. State the **fixed-window 2× boundary-burst** problem and that the **sliding window counter** mitigates it.
- **`capacity-estimates`** — a `RateLimiterCapacity` embed with assumptions `{ peakRequestsPerSecond: 1000000, checksPerRequest: 1, activeKeys: 50000000, bytesPerCounter: 80, redisOpsPerNode: 100000 }`, then a paragraph reading off the three results and their consequences (ops/sec sizes the cluster; counters are tiny; shard by key).
- **`api-design`** — at least two `ApiContract` blocks: the synchronous check (e.g. `POST /v1/ratelimit/check`) returning allow/deny with `X-RateLimit-Limit`/`-Remaining`/`-Reset`, and the throttled response documenting `429 Too Many Requests` + `Retry-After`. Note the per-request network hop cost and that a sidecar avoids it.
- **`high-level-architecture`** — a `RateLimiterArchitecture` embed, then prose on component responsibilities and the enforcement point (gateway middleware vs sidecar) and the central counter store boundary.

- [ ] **Step 2: Verify the front half compiles**

Run:
```bash
npm run build
npm test
```
Expected: the MDX compiles in the production build with the real embeds; the full existing test suite still passes (no content test yet — it arrives in Task 6).

- [ ] **Step 3: Commit**

```bash
git add content/tutorials/rate-limiter.mdx
git commit -m "content: author rate limiter sections 1-7"
```

---

### Task 6: Author Content — Sections 8–15 (Deep Dives through FAQ)

Complete the tutorial: distributed counting, consistency, scaling, failure modes,
observability, trade-offs, the interview summary, and the knowledge-checks/FAQ
section. This task makes the full content test pass.

**Files:**
- Modify: `content/tutorials/rate-limiter.mdx` (sections 8–15)
- Create: `tests/rate-limiter-content.test.ts`

**Interfaces:**
- Consumes: `AllowSequence`, `ThrottleSequence`, `FailOpenSequence`, `FailureMatrix`, `DecisionRecord`, `KnowledgeCheck`, `Faq`, `Callout`.
- Produces: the complete tutorial and its structural content test.

- [ ] **Step 1: Author sections 8–15**

- **`distributed-counting`** — embed `AllowSequence` and `ThrottleSequence`; explain centralized Redis `INCR`+TTL (atomic, single op / Lua script) vs local counters synced out-of-band; exact vs approximate counting; why naive read-modify-write races.
- **`consistency-races`** — atomic increment, the fixed-window boundary burst (≤ 2× limit) and the sliding-window-counter mitigation, clock skew between nodes, TTL/window alignment.
- **`scalability-evolution`** — four stages (single-node in-memory → centralized Redis → sharded Redis by key → local-token + global-reconciliation hybrid), with the trigger and cost at each stage. Use a `TradeoffTable` (columns {Stage, Trigger, Cost}) for the four stages.
- **`resiliency-failure-modes`** — embed `FailOpenSequence`; a `FailureMatrix` with at least six rows (counter-store outage with explicit fail-open vs fail-closed, hot key, thundering herd on reset, network partition, clock skew, node loss), each with impact/detection/mitigation/recovery.
- **`observability`** — SLIs/SLOs, allowed vs throttled counters, per-policy and per-key cardinality concerns, alert on throttle-rate spikes.
- **`tradeoffs-alternatives`** — a `DecisionRecord` capturing the token-bucket + sliding-window-counter + fail-open decision (choice / rationale / alternatives / revisit-when), plus prose on accuracy-vs-cost, centralized-vs-distributed, sync-vs-sidecar.
- **`interview-summary`** — a concise spoken answer and likely follow-up prompts (a `Callout` is appropriate).
- **`knowledge-checks-faq`** — **at least six** `<KnowledgeCheck>` (each with `question`, `options`, `answer`, `explanation`) and a single `<Faq items={[...]} />` with **at least twelve** `{ question, answer }` entries.

- [ ] **Step 2: Numerical and terminology review**

Confirm these invariants across prose, tables, and diagrams before testing:
- Stated peak RPS matches the `RateLimiterCapacity` assumptions and the counter-ops result.
- Fixed window admits up to **2× the limit** across a boundary; the sliding window counter is named as the mitigation.
- Token bucket is the recommended default (burst tolerance); leaky bucket gives a smooth/constant outflow.
- Counter increments are **atomic** (single op / Lua), never read-modify-write.
- The default posture is **fail-open**, stated with its risk; `429` carries `Retry-After`; responses expose `X-RateLimit-*` headers.

- [ ] **Step 3: Write the structural content test**

```ts
// tests/rate-limiter-content.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/rate-limiter.mdx", "utf8");

const requiredIds = [
  "interview-framing", "requirements", "limit-policies", "algorithms",
  "capacity-estimates", "api-design", "high-level-architecture",
  "distributed-counting", "consistency-races", "scalability-evolution",
  "resiliency-failure-modes", "observability", "tradeoffs-alternatives",
  "interview-summary", "knowledge-checks-faq",
];

describe("Rate Limiter content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the visualizer, capacity model, and architecture diagram", () => {
    for (const tag of [
      "<RateLimitVisualizer",
      "<RateLimiterCapacity",
      "<RateLimiterArchitecture",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds the flow sequence diagrams", () => {
    for (const tag of ["<AllowSequence", "<ThrottleSequence", "<FailOpenSequence"]) {
      expect(content).toContain(tag);
    }
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 4: Verify the full content test and build**

Run:
```bash
npm test -- tests/rate-limiter-content.test.ts
npm run build
```
Expected: all content assertions pass (≥ 6 knowledge checks, ≥ 12 FAQ); MDX compiles in production.

- [ ] **Step 5: Commit**

```bash
git add content/tutorials/rate-limiter.mdx tests/rate-limiter-content.test.ts
git commit -m "content: complete rate limiter tutorial"
```

---

### Task 7: End-to-End Flow and Final Verification

Extend the Playwright suite to cover the rate-limiter path, fix the curriculum
"Coming soon" count (now 23), and run the full verification suite.

**Files:**
- Modify: `e2e/pilot.spec.ts`
- Modify: any component only if browser verification exposes a real defect

**Interfaces:**
- Consumes: the complete application.
- Produces: browser-level verification of the rate-limiter tutorial.

- [ ] **Step 1: Update the curriculum count and add the rate-limiter flow**

In `e2e/pilot.spec.ts`, update the existing curriculum assertion from 24 to 23
"Coming soon" items (two tutorials are now available), and add a test:

```ts
test("learner can open the rate limiter tutorial and use the visualizer", async ({ page }) => {
  await page.goto("/learn/rate-limiter");
  await expect(
    page.getByRole("heading", { name: /design a rate limiter/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^algorithms$/i }).click();
  await expect(page.locator("#algorithms")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /token bucket/i }).first(),
  ).toBeVisible();
  // The visualizer responds to interaction.
  await page.getByRole("button", { name: /send request/i }).first().click();
  await expect(page.getByTestId("rlv-status").first()).toBeVisible();
});
```

If the TOC link text differs from `Algorithms`, match the actual label rendered by
`TutorialLayout` (check the registry `label`). Adjust the selector, not the content.

- [ ] **Step 2: Run the e2e suite and inspect failures**

Run:
```bash
npm run test:e2e
```
Expected: the new test passes on desktop and mobile; the updated count test passes.
Fix only genuine defects the browser reveals (overflow at 390 px, anchors hidden by
sticky header, invisible focus, unreadable dark-mode diagram labels).

- [ ] **Step 3: Run the full verification suite**

Run:
```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```
Expected: all unit + content tests pass, zero TS/ESLint errors, production build
completes with `/learn/rate-limiter` statically generated, both browser projects
pass, no whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add e2e/pilot.spec.ts app components
git commit -m "test: verify rate limiter tutorial flow end-to-end"
```

---

## Notes for the Implementer

- **Read `content/tutorials/url-shortener.mdx` first.** It is the canonical example
  of voice, depth, and how every component is used in MDX. Match its altitude.
- **Diagram primitives are fixed vocabulary.** Build new diagrams from `Node`,
  `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame` — do not
  invent new SVG conventions. Edge variants: `create` (accent), `redirect` (green),
  `async` (violet dashed), `control` (amber dashed), `muted` (telemetry dotted),
  `ingress` (plain). Use `control` for the fail-open edge.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an
  accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match the
  values asserted in `tests/rate-limiter-estimates.test.ts`.
```
