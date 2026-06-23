"use client";

import { useReducer } from "react";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type Algorithm =
  | "fixed-window"
  | "sliding-window-log"
  | "sliding-window-counter"
  | "token-bucket"
  | "leaky-bucket";

// Fixed demo parameters (per brief)
const LIMIT = 5;
const WINDOW = 10; // seconds
const REFILL_RATE = 0.5; // tokens per second (1 per 2s)
const LEAK_RATE = 0.5; // per second (1 per 2s)
const TIME_STEP = 2; // seconds per "Send request" click

/* ------------------------------------------------------------------ *
 * Per-algorithm simulation state shapes
 * ------------------------------------------------------------------ */

interface FixedWindowState {
  kind: "fixed-window";
  time: number;
  windowStart: number;
  count: number;
  lastOutcome: "ready" | "allowed" | "rejected";
}

interface SlidingWindowLogState {
  kind: "sliding-window-log";
  time: number;
  log: number[]; // timestamps of requests within the trailing window
  lastOutcome: "ready" | "allowed" | "rejected";
}

interface SlidingWindowCounterState {
  kind: "sliding-window-counter";
  time: number;
  prevCount: number; // requests in the previous window
  currCount: number; // requests in the current window
  windowStart: number;
  lastOutcome: "ready" | "allowed" | "rejected";
}

interface TokenBucketState {
  kind: "token-bucket";
  time: number;
  tokens: number; // current token count (float for refill precision)
  lastOutcome: "ready" | "allowed" | "rejected";
}

interface LeakyBucketState {
  kind: "leaky-bucket";
  time: number;
  queue: number; // current queue depth
  lastOutcome: "ready" | "allowed" | "rejected";
}

type SimState =
  | FixedWindowState
  | SlidingWindowLogState
  | SlidingWindowCounterState
  | TokenBucketState
  | LeakyBucketState;

/* ------------------------------------------------------------------ *
 * Initial states
 * ------------------------------------------------------------------ */

function initialState(algorithm: Algorithm): SimState {
  switch (algorithm) {
    case "fixed-window":
      return { kind: "fixed-window", time: 0, windowStart: 0, count: 0, lastOutcome: "ready" };
    case "sliding-window-log":
      return { kind: "sliding-window-log", time: 0, log: [], lastOutcome: "ready" };
    case "sliding-window-counter":
      return { kind: "sliding-window-counter", time: 0, prevCount: 0, currCount: 0, windowStart: 0, lastOutcome: "ready" };
    case "token-bucket":
      return { kind: "token-bucket", time: 0, tokens: LIMIT, lastOutcome: "ready" };
    case "leaky-bucket":
      return { kind: "leaky-bucket", time: 0, queue: 0, lastOutcome: "ready" };
  }
}

/* ------------------------------------------------------------------ *
 * Reducer — pure simulation step
 * ------------------------------------------------------------------ */

type Action = { type: "SEND" } | { type: "RESET" };

