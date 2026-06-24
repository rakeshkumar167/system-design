# Collaborative Document Editor Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the seventh complete curriculum tutorial — an Advanced, real-time-collaboration walkthrough of a Collaborative Document Editor: concurrent editing without lost updates, operational transformation vs CRDTs, the real-time sync protocol, presence, and op-log persistence — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first six tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are **conflict-free convergence (OT and CRDTs)**, **optimistic local apply**, **real-time websocket fan-out**, and **op-log persistence**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the six existing tutorials.
- Invariants: the guarantees are **convergence** (all replicas identical) and **intention preservation** (no lost updates); edits are **operations** applied **optimistically** then reconciled by **OT** (server-ordered transform) or **CRDTs** (commutative ops via unique ids); one doc session is **single-ordering** (shard by doc_id); the **op log is the source of truth**, bounded by **snapshots + compaction**; **presence** is ephemeral and off the op log; the dominant load is **fan-out over persistent connections**, not bytes.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                                     # MODIFY: register collaborative-doc-editor MDX
├── components/
│   ├── diagrams/
│   │   ├── collaborative-doc-editor-architecture.tsx             # NEW: HLD (editor, WS gateway, collaboration service, op log, snapshot store, pub/sub, presence, metadata DB)
│   │   └── collab-editor-flows.tsx                               # NEW: edit-broadcast / conflict-resolution / presence / reconnect-sync sequences
│   └── learning/
│       └── collaborative-doc-editor-capacity.tsx                 # NEW: wrapper over CapacityTable
├── content/tutorials/collaborative-doc-editor.mdx                # NEW: full tutorial content
├── lib/
│   ├── collaborative-doc-editor-estimates.ts                     # NEW: pure capacity calc
│   ├── tutorial-registry.ts                                      # MODIFY: add collaborative-doc-editor entry (18 sections)
│   └── curriculum.ts                                             # MODIFY: flip collaborative-doc-editor to available
├── mdx-components.tsx                                            # MODIFY: register new components
├── tests/
│   ├── collaborative-doc-editor-estimates.test.ts               # NEW
│   ├── collaborative-doc-editor-content.test.ts                # NEW
│   ├── diagrams.test.tsx                                        # MODIFY: collaborative-doc-editor diagram assertions
│   ├── tutorial-registry.test.ts                               # MODIFY: seven tutorials
│   └── curriculum.test.ts                                       # MODIFY: seven available problems
└── e2e/pilot.spec.ts                                            # MODIFY: collaborative-doc-editor flow + count 19→18
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Collaborative Document Editor capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/collaborative-doc-editor-estimates.ts`, `tests/collaborative-doc-editor-estimates.test.ts`, `components/learning/collaborative-doc-editor-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/collaborative-doc-editor-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateCollaborativeDocEditorCapacity } from "@/lib/collaborative-doc-editor-estimates";

