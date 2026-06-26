# API Gateway Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the fourteenth complete curriculum tutorial — an Intermediate, edge/control-point
walkthrough of an **API Gateway**: the request lifecycle / filter chain, routing & service
discovery, edge authentication & authorization, rate limiting & quotas, the control-plane/data-plane
split (the centerpiece), and resilience & observability — reusing the existing tutorial
infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the
first thirteen tutorials. New work is a pure capacity module + wrapper, one architecture SVG
diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The
distinguishing themes are the **filter/middleware chain**, **stateless horizontal scale**, the
**control plane vs data plane** split, **edge auth**, **rate limiting**, and **resilience/
observability**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest
4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the thirteen existing tutorials.
- Invariants: the gateway is on the **critical path of every request**, running an ordered **filter chain** (authN → authZ → rate-limit → transform → route → forward) and **short-circuiting** rejects before any backend; it is **stateless** (scales horizontally), with shared state (rate counters, token cache) in a fast external store / local cache; the **data plane** (high-throughput proxies, in-memory config) is separated from the **control plane** (owns routes/keys/policies, **pushes** versioned config) so config changes **without redeploying** the data plane; **auth** is offloaded to the edge via **local JWT verification** (fast) vs **token introspection** (cached lookup), then authorization by scope/role; **rate limiting** uses distributed counters with local pre-checks; each concern is **fail-open or fail-closed**; backends are protected with **timeouts, budgeted retries, and circuit breakers**; the gateway is the home for **observability** (RED metrics, structured logs, distributed tracing with an edge-injected correlation id).

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                  # MODIFY: register api-gateway MDX
├── components/
│   ├── diagrams/
│   │   ├── api-gateway-architecture.tsx       # NEW: HLD (client, data-plane fleet, control plane, config store, auth, rate-limit store, service registry, backends, telemetry)
│   │   └── api-gateway-flows.tsx              # NEW: proxy-request / auth-reject / config-push / circuit-break sequences
│   └── learning/
│       └── api-gateway-capacity.tsx           # NEW: wrapper over CapacityTable
├── content/tutorials/api-gateway.mdx          # NEW: full tutorial content
├── lib/
│   ├── api-gateway-estimates.ts               # NEW: pure capacity calc
│   ├── tutorial-registry.ts                   # MODIFY: add api-gateway entry (18 sections)
│   └── curriculum.ts                          # MODIFY: flip api-gateway to available
├── mdx-components.tsx                          # MODIFY: register new components
├── tests/
│   ├── api-gateway-estimates.test.ts          # NEW
│   ├── api-gateway-content.test.ts            # NEW
│   ├── diagrams.test.tsx                       # MODIFY: gateway diagram assertions
│   ├── tutorial-registry.test.ts              # MODIFY: fourteen tutorials; repoint undefined-slug to web-crawler
│   └── curriculum.test.ts                      # MODIFY: fourteen available problems (api-gateway inserts at seq 6, between distributed-cache and video-streaming)
└── e2e/pilot.spec.ts                          # MODIFY: gateway flow + coming-soon count 20→19
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the API Gateway capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/api-gateway-estimates.ts`, `tests/api-gateway-estimates.test.ts`, `components/learning/api-gateway-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/api-gateway-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateApiGatewayCapacity } from "@/lib/api-gateway-estimates";