function reducer(state: SimState, action: Action): SimState {
  if (action.type === "RESET") {
    return initialState(state.kind);
  }

  // SEND: advance time by TIME_STEP then process one request
  const newTime = state.time + TIME_STEP;

  switch (state.kind) {
    case "fixed-window": {
      // Check if we've crossed a window boundary
      const elapsed = newTime - state.windowStart;
      const windowsElapsed = Math.floor(elapsed / WINDOW);
      const windowStart = state.windowStart + windowsElapsed * WINDOW;
      const count = windowsElapsed > 0 ? 0 : state.count;
      // Allow if count < LIMIT
      const allowed = count < LIMIT;
      return {
        ...state,
        time: newTime,
        windowStart,
        count: allowed ? count + 1 : count,
        lastOutcome: allowed ? "allowed" : "rejected",
      };
    }

    case "sliding-window-log": {
      // Keep only timestamps within the trailing WINDOW seconds
      const windowStart = newTime - WINDOW;
      const log = state.log.filter((t) => t > windowStart);
      const allowed = log.length < LIMIT;
      return {
        ...state,
        time: newTime,
        log: allowed ? [...log, newTime] : log,
        lastOutcome: allowed ? "allowed" : "rejected",
      };
    }

    case "sliding-window-counter": {
      // Advance window if needed
      const elapsed = newTime - state.windowStart;
      const windowsElapsed = Math.floor(elapsed / WINDOW);
      let windowStart = state.windowStart;
      let prevCount = state.prevCount;
      let currCount = state.currCount;

      if (windowsElapsed >= 2) {
        // Both windows expired
        windowStart = state.windowStart + windowsElapsed * WINDOW;
        prevCount = 0;
        currCount = 0;
      } else if (windowsElapsed === 1) {
        // Rolled into a new window
        windowStart = state.windowStart + WINDOW;
        prevCount = state.currCount;
        currCount = 0;
      }

      // Fraction of current window elapsed
      const fraction = (newTime - windowStart) / WINDOW;
      // Weighted estimate = prev * (1 - fraction) + curr
      const estimate = prevCount * (1 - fraction) + currCount;
      const allowed = estimate < LIMIT;
      return {
        ...state,
        time: newTime,
        windowStart,
        prevCount,
        currCount: allowed ? currCount + 1 : currCount,
        lastOutcome: allowed ? "allowed" : "rejected",
      };
    }

    case "token-bucket": {
      // Refill tokens based on elapsed time
      const elapsed = TIME_STEP;
      const refilled = Math.min(LIMIT, state.tokens + elapsed * REFILL_RATE);
      const allowed = refilled >= 1;
      return {
        ...state,
        time: newTime,
        tokens: allowed ? refilled - 1 : refilled,
        lastOutcome: allowed ? "allowed" : "rejected",
      };
    }

    case "leaky-bucket": {
      // Leak tokens based on elapsed time
      const leaked = Math.floor(TIME_STEP * LEAK_RATE);
      const queue = Math.max(0, state.queue - leaked);
      // Allow if there is room
      const allowed = queue < LIMIT;
      return {
        ...state,
        time: newTime,
        queue: allowed ? queue + 1 : queue,
        lastOutcome: allowed ? "allowed" : "rejected",
      };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Algorithm metadata
 * ------------------------------------------------------------------ */

const ALGO_META: Record<
  Algorithm,
  { label: string; description: string }
> = {
  "fixed-window": {
    label: "Fixed window rate limiter",
    description:
      "Counts requests in a fixed time window. The counter resets to zero at each window boundary.",
  },
  "sliding-window-log": {
    label: "Sliding window log rate limiter",
    description:
      "Keeps a timestamp log of recent requests. Allows up to the limit within any trailing window.",
  },
  "sliding-window-counter": {
    label: "Sliding window counter rate limiter",
    description:
      "Estimates the request rate by combining the previous and current fixed-window counts weighted by elapsed fraction.",
  },
  "token-bucket": {
    label: "Token bucket rate limiter",
    description:
      "Tokens accumulate at a fixed rate up to capacity. Each request consumes one token; requests without tokens are rejected.",
  },
  "leaky-bucket": {
    label: "Leaky bucket rate limiter",
    description:
      "Requests enter a bounded queue that drains at a fixed rate. New requests are rejected when the queue is full.",
  },
};

/* ------------------------------------------------------------------ *
 * Status text helpers
 * ------------------------------------------------------------------ */

function statusText(state: SimState): string {
  switch (state.kind) {
    case "fixed-window": {
      const windowEnd = state.windowStart + WINDOW;
      if (state.lastOutcome === "ready")
        return `Ready — ${state.count}/${LIMIT} requests in window (resets at t=${windowEnd}s).`;
      if (state.lastOutcome === "allowed")
        return `Allowed — ${state.count}/${LIMIT} requests in window (resets at t=${windowEnd}s).`;
      return `Rejected — window full at ${state.count}/${LIMIT} requests (resets at t=${windowEnd}s).`;
    }
    case "sliding-window-log": {
      const fill = state.log.length;
      if (state.lastOutcome === "ready") return `Ready — log has ${fill}/${LIMIT} entries in the trailing ${WINDOW}s.`;
      if (state.lastOutcome === "allowed") return `Allowed — log has ${fill}/${LIMIT} entries in the trailing ${WINDOW}s.`;
      return `Rejected — log is full at ${fill}/${LIMIT} entries.`;
    }
    case "sliding-window-counter": {
      const fraction = Math.max(
        0,
        Math.min(1, (state.time - state.windowStart) / WINDOW),
      );
      const estimate =
        state.prevCount * (1 - fraction) + state.currCount;
      const est = estimate.toFixed(1);
      if (state.lastOutcome === "ready") return `Ready — estimated rate: ${est}/${LIMIT}.`;
      if (state.lastOutcome === "allowed") return `Allowed — estimated rate: ${est}/${LIMIT}.`;
      return `Rejected — estimated rate ${est} reaches limit of ${LIMIT}.`;
    }
    case "token-bucket": {
      const t = state.tokens.toFixed(1);
      if (state.lastOutcome === "ready") return `Ready — ${t}/${LIMIT} tokens available.`;
      if (state.lastOutcome === "allowed") return `Allowed — ${t}/${LIMIT} tokens remaining.`;
      return `Rejected — bucket empty (${t}/${LIMIT} tokens).`;
    }
    case "leaky-bucket": {
      if (state.lastOutcome === "ready") return `Ready — queue has ${state.queue}/${LIMIT} items.`;
      if (state.lastOutcome === "allowed") return `Allowed — queue has ${state.queue}/${LIMIT} items.`;
      return `Rejected — queue full at ${state.queue}/${LIMIT} items.`;
    }
  }
}

/* ------------------------------------------------------------------ *
 * SVG visualizations — one per algorithm
 * ------------------------------------------------------------------ */

const SLOT_W = 36;
const SLOT_H = 36;
const SLOT_GAP = 8;
const SVG_W = 460;
const SVG_H = 140;

/** Renders LIMIT slot cells, filling `filled` of them. */
function SlotRow({
  filled,
  fillColor,
  label,
  offsetY = 48,
}: {
  filled: number;
  fillColor: string;
  label: string;
  offsetY?: number;
}) {
  const totalW = LIMIT * SLOT_W + (LIMIT - 1) * SLOT_GAP;
  const startX = (SVG_W - totalW) / 2;
  return (
    <>
      <text
        x={SVG_W / 2}
        y={offsetY - 10}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-muted)", fontSize: 11 }}
      >
        {label}
      </text>
      {Array.from({ length: LIMIT }).map((_, i) => {
        const x = startX + i * (SLOT_W + SLOT_GAP);
        const isFilled = i < filled;
        return (
          <rect
            key={i}
            x={x}
            y={offsetY}
            width={SLOT_W}
            height={SLOT_H}
            rx={6}
            fill={isFilled ? fillColor : "var(--surface-2)"}
            stroke={isFilled ? fillColor : "var(--border)"}
            strokeWidth={1.5}
          />
        );
      })}
    </>
  );
}

function FixedWindowViz({ state }: { state: FixedWindowState }) {
  return (
    <>
      <SlotRow
        filled={state.count}
        fillColor="var(--accent)"
        label={`Window requests: ${state.count}/${LIMIT}`}
      />
      <text
        x={SVG_W / 2}
        y={110}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-faint)", fontSize: 10.5 }}
      >
        {`t=${state.time}s — window [${state.windowStart}s, ${state.windowStart + WINDOW}s)`}
      </text>
    </>
  );
}

function SlidingWindowLogViz({ state }: { state: SlidingWindowLogState }) {
  const fill = state.log.length;
  return (
    <>
      <SlotRow
        filled={fill}
        fillColor="var(--accent)"
        label={`Log entries in trailing ${WINDOW}s: ${fill}/${LIMIT}`}
      />
      <text
        x={SVG_W / 2}
        y={110}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-faint)", fontSize: 10.5 }}
      >
        {`t=${state.time}s — tracking window [${Math.max(0, state.time - WINDOW)}s, ${state.time}s]`}
      </text>
    </>
  );
}

