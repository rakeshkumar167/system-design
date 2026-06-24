# Video Streaming Platform Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the sixth complete curriculum tutorial — an Advanced, asymmetric-pipeline walkthrough of a Video Streaming Platform (VOD): chunked upload, an asynchronous transcoding fan-out into an adaptive-bitrate ladder, ABR playback, and CDN-dominated delivery — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first five tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **the asynchronous transcoding pipeline**, **the rendition ladder + segmentation**, **adaptive bitrate streaming**, and **CDN-dominated delivery**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the five existing tutorials.
- Invariants: ingest is **asynchronous** (transcode is a queued, idempotent, retryable job; a video is `ready` only when its manifest is complete); one source becomes a **rendition ladder**, each **segmented**; playback is **adaptive bitrate** (client picks rendition per segment from a manifest); **delivery is a CDN problem** (~95% hit ratio → origin sees ~5%); source files are the durable system of record.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register video-streaming MDX
├── components/
│   ├── diagrams/
│   │   ├── video-streaming-architecture.tsx             # NEW: HLD (upload svc, raw storage, transcode queue+workers, segment storage, CDN, metadata DB)
│   │   └── streaming-flows.tsx                          # NEW: upload-ingest / transcode-pipeline / abr-playback / cdn-delivery sequences
│   └── learning/
│       └── video-streaming-capacity.tsx                 # NEW: wrapper over CapacityTable
├── content/tutorials/video-streaming.mdx                # NEW: full tutorial content
├── lib/
│   ├── video-streaming-estimates.ts                     # NEW: pure capacity calc
│   ├── tutorial-registry.ts                             # MODIFY: add video-streaming entry (18 sections)
│   └── curriculum.ts                                    # MODIFY: flip video-streaming to available
├── mdx-components.tsx                                   # MODIFY: register new components
├── tests/
│   ├── video-streaming-estimates.test.ts                # NEW
│   ├── video-streaming-content.test.ts                  # NEW
│   ├── diagrams.test.tsx                                # MODIFY: video-streaming diagram assertions
│   ├── tutorial-registry.test.ts                        # MODIFY: six tutorials
│   └── curriculum.test.ts                               # MODIFY: six available problems
└── e2e/pilot.spec.ts                                    # MODIFY: video-streaming flow + count 20→19
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Video Streaming capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/video-streaming-estimates.ts`, `tests/video-streaming-estimates.test.ts`, `components/learning/video-streaming-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/video-streaming-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateVideoStreamingCapacity } from "@/lib/video-streaming-estimates";