describe("calculateCollaborativeDocEditorCapacity", () => {
  const result = calculateCollaborativeDocEditorCapacity({
    peakConcurrentEditors: 2_000_000,
    opsPerEditorPerSecond: 2,
    collaboratorsPerDoc: 4,
    bytesPerOp: 100,
    dailyEditedDocs: 5_000_000,
    opsPerDocPerDay: 2_000,
  });

  it("derives peak inbound operations per second", () => {
    expect(result.peakInboundOpsPerSecond).toBe(4_000_000);
  });
  it("derives peak fan-out broadcast messages per second", () => {
    expect(result.peakFanoutMessagesPerSecond).toBe(12_000_000);
  });
  it("derives live persistent websocket connections", () => {
    expect(result.liveConnections).toBe(2_000_000);
  });
  it("derives daily operation volume", () => {
    expect(result.dailyOps).toBe(10_000_000_000);
  });
  it("derives daily op-log storage growth in TB", () => {
    expect(result.dailyOpLogTb).toBe(1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/collaborative-doc-editor-estimates.test.ts`.

**Step 3: Implement** `lib/collaborative-doc-editor-estimates.ts`:
```ts
const BYTES_PER_TB = 1_000_000_000_000;

export interface CollaborativeDocEditorCapacityAssumptions {
  /** Peak editors connected and editing simultaneously (≈ live websocket connections). */
  peakConcurrentEditors: number;
  /** Operations (keystrokes/edits) per active editor per second. */
  opsPerEditorPerSecond: number;
  /** Editors sharing one document session (the fan-out target). */
  collaboratorsPerDoc: number;
  /** Serialized size of one operation, in bytes. */
  bytesPerOp: number;
  /** Documents edited per day. */
  dailyEditedDocs: number;
  /** Average operations applied to an active document per day. */
  opsPerDocPerDay: number;
}

export interface CollaborativeDocEditorCapacityResults {
  peakInboundOpsPerSecond: number;
  peakFanoutMessagesPerSecond: number;
  liveConnections: number;
  dailyOps: number;
  dailyOpLogTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a collaborative editor's
 * load is fan-out and connection state, not bandwidth. Operations are tiny, but each is
 * rebroadcast to every collaborator and the system holds millions of persistent
 * websockets — so messages and connections are the scaling unit, and the op log grows
 * relentlessly, demanding snapshots and compaction.
 */
export function calculateCollaborativeDocEditorCapacity(
  a: CollaborativeDocEditorCapacityAssumptions,
): CollaborativeDocEditorCapacityResults {
  const peakInboundOpsPerSecond = a.peakConcurrentEditors * a.opsPerEditorPerSecond;
  const peakFanoutMessagesPerSecond =
    peakInboundOpsPerSecond * (a.collaboratorsPerDoc - 1);
  const liveConnections = a.peakConcurrentEditors;
  const dailyOps = a.dailyEditedDocs * a.opsPerDocPerDay;
  const dailyOpLogTb = (dailyOps * a.bytesPerOp) / BYTES_PER_TB;

  return {
    peakInboundOpsPerSecond,
    peakFanoutMessagesPerSecond,
    liveConnections,
    dailyOps,
    dailyOpLogTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/collaborative-doc-editor-capacity.tsx`, mirroring
`components/learning/video-streaming-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateCollaborativeDocEditorCapacity,
  type CollaborativeDocEditorCapacityAssumptions,
} from "@/lib/collaborative-doc-editor-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CollaborativeDocEditorCapacity({
  assumptions,
}: {
  assumptions: CollaborativeDocEditorCapacityAssumptions;
}) {
  const r = calculateCollaborativeDocEditorCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Peak concurrent editors", value: fmt(assumptions.peakConcurrentEditors) },
    { label: "Ops / editor / sec", value: fmt(assumptions.opsPerEditorPerSecond) },
    { label: "Collaborators / doc", value: fmt(assumptions.collaboratorsPerDoc) },
    { label: "Bytes / op", value: fmt(assumptions.bytesPerOp) },
    { label: "Daily edited docs", value: fmt(assumptions.dailyEditedDocs) },
    { label: "Ops / doc / day", value: fmt(assumptions.opsPerDocPerDay) },
  ];

  const results: ResultRow[] = [
    { label: "Peak inbound ops / sec", value: fmt(r.peakInboundOpsPerSecond), consequence: "Every keystroke is an operation — the raw rate the collaboration servers must order and apply." },
    { label: "Peak fan-out msgs / sec", value: fmt(r.peakFanoutMessagesPerSecond), consequence: "Each op is rebroadcast to every other collaborator — fan-out, not bytes, is the dominant real-time load." },
    { label: "Live connections", value: fmt(r.liveConnections), consequence: "Persistent websockets held open at once — connection state, not CPU, is the scaling unit." },
    { label: "Daily operations", value: fmt(r.dailyOps), consequence: "Ten billion tiny ops a day — the append-only op log grows without bound unless compacted." },
    { label: "Daily op-log growth", value: `${fmt(r.dailyOpLogTb)} TB`, consequence: "Small per op but relentless; periodic snapshots plus log compaction keep storage and replay bounded." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `CollaborativeDocEditorCapacity` in `mdx-components.tsx`.

**Step 7: Verify and commit**
```bash
npm test -- tests/collaborative-doc-editor-estimates.test.ts tests/video-streaming-estimates.test.ts
npm run typecheck && npm run lint
git add lib/collaborative-doc-editor-estimates.ts tests/collaborative-doc-editor-estimates.test.ts components/learning/collaborative-doc-editor-capacity.tsx mdx-components.tsx
git commit -m "feat: add collaborative doc editor capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/video-streaming-architecture.tsx` (HLD) and
`components/diagrams/streaming-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/collaborative-doc-editor-architecture.tsx`, `components/diagrams/collab-editor-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { CollaborativeDocEditorArchitecture } from "@/components/diagrams/collaborative-doc-editor-architecture";
import {
  EditBroadcastSequence,
  ConflictResolutionSequence,
  PresenceSequence,
  ReconnectSyncSequence,
} from "@/components/diagrams/collab-editor-flows";

describe("CollaborativeDocEditorArchitecture", () => {
  it("exposes the collaborative editor architecture to non-visual readers", () => {
    render(<CollaborativeDocEditorArchitecture />);
    expect(
      screen.getByRole("img", { name: /collaborative (document )?editor architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/converge/i)).toBeInTheDocument();
  });
});

describe("collaborative editor flow sequences", () => {
  it("renders the edit, conflict, presence, and reconnect sequences", () => {
    render(<EditBroadcastSequence />);
    expect(screen.getByRole("img", { name: /edit|broadcast/i })).toBeInTheDocument();
    render(<ConflictResolutionSequence />);
    expect(screen.getByRole("img", { name: /conflict|transform|converge/i })).toBeInTheDocument();
    render(<PresenceSequence />);
    expect(screen.getByRole("img", { name: /presence|cursor/i })).toBeInTheDocument();
    render(<ReconnectSyncSequence />);
    expect(screen.getByRole("img", { name: /reconnect|sync|catch/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: if a phrase a test asserts via `getByText` also
appears in a node label AND the caption, the query finds multiple matches and fails.
Keep the asserted phrase **"converge"/"convergence"** in the **caption only**; give nodes
distinct labels (e.g. node "Collaboration Service", caption text "…all replicas
converge…").

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `collaborative-doc-editor-architecture.tsx` exporting
`CollaborativeDocEditorArchitecture`, following the `video-streaming-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Editor` (infra) ↔ `WS Gateway` (service) via `ingress` ("edit ops") and a `redirect` return ("broadcast").
- `WS Gateway` → `Collaboration Service` (service) via `create` ("route by doc_id").
- `Collaboration Service` → `Op Log` (store) via `create` ("append op").
- `Collaboration Service` → `Snapshot Store` (store) via `create` ("snapshot").
- `Collaboration Service` → `Pub/Sub` (queue) via `async` ("fan-out").
- `Collaboration Service` → `Presence Service` (cache) via `control` ("cursors").
- `Collaboration Service` → `Metadata DB` (store) via `redirect` ("read ACL").
- `title` contains "Collaborative document editor architecture"; `caption` names
  **operations**, **convergence/converge**, **OT / CRDT**, and **fan-out**, and explains
  optimistic local apply + server ordering + op-log persistence in prose. (Per the gotcha,
  keep "converge" in the caption; label nodes distinctly.)

**Step 4: Implement the flow sequences** `collab-editor-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `streaming-flows.tsx`). Each
`title` contains the keyword the test matches:
- `EditBroadcastSequence` — title contains "edit" (or "broadcast"); actors Editor A, Collaboration Service, Editor B; steps: A applies op locally (optimistic), sends op, server assigns seq + appends to log, server acks A, server broadcasts op to B, B applies. Caption: edits apply locally instantly, then the server orders and fans out to collaborators.
- `ConflictResolutionSequence` — title contains "conflict" (or "transform"/"converge"); actors Editor A, Collaboration Service, Editor B; steps: A and B both edit the same position concurrently; server orders them and transforms (OT) / merges by element id (CRDT) so neither edit is lost; both replicas converge to the same result. Caption: concurrent edits are transformed/merged so all replicas converge with no lost update.
- `PresenceSequence` — title contains "presence" (or "cursor"); actors Editor A, Presence Service, Editor B; steps: A moves cursor, sends presence update on the ephemeral channel, presence service fans out to B; dropped frames are fine. Use `control` (ephemeral) edges. Caption: presence is ephemeral and lossy, on a separate channel — never written to the durable op log.
- `ReconnectSyncSequence` — title contains "reconnect" (or "sync"/"catch"); actors Editor, Collaboration Service, Op Log; steps: editor disconnects, reconnects with its last seq, server reads missed ops from the log since that seq, sends the delta, editor catches up and resumes. Use `redirect` for the catch-up read. Caption: on reconnect the client catches up from the op log since its last version, then resumes live editing.

**Step 5: Register** all five in `mdx-components.tsx`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/collaborative-doc-editor-architecture.tsx components/diagrams/collab-editor-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add collaborative doc editor architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "six tutorials" tests to
"seven".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/collaborative-doc-editor.mdx` (skeleton).

IMPORTANT: there are currently SIX available tutorials (url-shortener, rate-limiter, pastebin, notification-service, video-streaming, ticket-booking). You add a SEVENTH. Note `collaborative-doc-editor` is sequence 22, so in the curriculum's available-by-sequence ordering it comes LAST (after ticket-booking, seq 16). Read each test file BEFORE editing to match its exact phrasing.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all SEVEN tutorials are registered (`Object.keys(tutorials).sort()` will include `collaborative-doc-editor` first alphabetically) and `collaborative-doc-editor` has 18 sections. Keep the "returns undefined for unregistered" slug as a still-missing one like `distributed-cache` (still coming-soon).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "video-streaming", "ticket-booking", "collaborative-doc-editor"]`; assert `getProblem("collaborative-doc-editor")?.title === "Collaborative Document Editor"`.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `collaborative-doc-editor` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add:
```ts
"collaborative-doc-editor": {
  slug: "collaborative-doc-editor",
  title: "Design a Collaborative Document Editor",
  description:
    "An interview-grade walkthrough of a real-time collaborative document editor: concurrent editing without lost updates, operational transformation versus CRDTs, the real-time websocket sync protocol with optimistic local apply, presence and awareness, op-log persistence and history, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["CRDT / OT", "Real-time sync", "Conflict-free merge", "Presence"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "concurrent-editing", label: "The Concurrent-Editing Problem", depth: "advanced" },
    { id: "operational-transformation", label: "Operational Transformation", depth: "advanced" },
    { id: "crdts", label: "Conflict-Free Replicated Data Types", depth: "advanced" },
    { id: "realtime-sync", label: "Real-Time Sync", depth: "advanced" },
    { id: "presence-awareness", label: "Presence & Awareness", depth: "advanced" },
    { id: "persistence-history", label: "Persistence & History", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import CollaborativeDocEditorContent from "@/content/tutorials/collaborative-doc-editor.mdx";` and `"collaborative-doc-editor": CollaborativeDocEditorContent,` to the content map.

**Step 7:** Create `content/tutorials/collaborative-doc-editor.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/collaborative-doc-editor
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/collaborative-doc-editor.mdx
git commit -m "feat: register collaborative doc editor tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus, orchestrator)

Replace the skeleton's first nine sections (framing → operational transformation) with
complete content embedding the components from Tasks 1–2. Authored by the orchestrator.
Per spec section notes 1–9, in particular:
- `capacity-estimates` — `<CollaborativeDocEditorCapacity assumptions={{ peakConcurrentEditors: 2000000, opsPerEditorPerSecond: 2, collaboratorsPerDoc: 4, bytesPerOp: 100, dailyEditedDocs: 5000000, opsPerDocPerDay: 2000 }} />` then read off the fan-out + connections + op-log lessons.
- `entity-model` — `EntityModel name="Document"` + prose on Operation, Snapshot, Presence.
- `api-design` — `ApiContract` for `POST /v1/documents` and the `WS /v1/documents/{id}/connect` channel; note the `GET .../operations?since=` catch-up read.
- `high-level-architecture` — `<CollaborativeDocEditorArchitecture />` + component prose.
- `detailed-flows` — `<EditBroadcastSequence />`, `<ConflictResolutionSequence />`, `<PresenceSequence />`, `<ReconnectSyncSequence />` with prose.
- `concurrent-editing` — why last-write-wins/locking fail; convergence + intention preservation; include a `<KnowledgeCheck>`.
- `operational-transformation` — ops + server-assigned order + transform; include a `<KnowledgeCheck>`.

End: `npm run build` compiles; `npm test` green. Commit `content: author collaborative doc editor sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus, orchestrator)

Complete the tutorial (CRDTs → FAQ) and add the structural content test. Per spec notes
10–18, including a `TradeoffTable` for scaling stages, a `FailureMatrix` with ≥ 6 rows, a
`DecisionRecord`, ≥ 6 `<KnowledgeCheck>` total (distributed through the deep-dive sections
too), and one `<Faq items={[...]} />` with ≥ 12 entries.

Then create `tests/collaborative-doc-editor-content.test.ts` (mirror `tests/video-streaming-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<CollaborativeDocEditorCapacity`, `<CollaborativeDocEditorArchitecture`, and the four sequences `<EditBroadcastSequence`, `<ConflictResolutionSequence`, `<PresenceSequence`, `<ReconnectSyncSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test -- tests/collaborative-doc-editor-content.test.ts` and `npm run build` pass.
Commit `content: complete collaborative doc editor tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 18), and run
full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 19 to 18 (seven tutorials now available) and add:
```ts
test("learner can open the collaborative doc editor tutorial", async ({ page }) => {
  await page.goto("/learn/collaborative-doc-editor");
  await expect(
    page.getByRole("heading", { name: /design a collaborative document editor/i }),
  ).toBeVisible();
  await page.goto("/learn/collaborative-doc-editor#crdts");
  await expect(page.locator("#crdts")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /collaborative (document )?editor architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link issue.) Verify the actual current count in the file and decrement by one if it differs from 19.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify collaborative doc editor tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/video-streaming.mdx` and `ticket-booking.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — op append / route / snapshot write), `redirect` (green — read / catch-up / broadcast-back / success), `async` (violet dashed — pub/sub fan-out), `control` (amber dashed — ephemeral presence / failure), `muted` (telemetry dotted), `ingress` (plain — client edit). Node kinds: `infra` for the editor, `service` for WS gateway and collaboration service, `queue` for pub/sub, `store` for op log / snapshot store / metadata DB, `cache` for the presence service.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep the asserted phrase "converge" in the caption only; distinct node labels).
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/collaborative-doc-editor-estimates.test.ts`.