function SlidingWindowCounterViz({ state }: { state: SlidingWindowCounterState }) {
  const fraction = Math.max(
    0,
    Math.min(1, (state.time - state.windowStart) / WINDOW),
  );
  const estimate = state.prevCount * (1 - fraction) + state.currCount;
  const filled = Math.min(LIMIT, Math.round(estimate));
  return (
    <>
      <SlotRow
        filled={filled}
        fillColor="var(--accent)"
        label={`Estimated rate: ${estimate.toFixed(1)}/${LIMIT}`}
      />
      <text
        x={SVG_W / 2}
        y={110}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-faint)", fontSize: 10.5 }}
      >
        {`t=${state.time}s — prev=${state.prevCount} cur=${state.currCount} frac=${fraction.toFixed(2)}`}
      </text>
    </>
  );
}

function TokenBucketViz({ state }: { state: TokenBucketState }) {
  const filled = Math.floor(state.tokens);
  return (
    <>
      <SlotRow
        filled={filled}
        fillColor="var(--success)"
        label={`Tokens: ${state.tokens.toFixed(1)}/${LIMIT}`}
      />
      <text
        x={SVG_W / 2}
        y={110}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-faint)", fontSize: 10.5 }}
      >
        {`t=${state.time}s — refill rate: 1 token / 2s`}
      </text>
    </>
  );
}