describe("calculateApiGatewayCapacity", () => {
  const result = calculateApiGatewayCapacity({
    requestsPerDay: 10_000_000_000,
    peakFactor: 3,
    gatewayOverheadMs: 4,
    avgBackendLatencyMs: 80,
    instanceCapacityRps: 5_000,
    authCacheHitRate: 0.95,
    authStoreLatencyMs: 10,
  });

  it("derives average requests per second", () => {
    expect(result.avgRps).toBeCloseTo(115740.74, 1);
  });
  it("derives peak requests per second", () => {
    expect(result.peakRps).toBeCloseTo(347222.22, 1);
  });
  it("derives the number of gateway instances needed at peak", () => {
    expect(result.instancesNeeded).toBe(70);
  });
  it("derives the latency overhead the gateway adds as a percentage", () => {
    expect(result.latencyOverheadPct).toBeCloseTo(4.76, 2);
  });
  it("derives the effective (cached) auth-lookup latency", () => {
    expect(result.effectiveAuthLatencyMs).toBeCloseTo(0.5, 5);
  });
  it("derives the auth-store QPS after caching offload", () => {
    expect(result.authStoreQps).toBeCloseTo(17361.11, 1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/api-gateway-estimates.test.ts`.

**Step 3: Implement** `lib/api-gateway-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;

export interface ApiGatewayCapacityAssumptions {
  /** Total requests per day across all fronted services. */
  requestsPerDay: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Latency the gateway's filter chain adds per request, in ms. */
  gatewayOverheadMs: number;
  /** Average backend processing latency, in ms. */
  avgBackendLatencyMs: number;
  /** Requests per second one gateway instance can handle. */
  instanceCapacityRps: number;
  /** Fraction of auth checks served from the local token cache. */
  authCacheHitRate: number;
  /** Latency of a central auth-store (introspection) lookup on a miss, in ms. */
  authStoreLatencyMs: number;
}

export interface ApiGatewayCapacityResults {
  avgRps: number;
  peakRps: number;
  instancesNeeded: number;
  latencyOverheadPct: number;
  effectiveAuthLatencyMs: number;
  authStoreQps: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the gateway sees the sum of all
 * traffic and sits on every request's critical path, so its overhead must stay a small fraction of
 * total latency; being stateless it scales horizontally (peak ÷ per-instance capacity); and caching
 * auth/limit state keeps per-request cost tiny and offloads the central auth store ~20×.
 */
export function calculateApiGatewayCapacity(
  a: ApiGatewayCapacityAssumptions,
): ApiGatewayCapacityResults {
  const avgRps = a.requestsPerDay / SECONDS_PER_DAY;
  const peakRps = avgRps * a.peakFactor;
  const instancesNeeded = Math.ceil(peakRps / a.instanceCapacityRps);
  const latencyOverheadPct =
    (a.gatewayOverheadMs / (a.gatewayOverheadMs + a.avgBackendLatencyMs)) * 100;
  const effectiveAuthLatencyMs = (1 - a.authCacheHitRate) * a.authStoreLatencyMs;
  const authStoreQps = peakRps * (1 - a.authCacheHitRate);

  return {
    avgRps,
    peakRps,
    instancesNeeded,
    latencyOverheadPct,
    effectiveAuthLatencyMs,
    authStoreQps,
  };
}
```

**Step 4: Run to verify it passes** (6 tests).

**Step 5: Create the wrapper** `components/learning/api-gateway-capacity.tsx`, mirroring
`components/learning/maps-navigation-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateApiGatewayCapacity,
  type ApiGatewayCapacityAssumptions,
} from "@/lib/api-gateway-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ApiGatewayCapacity({
  assumptions,
}: {
  assumptions: ApiGatewayCapacityAssumptions;
}) {
  const r = calculateApiGatewayCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Requests / day", value: fmt(assumptions.requestsPerDay) },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Gateway overhead", value: `${fmt(assumptions.gatewayOverheadMs)} ms` },
    { label: "Avg backend latency", value: `${fmt(assumptions.avgBackendLatencyMs)} ms` },
    { label: "Instance capacity", value: `${fmt(assumptions.instanceCapacityRps)} RPS` },
    { label: "Auth cache hit rate", value: `${fmt(assumptions.authCacheHitRate * 100)}%` },
    { label: "Auth store latency", value: `${fmt(assumptions.authStoreLatencyMs)} ms` },
  ];

  const results: ResultRow[] = [
    { label: "Avg requests / sec", value: fmt(r.avgRps), consequence: "The gateway sees the sum of all service traffic — it's sized for aggregate load, not one service." },
    { label: "Peak requests / sec", value: fmt(r.peakRps), consequence: "Peak is what you provision for; the gateway must absorb the busiest moment across the whole platform." },
    { label: "Gateway instances (peak)", value: fmt(r.instancesNeeded), consequence: "Because the gateway is stateless, capacity is just peak ÷ per-instance throughput — scale horizontally behind a load balancer." },
    { label: "Latency overhead", value: `${fmt(r.latencyOverheadPct, 2)}%`, consequence: "The gateway is on every request's critical path, so its work must stay a small fraction of total latency — never a tax on the platform." },
    { label: "Effective auth latency", value: `${fmt(r.effectiveAuthLatencyMs, 2)} ms`, consequence: "A 95%-hit local token cache turns a 10 ms introspection into ~0.5 ms average — caching is what keeps edge auth cheap." },
    { label: "Auth-store QPS", value: fmt(r.authStoreQps), consequence: "Caching offloads the central token store ~20×; without it every request would hit it at peak RPS." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `ApiGatewayCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/api-gateway-estimates.test.ts tests/maps-navigation-estimates.test.ts
npm run typecheck && npm run lint
git add lib/api-gateway-estimates.ts tests/api-gateway-estimates.test.ts components/learning/api-gateway-capacity.tsx mdx-components.tsx
git commit -m "feat: add api gateway capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/maps-navigation-architecture.tsx` (HLD) and
`components/diagrams/maps-navigation-flows.tsx` (sequences) — do not invent new SVG conventions.
Copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `maps-navigation-flows.tsx` (or
`job-scheduler-flows.tsx`) verbatim.

**Files:** Create `components/diagrams/api-gateway-architecture.tsx`, `components/diagrams/api-gateway-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { ApiGatewayArchitecture } from "@/components/diagrams/api-gateway-architecture";
import {
  ProxyRequestSequence,
  AuthRejectSequence,
  ConfigPushSequence,
  CircuitBreakSequence,
} from "@/components/diagrams/api-gateway-flows";

describe("ApiGatewayArchitecture", () => {
  it("exposes the api gateway architecture to non-visual readers", () => {
    render(<ApiGatewayArchitecture />);
    expect(
      screen.getByRole("img", { name: /api gateway architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cross-cutting/i)).toBeInTheDocument();
  });
});

describe("api gateway flow sequences", () => {
  it("renders the proxy, auth-reject, config, and circuit sequences", () => {
    render(<ProxyRequestSequence />);
    expect(screen.getByRole("img", { name: /proxy/i })).toBeInTheDocument();
    render(<AuthRejectSequence />);
    expect(screen.getByRole("img", { name: /reject/i })).toBeInTheDocument();
    render(<ConfigPushSequence />);
    expect(screen.getByRole("img", { name: /config/i })).toBeInTheDocument();
    render(<CircuitBreakSequence />);
    expect(screen.getByRole("img", { name: /circuit/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"cross-cutting"** in the
**caption only** (NOT in any node label and NOT in the `DiagramFrame` title). Node labels like
"Control Plane" / "Data Plane" are fine — they do NOT match `/cross-cutting/i`. Also: all four flow
titles render into the same test DOM in one test, so each regex must match exactly one title — use
distinct, mutually exclusive title keywords **"proxy" / "reject" / "config" / "circuit"** and ensure
NO title contains another flow's keyword.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `api-gateway-architecture.tsx` exporting
`ApiGatewayArchitecture`, following the `maps-navigation-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before
nodes, a `Legend`). It must show:
- `Client` (infra, sublabel "all traffic") → `Gateway` (service, sublabel "data plane · filters") via `ingress` ("request").
- `Gateway` → `Auth Service` (service, sublabel "verify / introspect") via `create` ("verify token").
- `Gateway` → `Rate Limiter` (cache, sublabel "counters") via `control` ("check + incr").
- `Gateway` → `Backends` (service, sublabel "upstreams") via `redirect` ("route + forward").
- `Service Registry` (store, sublabel "healthy upstreams") → `Gateway` via `muted` ("discovery").
- `Control Plane` (service, sublabel "routes / keys / policies") → `Config Store` (store, sublabel "versioned config") via `create` ("manage config").
- `Control Plane` → `Gateway` via `async` ("push config").
- `Gateway` → `Telemetry` (queue, sublabel "logs / metrics / traces") via `muted` ("observability").
- `title` contains "API Gateway architecture"; `caption` names the **data-plane / control-plane
  split**, the **filter chain**, **edge auth / rate-limiting**, and that the gateway centralizes
  **cross-cutting** concerns, in prose. (Per the gotcha, keep "cross-cutting" in the caption only;
  distinct node labels; "Control Plane"/"Data Plane" as labels are fine.)
- Node kinds: `infra` for the client; `service` for the gateway, control plane, auth service, and
  backends; `cache` for the rate limiter; `store` for the config store and service registry; `queue`
  for the telemetry sink.
- Suggested geometry (viewBox `0 0 960 520`): client {24,232} → gateway {220,232} → backends
  {760,232} across the middle; authService {480,90} and rateLimiter {480,232} above/inline near the
  gateway's right; serviceRegistry {760,90}; controlPlane {220,392} and configStore {24,392} along
  the bottom; telemetry {480,392}. `w` ≈ 150, `h` ≈ 56 (store `h` ≈ 60). Adjust to avoid overlaps;
  keep the viewBox ≥ the rightmost/bottom-most node.

**Step 4: Implement the flow sequences** `api-gateway-flows.tsx`, exporting four components. Each
`title` contains the keyword the test matches; keep the four keywords mutually exclusive ("proxy" /
"reject" / "config" / "circuit"):
- `ProxyRequestSequence` — title contains "proxy" (e.g. "Sequence: proxy a request through the gateway"); actors Client, Gateway, Auth Service, Backend; steps: client sends a request with a bearer token, the gateway verifies the token (cached), checks the rate limit, matches the route, forwards to the backend, returns the response. Caption: the happy path runs the filter chain — authN, rate-limit, route — then forwards to the upstream and relays the response, adding only a few milliseconds.
- `AuthRejectSequence` — title contains "reject" (e.g. "Sequence: reject an unauthorized request at the edge"); actors Client, Gateway, Auth Service; steps: client sends a request with a missing/invalid token, the gateway calls auth and the token fails (or the rate limit is exceeded), the gateway short-circuits and returns 401/429 without touching any backend. Caption: invalid or over-limit requests are rejected at the edge before any backend is touched — the gateway protects upstreams by failing early. Use `control` for the rejection.
- `ConfigPushSequence` — title contains "config" (e.g. "Sequence: push new config to the data plane"); actors Operator, Control Plane, Config Store, Gateway; steps: operator submits a route/policy change, the control plane validates it, persists a new version to the config store, and pushes it to the gateway instances, which hot-reload it without dropping connections. Caption: the control plane validates, versions, and pushes config to the stateless data plane, which hot-reloads it — routing and policy change without redeploying the proxies. Use `async` for the push.
- `CircuitBreakSequence` — title contains "circuit" (e.g. "Sequence: trip the circuit breaker on a failing upstream"); actors Client, Gateway, Backend; steps: requests to a backend start timing out/erroring, the gateway's failure counter crosses the threshold and the circuit opens, subsequent requests fail fast (or get a fallback) without calling the sick backend, and after a cooldown the gateway probes with a trial request to close the circuit. Caption: when an upstream is unhealthy the circuit breaker opens so the gateway fails fast instead of piling onto a sick backend, then probes to recover. Use `control` for the trip/fail-fast.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/api-gateway-architecture.tsx components/diagrams/api-gateway-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add api gateway architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton with
all 18 section ids, and update the existing "thirteen tutorials" tests to "fourteen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/api-gateway.mdx` (skeleton).

IMPORTANT: there are currently THIRTEEN available tutorials. You add a FOURTEENTH. `api-gateway`
is **sequence 6**, which sits **between `distributed-cache` (seq 5) and `video-streaming` (seq 11)**
in the curriculum's available-by-sequence ordering — so it **inserts early**, not at the end. ALSO
CRITICAL: `api-gateway` was the slug used by the registry test's "returns undefined for unregistered"
case; since it is now registered, that test must be repointed to a still-`coming-soon` slug —
**`web-crawler`** (seq 7). Read each test file BEFORE editing to match its exact phrasing. The
curriculum total is 33 — do NOT change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all FOURTEEN tutorials are registered. In
the sorted `Object.keys(tutorials)` array, `"api-gateway"` sorts FIRST (before `"cloud-drive"`). The
new sorted array is:
`["api-gateway", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "notification-service", "pastebin", "payment-system", "rate-limiter", "ticket-booking", "url-shortener", "video-streaming"]`.
Add `expect(getTutorial("api-gateway")?.sections).toHaveLength(18);` to the section-length test.
Update the two descriptive `it(...)` strings to mention the API Gateway. **CHANGE the "returns
undefined for unregistered" test from `getTutorial("api-gateway")` to `getTutorial("web-crawler")`**
(web-crawler is still coming-soon and unregistered).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(api-gateway is seq 6 — it goes AFTER distributed-cache and BEFORE video-streaming).
Add `expect(getProblem("api-gateway")?.title).toBe("API Gateway");`. Update the descriptive `it(...)`
string. Do NOT touch the 33 count/sequence assertions.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `api-gateway` entry `status` from `"coming-soon"` to
`"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"api-gateway": {
  slug: "api-gateway",
  title: "Design an API Gateway",
  description:
    "An interview-grade walkthrough of an API gateway: the single edge that fronts a fleet of microservices — request routing and service discovery, offloaded authentication and authorization, rate limiting and quotas, the control-plane/data-plane split for config distribution, resilience (timeouts, retries, circuit breaking) and observability, scaling, and failure modes.",
  difficulty: "Intermediate",
  readingMinutes: 34,
  concepts: ["Routing", "AuthN/AuthZ", "Rate limiting", "Observability"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "request-lifecycle", label: "Request Lifecycle & the Filter Chain", depth: "advanced" },
    { id: "routing-discovery", label: "Routing & Service Discovery", depth: "advanced" },
    { id: "auth", label: "Authentication & Authorization", depth: "advanced" },
    { id: "rate-limiting", label: "Rate Limiting & Quotas", depth: "advanced" },
    { id: "control-data-plane", label: "Control Plane & Data Plane", depth: "advanced" },
    { id: "resilience-observability", label: "Resilience & Observability", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import ApiGatewayContent from "@/content/tutorials/api-gateway.mdx";` and `"api-gateway": ApiGatewayContent,` to the content map.

**Step 7:** Create `content/tutorials/api-gateway.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/api-gateway
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/api-gateway.mdx
git commit -m "feat: register api gateway tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3, then
installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered the
embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<ApiGatewayCapacity assumptions={{ requestsPerDay: 10000000000, peakFactor: 3, gatewayOverheadMs: 4, avgBackendLatencyMs: 80, instanceCapacityRps: 5000, authCacheHitRate: 0.95, authStoreLatencyMs: 10 }} />` then read off the aggregate-traffic / stateless-horizontal-scale / latency-overhead-budget / cache-offloads-auth lessons.
- `entity-model` — `EntityModel name="Route"` (route_id, match, upstream, filters, rate_limit, auth_policy, timeout_ms, retries) + prose on the Consumer/API key, the rate-limit counter (transient, shared store), the service-registry entry, and control-plane-owns-config / data-plane-holds-cached-copy.
- `api-design` — `ApiContract` for a data-plane proxied request (`GET /orders/{id}` → 200/401/429), an admin route (`PUT /admin/routes/{id}`), and an admin consumer (`POST /admin/consumers`).
- `high-level-architecture` — `<ApiGatewayArchitecture />` + component prose.
- `detailed-flows` — `<ProxyRequestSequence />`, `<AuthRejectSequence />`, `<ConfigPushSequence />`, `<CircuitBreakSequence />` with prose.
- deep dives `request-lifecycle`, `routing-discovery`, `auth`, `rate-limiting`, `control-data-plane`, `resilience-observability` per spec, with a `<KnowledgeCheck>` in request-lifecycle, routing-discovery, auth, rate-limiting, and control-data-plane.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- Cross-reference the Rate Limiter tutorial (rate-limiting section). ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/api-gateway-content.test.ts` (mirror `tests/maps-navigation-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<ApiGatewayCapacity`, `<ApiGatewayArchitecture`, and the four sequences `<ProxyRequestSequence`, `<AuthRejectSequence`, `<ConfigPushSequence`, `<CircuitBreakSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real
embeds and generates `/learn/api-gateway`) all green. Commit `content: complete api gateway tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 19), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 20 to 19 (fourteen
tutorials now available — verify the current value is 20 first) and add:
```ts
test("learner can open the api gateway tutorial", async ({ page }) => {
  await page.goto("/learn/api-gateway");
  await expect(
    page.getByRole("heading", { name: /design an api gateway/i }),
  ).toBeVisible();
  await page.goto("/learn/api-gateway#control-data-plane");
  await expect(page.locator("#control-data-plane")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /api gateway architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC
link issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify api gateway tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/maps-navigation.mdx` and `distributed-cache.mdx` first** for voice, depth, and component usage. Match their altitude. (Distributed Cache is the nearest Intermediate one.)
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — verify token / manage config / write), `redirect` (green — route+forward / response), `async` (violet dashed — push config), `control` (amber dashed — rate-limit check / reject / circuit trip), `muted` (telemetry dotted — discovery / observability), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for gateway/control-plane/auth/backends, `cache` for the rate limiter, `store` for the config store and service registry, `queue` for the telemetry sink.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "cross-cutting" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "proxy"/"reject"/"config"/"circuit" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/api-gateway-estimates.test.ts`.
- **api-gateway is seq 6 — it INSERTS early** in the curriculum available-by-sequence ordering (after distributed-cache seq 5, before video-streaming seq 11). The curriculum total is 33 (unchanged); do not touch the 33 count assertions. **The registry test's "unregistered" slug must move from `api-gateway` to `web-crawler`.**
- **No flow/diagram name collisions:** `ProxyRequestSequence`, `AuthRejectSequence`, `ConfigPushSequence`, `CircuitBreakSequence`, `ApiGatewayArchitecture`, `ApiGatewayCapacity` are all unique exports — no aliasing needed in `mdx-components.tsx`.
```