describe("calculateVideoStreamingCapacity", () => {
  const result = calculateVideoStreamingCapacity({
    uploadsPerDay: 500_000,
    avgVideoMinutes: 10,
    renditionCount: 5,
    mbPerMinutePerRendition: 12,
    peakConcurrentStreams: 5_000_000,
    streamBitrateMbps: 5,
    cdnHitRatio: 0.95,
  });

  it("derives the daily ingest hours of source video", () => {
    expect(result.dailyIngestHours).toBeCloseTo(83333.33, 2);
  });
  it("derives storage per video across the rendition ladder", () => {
    expect(result.storagePerVideoGb).toBeCloseTo(0.6, 5);
  });
  it("derives daily storage growth in TB", () => {
    expect(result.dailyStorageTb).toBe(300);
  });
  it("derives peak delivery egress in Tbps", () => {
    expect(result.peakEgressTbps).toBe(25);
  });
  it("derives origin egress after CDN offload", () => {
    expect(result.originEgressTbps).toBeCloseTo(1.25, 2);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/video-streaming-estimates.test.ts`.

**Step 3: Implement** `lib/video-streaming-estimates.ts` (compute storage from integer MB to avoid float drift):
```ts
const MINUTES_PER_HOUR = 60;
const MB_PER_TB = 1_000_000;
const MBPS_PER_TBPS = 1_000_000;

export interface VideoStreamingCapacityAssumptions {
  /** Videos uploaded per day. */
  uploadsPerDay: number;
  /** Average source video length in minutes. */
  avgVideoMinutes: number;
  /** Number of renditions in the bitrate/resolution ladder. */
  renditionCount: number;
  /** Stored MB per minute of one rendition (averaged across the ladder). */
  mbPerMinutePerRendition: number;
  /** Peak concurrent viewers streaming at once. */
  peakConcurrentStreams: number;
  /** Average delivered bitrate per stream, in Mbps. */
  streamBitrateMbps: number;
  /** Fraction of delivery bytes served from CDN cache (0..1). */
  cdnHitRatio: number;
}

export interface VideoStreamingCapacityResults {
  dailyIngestHours: number;
  storagePerVideoGb: number;
  dailyStorageTb: number;
  peakEgressTbps: number;
  originEgressTbps: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: storage explodes
 * because one source becomes a ladder of renditions, and delivery is a CDN/bandwidth
 * problem — peak egress is impossible from an origin, so the cache hit ratio is the
 * dominant lever (origin sees only the miss fraction).
 */
export function calculateVideoStreamingCapacity(
  a: VideoStreamingCapacityAssumptions,
): VideoStreamingCapacityResults {
  const dailyIngestHours = (a.uploadsPerDay * a.avgVideoMinutes) / MINUTES_PER_HOUR;

  const storagePerVideoMb =
    a.avgVideoMinutes * a.renditionCount * a.mbPerMinutePerRendition;
  const storagePerVideoGb = storagePerVideoMb / 1000;
  const dailyStorageTb = (a.uploadsPerDay * storagePerVideoMb) / MB_PER_TB;

  const peakEgressTbps =
    (a.peakConcurrentStreams * a.streamBitrateMbps) / MBPS_PER_TBPS;
  const originEgressTbps = peakEgressTbps * (1 - a.cdnHitRatio);

  return {
    dailyIngestHours,
    storagePerVideoGb,
    dailyStorageTb,
    peakEgressTbps,
    originEgressTbps,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/video-streaming-capacity.tsx`, mirroring
`components/learning/ticket-booking-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateVideoStreamingCapacity,
  type VideoStreamingCapacityAssumptions,
} from "@/lib/video-streaming-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function VideoStreamingCapacity({
  assumptions,
}: {
  assumptions: VideoStreamingCapacityAssumptions;
}) {
  const r = calculateVideoStreamingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Uploads / day", value: fmt(assumptions.uploadsPerDay) },
    { label: "Avg video length", value: `${fmt(assumptions.avgVideoMinutes)} min` },
    { label: "Renditions / video", value: fmt(assumptions.renditionCount) },
    { label: "MB / min / rendition", value: fmt(assumptions.mbPerMinutePerRendition) },
    { label: "Peak concurrent streams", value: fmt(assumptions.peakConcurrentStreams) },
    { label: "Avg stream bitrate", value: `${fmt(assumptions.streamBitrateMbps)} Mbps` },
    { label: "CDN hit ratio", value: `${fmt(assumptions.cdnHitRatio * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Daily ingest", value: `${fmt(r.dailyIngestHours)} h`, consequence: "Hours of source video ingested per day — the transcode fleet must keep pace or a backlog forms." },
    { label: "Storage / video", value: `${fmt(r.storagePerVideoGb, 1)} GB`, consequence: "One source becomes a ladder of renditions, so stored bytes multiply by the rendition count." },
    { label: "Daily storage growth", value: `${fmt(r.dailyStorageTb)} TB`, consequence: "Storage grows relentlessly — tier hot vs cold and garbage-collect failed transcodes." },
    { label: "Peak egress", value: `${fmt(r.peakEgressTbps)} Tbps`, consequence: "Delivery bandwidth is impossible from an origin — this is fundamentally a CDN problem." },
    { label: "Origin egress (after CDN)", value: `${fmt(r.originEgressTbps, 2)} Tbps`, consequence: "A 95% cache hit ratio leaves the origin only the miss fraction — hit ratio is the dominant delivery lever." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `VideoStreamingCapacity` in `mdx-components.tsx`.

**Step 7: Verify and commit**
```bash
npm test -- tests/video-streaming-estimates.test.ts tests/ticket-booking-estimates.test.ts
npm run typecheck && npm run lint
git add lib/video-streaming-estimates.ts tests/video-streaming-estimates.test.ts components/learning/video-streaming-capacity.tsx mdx-components.tsx
git commit -m "feat: add video streaming capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/ticket-booking-architecture.tsx` (HLD) and
`components/diagrams/booking-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/video-streaming-architecture.tsx`, `components/diagrams/streaming-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { VideoStreamingArchitecture } from "@/components/diagrams/video-streaming-architecture";
import {
  UploadIngestSequence,
  TranscodePipelineSequence,
  AbrPlaybackSequence,
  CdnDeliverySequence,
} from "@/components/diagrams/streaming-flows";

describe("VideoStreamingArchitecture", () => {
  it("exposes the video streaming architecture to non-visual readers", () => {
    render(<VideoStreamingArchitecture />);
    expect(
      screen.getByRole("img", { name: /video streaming architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/adaptive bitrate/i)).toBeInTheDocument();
  });
});

describe("streaming flow sequences", () => {
  it("renders the upload, transcode, playback, and CDN sequences", () => {
    render(<UploadIngestSequence />);
    expect(screen.getByRole("img", { name: /upload|ingest/i })).toBeInTheDocument();
    render(<TranscodePipelineSequence />);
    expect(screen.getByRole("img", { name: /transcod/i })).toBeInTheDocument();
    render(<AbrPlaybackSequence />);
    expect(screen.getByRole("img", { name: /playback|adaptive|stream/i })).toBeInTheDocument();
    render(<CdnDeliverySequence />);
    expect(screen.getByRole("img", { name: /cdn|delivery|cache/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: if a phrase a test asserts via `getByText` also
appears in a node label AND the caption, the query finds multiple matches and fails.
Keep the asserted phrase **"adaptive bitrate"** in the **caption only**; give nodes
distinct labels (e.g. node "CDN", caption text "…adaptive bitrate…").

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `video-streaming-architecture.tsx` exporting
`VideoStreamingArchitecture`, following the `ticket-booking-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Player` (infra) → `Upload Service` (service) via `ingress` ("upload chunks").
- `Upload Service` → `Raw Storage` (store) via `create` ("store source").
- `Upload Service` → `Transcode Queue` (queue) via `async` ("enqueue job").
- `Transcode Queue` → `Transcode Workers` (service) via `async` ("dequeue").
- `Transcode Workers` → `Raw Storage` via `redirect` ("read source").
- `Transcode Workers` → `Segment Storage` (store) via `create` ("write renditions").
- `Transcode Workers` → `Metadata DB` (store) via `control` ("mark ready").
- `Player` → `CDN` (cache) via `ingress` or `redirect` ("request segments").
- `CDN` → `Segment Storage` via `redirect` ("origin fetch (miss)").
- `title` contains "Video streaming architecture"; `caption` names **transcoding**,
  **adaptive bitrate**, **CDN**, **segments**, and explains the async pipeline + the
  CDN-dominated delivery path in prose. (Per the gotcha, keep "adaptive bitrate" in the
  caption; label nodes distinctly.)

**Step 4: Implement the flow sequences** `streaming-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel` helpers from `booking-flows.tsx`). Each `title` contains
the keyword the test matches:
- `UploadIngestSequence` — title contains "upload" (or "ingest"); actors Player, Upload Service, Raw Storage, Transcode Queue; steps: `POST /v1/videos`, resumable chunked upload to Raw Storage (presigned), enqueue transcode job, `202 Accepted` (status: transcoding). Caption: uploads are resumable and go straight to object storage; the API enqueues async work and returns immediately.
- `TranscodePipelineSequence` — title contains "transcod"; actors Transcode Worker, Raw Storage, Segment Storage, Metadata DB; steps: dequeue job, read source, transcode into a rendition ladder + segment each, write segments + manifests, mark video `ready`. Caption: the async fan-out — one source → many renditions × many segments; idempotent/retryable; `ready` only when the manifest is complete.
- `AbrPlaybackSequence` — title contains "playback" (or "adaptive"/"stream"); actors Player, CDN, Segment Storage; steps: fetch master manifest, pick a rendition, request segment N, measure throughput, switch rendition for segment N+1. Caption: the client (not the server) selects quality per segment from the manifest to avoid rebuffering.
- `CdnDeliverySequence` — title contains "cdn" (or "delivery"/"cache"); actors Player, CDN Edge, Segment Storage (origin); steps: request segment (cache hit → served from edge), request cold segment (miss → origin fetch → cache fill → served). Use `redirect` for hits/reads and `control` for the miss path. Caption: cache hit ratio is the dominant delivery lever; immutable segments cache indefinitely; only misses reach the origin.

**Step 5: Register** all five in `mdx-components.tsx`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/video-streaming-architecture.tsx components/diagrams/streaming-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add video streaming architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "five tutorials" tests to
"six".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/video-streaming.mdx` (skeleton).

IMPORTANT: there are currently FIVE available tutorials (url-shortener, rate-limiter, pastebin, notification-service, ticket-booking). You add a SIXTH. Note `video-streaming` is sequence 11, so in the curriculum's available-by-sequence ordering it comes AFTER notification-service (seq 4) and BEFORE ticket-booking (seq 16). Read each test file BEFORE editing to match its exact phrasing.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all SIX tutorials are registered and `video-streaming` has 18 sections. Keep the "returns undefined for unregistered" slug as a still-missing one like `distributed-cache` (still coming-soon).

**Step 2:** `tests/curriculum.test.ts` — available slugs become (in sequence order) `["url-shortener", "rate-limiter", "pastebin", "notification-service", "video-streaming", "ticket-booking"]` (video-streaming is seq 11, ticket-booking seq 16); assert `getProblem("video-streaming")?.title === "Video Streaming Platform"`.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `video-streaming` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add:
```ts
"video-streaming": {
  slug: "video-streaming",
  title: "Design a Video Streaming Platform",
  description:
    "An interview-grade walkthrough of a video-on-demand platform: resumable upload and ingestion, the asynchronous transcoding pipeline (the rendition ladder and segmentation), adaptive bitrate streaming, CDN-dominated delivery and caching, storage and cost, scaling, failure modes, and security/DRM.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Transcoding", "Adaptive bitrate", "CDN", "Object storage"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "upload-ingestion", label: "Upload & Ingestion", depth: "advanced" },
    { id: "transcoding-pipeline", label: "Transcoding Pipeline", depth: "advanced" },
    { id: "adaptive-bitrate-streaming", label: "Adaptive Bitrate Streaming", depth: "advanced" },
    { id: "cdn-delivery", label: "CDN Delivery", depth: "advanced" },
    { id: "storage-and-cost", label: "Storage & Cost", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "security-drm", label: "Security & DRM", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import VideoStreamingContent from "@/content/tutorials/video-streaming.mdx";` and `"video-streaming": VideoStreamingContent,` to the content map.

**Step 7:** Create `content/tutorials/video-streaming.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids exactly as above), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/video-streaming
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/video-streaming.mdx
git commit -m "feat: register video streaming tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus, orchestrator)

Replace the skeleton's first nine sections (framing → transcoding pipeline) with complete
content embedding the components from Tasks 1–2. Authored by the orchestrator. Per spec
section notes 1–9, in particular:
- `capacity-estimates` — `<VideoStreamingCapacity assumptions={{ uploadsPerDay: 500000, avgVideoMinutes: 10, renditionCount: 5, mbPerMinutePerRendition: 12, peakConcurrentStreams: 5000000, streamBitrateMbps: 5, cdnHitRatio: 0.95 }} />` then read off the storage-explosion + CDN-egress lessons.
- `entity-model` — `EntityModel name="Video"` + prose on Rendition, Segment, manifest.
- `api-design` — `ApiContract` for `POST /v1/videos` (create + resumable upload URL) and `GET /v1/videos/{id}` (status); note the CDN-served manifest/segment playback path.
- `high-level-architecture` — `<VideoStreamingArchitecture />` + component prose.
- `detailed-flows` — `<UploadIngestSequence />`, `<TranscodePipelineSequence />`, `<AbrPlaybackSequence />`, `<CdnDeliverySequence />` with prose.
- `upload-ingestion` — resumable/chunked upload direct to object storage, why resumable, source as system of record, enqueue.
- `transcoding-pipeline` — the centerpiece: async fan-out, the rendition ladder + segmentation, parallelism, idempotent/retryable, `ready` only on a complete manifest; include a `<KnowledgeCheck>`.

End: `npm run build` compiles; `npm test` green. Commit `content: author video streaming sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus, orchestrator)

Complete the tutorial (adaptive bitrate streaming → FAQ) and add the structural content
test. Per spec notes 10–18, including a `TradeoffTable` for scaling stages, a
`FailureMatrix` with ≥ 6 rows, a `DecisionRecord`, ≥ 6 `<KnowledgeCheck>` total
(distributed through the deep-dive sections too), and one `<Faq items={[...]} />` with
≥ 12 entries.

Then create `tests/video-streaming-content.test.ts` (mirror `tests/ticket-booking-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<VideoStreamingCapacity`, `<VideoStreamingArchitecture`, and the four sequences `<UploadIngestSequence`, `<TranscodePipelineSequence`, `<AbrPlaybackSequence`, `<CdnDeliverySequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test -- tests/video-streaming-content.test.ts` and `npm run build` pass. Commit
`content: complete video streaming tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 19), and run
full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 20 to 19 (six tutorials now available) and add:
```ts
test("learner can open the video streaming tutorial", async ({ page }) => {
  await page.goto("/learn/video-streaming");
  await expect(
    page.getByRole("heading", { name: /design a video streaming platform/i }),
  ).toBeVisible();
  await page.goto("/learn/video-streaming#transcoding-pipeline");
  await expect(page.locator("#transcoding-pipeline")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /video streaming architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Verify the actual current count in the file and decrement by one if it differs from 20.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify video streaming tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/ticket-booking.mdx` and `notification-service.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — write/store/transcode output), `redirect` (green — read / cache hit / success), `async` (violet dashed — queue/enqueue/dequeue), `control` (amber dashed — mark-ready / cache miss / failure), `muted` (telemetry dotted), `ingress` (plain — client request). Node kinds: `queue` for the transcode queue, `service` for upload service and transcode workers, `store` for raw/segment/metadata storage, `cache` for the CDN, `infra` for the player.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep the asserted phrase "adaptive bitrate" in the caption only; distinct node labels).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/video-streaming-estimates.test.ts`.