function LeakyBucketViz({ state }: { state: LeakyBucketState }) {
  return (
    <>
      <SlotRow
        filled={state.queue}
        fillColor="var(--warning)"
        label={`Queue depth: ${state.queue}/${LIMIT}`}
      />
      <text
        x={SVG_W / 2}
        y={110}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink-faint)", fontSize: 10.5 }}
      >
        {`t=${state.time}s — leak rate: 1 item / 2s`}
      </text>
    </>
  );
}

function AlgorithmViz({ state }: { state: SimState }) {
  switch (state.kind) {
    case "fixed-window":
      return <FixedWindowViz state={state} />;
    case "sliding-window-log":
      return <SlidingWindowLogViz state={state} />;
    case "sliding-window-counter":
      return <SlidingWindowCounterViz state={state} />;
    case "token-bucket":
      return <TokenBucketViz state={state} />;
    case "leaky-bucket":
      return <LeakyBucketViz state={state} />;
  }
}

/* ------------------------------------------------------------------ *
 * Main component
 * ------------------------------------------------------------------ */

export function RateLimitVisualizer({ algorithm }: { algorithm: Algorithm }) {
  const meta = ALGO_META[algorithm];
  const [state, dispatch] = useReducer(reducer, algorithm, initialState);

  const outcomeColor =
    state.lastOutcome === "allowed"
      ? "var(--success)"
      : state.lastOutcome === "rejected"
        ? "var(--danger)"
        : "var(--ink-muted)";

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-5">
      {/* Header */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Interactive simulation
      </p>
      <p className="mb-4 text-sm text-ink-muted">{meta.description}</p>

      {/* SVG visualization */}
      <div className="overflow-x-auto rounded-lg border border-border bg-canvas p-2">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label={meta.label}
          className="h-auto w-full"
          style={{ minWidth: 280 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{meta.label}</title>
          <AlgorithmViz state={state} />
        </svg>
      </div>

      {/* Status live region */}
      <p
        data-testid="rlv-status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 rounded-lg border px-4 py-2.5 text-sm font-medium"
        style={{
          borderColor: outcomeColor,
          color: outcomeColor,
        }}
      >
        {statusText(state)}
      </p>

      {/* Controls */}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => dispatch({ type: "SEND" })}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Send request
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "RESET" })}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Reset
        </button>
      </div>

      {/* Static description for no-JS environments */}
      <noscript>
        <p className="mt-3 text-sm text-ink-muted">
          {`${meta.label}: limit=${LIMIT} requests per ${WINDOW}s window. JavaScript required for interactive simulation.`}
        </p>
      </noscript>
    </div>
  );
}
