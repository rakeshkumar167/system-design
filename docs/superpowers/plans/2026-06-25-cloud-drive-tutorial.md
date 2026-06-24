# Cloud Drive Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the ninth complete curriculum tutorial — an Advanced, file-sync / object-storage walkthrough of a Cloud Drive (Dropbox / Google Drive style): chunking and content-addressed deduplication, delta sync, the cursor + notification sync protocol, the metadata/block split, sharing/permissions, and versioning — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the first eight tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes are the **metadata/block split**, **chunking + dedup**, **delta sync**, and the **cursor + notification sync protocol**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the eight existing tutorials.
- Invariants: content lives in **object storage** addressed by **content hash**; metadata (namespace tree, versions, ACLs, block lists) lives in a separate **sharded transactional** store — the **metadata/block split** is the defining decision. Files are split into **chunks** (content-defined chunking), each unique block **stored once** (**dedup**); a **FileVersion** is an immutable **ordered list of block hashes**. **Delta sync** transfers only changed chunks. Devices converge via a **cursor / change journal** + a **notification** channel; concurrent offline edits become a **conflicted copy** (never lost), not an operational merge. The top bar is **durability**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                            # MODIFY: register cloud-drive MDX
├── components/
│   ├── diagrams/
│   │   ├── cloud-drive-architecture.tsx                 # NEW: HLD (client, sync gateway, metadata svc/DB, block svc/object store, notification)
│   │   └── cloud-drive-flows.tsx                         # NEW: upload / delta-sync / change-notification / conflict sequences
│   └── learning/
│       └── cloud-drive-capacity.tsx                      # NEW: wrapper over CapacityTable
├── content/tutorials/cloud-drive.mdx                    # NEW: full tutorial content
├── lib/
│   ├── cloud-drive-estimates.ts                          # NEW: pure capacity calc
│   ├── tutorial-registry.ts                              # MODIFY: add cloud-drive entry (18 sections)
│   └── curriculum.ts                                     # MODIFY: flip cloud-drive to available
├── mdx-components.tsx                                    # MODIFY: register new components
├── tests/
│   ├── cloud-drive-estimates.test.ts                     # NEW
│   ├── cloud-drive-content.test.ts                       # NEW
│   ├── diagrams.test.tsx                                 # MODIFY: cloud-drive diagram assertions
│   ├── tutorial-registry.test.ts                         # MODIFY: nine tutorials
│   └── curriculum.test.ts                                # MODIFY: nine available problems (cloud-drive appends at seq 23, last)
└── e2e/pilot.spec.ts                                    # MODIFY: cloud-drive flow + coming-soon count 17→16
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Cloud Drive capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/cloud-drive-estimates.ts`, `tests/cloud-drive-estimates.test.ts`, `components/learning/cloud-drive-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/cloud-drive-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateCloudDriveCapacity } from "@/lib/cloud-drive-estimates";

describe("calculateCloudDriveCapacity", () => {
  const result = calculateCloudDriveCapacity({
    totalUsers: 500_000_000,
    avgStorageGbPerUser: 10,
    dedupRatio: 0.3,
    dailyActiveUsers: 50_000_000,
    avgDailyEditsPerActiveUser: 100,
    avgEditBytes: 4_000_000,
    deltaSyncFraction: 0.1,
  });

  it("derives the raw stored bytes in EB", () => {
    expect(result.rawStorageEb).toBe(5);
  });
  it("derives the physical storage after dedup in EB", () => {
    expect(result.physicalStorageEb).toBeCloseTo(3.5, 5);
  });
  it("derives the metadata write QPS", () => {
    expect(result.metadataWritesPerSecond).toBeCloseTo(57870.37, 1);
  });
  it("derives the naive (whole-file) upload bandwidth in GB/s", () => {
    expect(result.naiveUploadGbPerSecond).toBeCloseTo(231.48, 1);
  });
  it("derives the delta-sync upload bandwidth in GB/s", () => {
    expect(result.deltaUploadGbPerSecond).toBeCloseTo(23.15, 1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/cloud-drive-estimates.test.ts`.

**Step 3: Implement** `lib/cloud-drive-estimates.ts`:
```ts
const BYTES_PER_GB = 1_000_000_000;
const BYTES_PER_EB = 1_000_000_000_000_000_000;
const SECONDS_PER_DAY = 86_400;

export interface CloudDriveCapacityAssumptions {
  /** Total registered users. */
  totalUsers: number;
  /** Average stored bytes per user, in GB (pre-dedup). */
  avgStorageGbPerUser: number;
  /** Fraction of raw bytes removed by deduplication (0..1). */
  dedupRatio: number;
  /** Users active on a given day. */
  dailyActiveUsers: number;
  /** Average file edits (commits) per active user per day. */
  avgDailyEditsPerActiveUser: number;
  /** Average bytes in an edited file. */
  avgEditBytes: number;
  /** Fraction of an edited file's bytes actually transferred under delta sync (0..1). */
  deltaSyncFraction: number;
}

export interface CloudDriveCapacityResults {
  rawStorageEb: number;
  physicalStorageEb: number;
  metadataWritesPerSecond: number;
  naiveUploadGbPerSecond: number;
  deltaUploadGbPerSecond: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: raw storage is exabyte-scale
 * (so content belongs in object storage, not a database), deduplication removes a large
 * slice of it, metadata is tiny in bytes but high-QPS (a separate sharded store), and delta
 * sync cuts upload bandwidth by ~10× versus re-sending whole files.
 */
export function calculateCloudDriveCapacity(
  a: CloudDriveCapacityAssumptions,
): CloudDriveCapacityResults {
  const rawBytes = a.totalUsers * a.avgStorageGbPerUser * BYTES_PER_GB;
  const rawStorageEb = rawBytes / BYTES_PER_EB;
  const physicalStorageEb = rawStorageEb * (1 - a.dedupRatio);
  const metadataWritesPerSecond =
    (a.dailyActiveUsers * a.avgDailyEditsPerActiveUser) / SECONDS_PER_DAY;
  const naiveUploadGbPerSecond =
    (metadataWritesPerSecond * a.avgEditBytes) / BYTES_PER_GB;
  const deltaUploadGbPerSecond = naiveUploadGbPerSecond * a.deltaSyncFraction;

  return {
    rawStorageEb,
    physicalStorageEb,
    metadataWritesPerSecond,
    naiveUploadGbPerSecond,
    deltaUploadGbPerSecond,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/cloud-drive-capacity.tsx`, mirroring
`components/learning/distributed-cache-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateCloudDriveCapacity,
  type CloudDriveCapacityAssumptions,
} from "@/lib/cloud-drive-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CloudDriveCapacity({
  assumptions,
}: {
  assumptions: CloudDriveCapacityAssumptions;
}) {
  const r = calculateCloudDriveCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Total users", value: fmt(assumptions.totalUsers) },
    { label: "Storage / user", value: `${fmt(assumptions.avgStorageGbPerUser)} GB` },
    { label: "Dedup ratio", value: `${fmt(assumptions.dedupRatio * 100)}%` },
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Edits / active user / day", value: fmt(assumptions.avgDailyEditsPerActiveUser) },
    { label: "Avg edited file", value: `${fmt(assumptions.avgEditBytes / 1_000_000)} MB` },
    { label: "Delta-sync fraction", value: `${fmt(assumptions.deltaSyncFraction * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Raw stored data", value: `${fmt(r.rawStorageEb, 1)} EB`, consequence: "Exabyte scale — content must live in object storage, never a database." },
    { label: "After deduplication", value: `${fmt(r.physicalStorageEb, 1)} EB`, consequence: "Storing each unique block once removes a large slice of the bill — dedup is load-bearing, not an optimization." },
    { label: "Metadata writes / sec", value: fmt(r.metadataWritesPerSecond), consequence: "Metadata is tiny in bytes but high-QPS — it needs a separate, sharded, transactional store, split from the blocks." },
    { label: "Naive upload bandwidth", value: `${fmt(r.naiveUploadGbPerSecond)} GB/s`, consequence: "If every edit re-sent the whole file, ingress bandwidth would be enormous." },
    { label: "Delta-sync bandwidth", value: `${fmt(r.deltaUploadGbPerSecond)} GB/s`, consequence: "Sending only changed chunks cuts upload bandwidth ~10× — the reason chunking + delta sync exist." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `CloudDriveCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/cloud-drive-estimates.test.ts tests/distributed-cache-estimates.test.ts
npm run typecheck && npm run lint
git add lib/cloud-drive-estimates.ts tests/cloud-drive-estimates.test.ts components/learning/cloud-drive-capacity.tsx mdx-components.tsx
git commit -m "feat: add cloud drive capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/distributed-cache-architecture.tsx` (HLD) and
`components/diagrams/cache-flows.tsx` (sequences) — do not invent new SVG conventions.

**Files:** Create `components/diagrams/cloud-drive-architecture.tsx`, `components/diagrams/cloud-drive-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { CloudDriveArchitecture } from "@/components/diagrams/cloud-drive-architecture";
import {
  FileUploadSequence,
  DeltaSyncSequence,
  ChangeNotificationSequence,
  ConflictSequence,
} from "@/components/diagrams/cloud-drive-flows";

describe("CloudDriveArchitecture", () => {
  it("exposes the cloud drive architecture to non-visual readers", () => {
    render(<CloudDriveArchitecture />);
    expect(
      screen.getByRole("img", { name: /cloud drive architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/content-addressed/i)).toBeInTheDocument();
  });
});

describe("cloud drive flow sequences", () => {
  it("renders the upload, delta-sync, notification, and conflict sequences", () => {
    render(<FileUploadSequence />);
    expect(screen.getByRole("img", { name: /upload/i })).toBeInTheDocument();
    render(<DeltaSyncSequence />);
    expect(screen.getByRole("img", { name: /delta/i })).toBeInTheDocument();
    render(<ChangeNotificationSequence />);
    expect(screen.getByRole("img", { name: /notif|push|fan/i })).toBeInTheDocument();
    render(<ConflictSequence />);
    expect(screen.getByRole("img", { name: /conflict/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"content-addressed"** in the
**caption only** (NOT in any node label and NOT in the `DiagramFrame` title, which renders as
an SVG `<title>` that `getByText` also matches). Use a node sublabel like "chunk dedup"
(which `/content-addressed/i` does NOT match). Also: all four flow titles are rendered into
the same DOM in one test, so each regex must match exactly one title — use distinct title
keywords ("upload", "delta", "notification", "conflict") and do NOT let "sync"/"push"/"fan"
appear in more than one title.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `cloud-drive-architecture.tsx` exporting
`CloudDriveArchitecture`, following the `distributed-cache-architecture.tsx` pattern (a `const N`
node-geometry map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges
before nodes, a `Legend`). It must show:
- `Client` (infra, sublabel "watcher + chunker") → `Sync Gateway` (service) via `ingress` ("upload / sync").
- `Sync Gateway` → `Metadata Service` (service, sublabel "namespace + versions") via `redirect` ("commit metadata").
- `Sync Gateway` → `Block Service` (service, sublabel "chunk dedup") via `create` ("put new blocks").
- `Metadata Service` → `Metadata DB` (store, sublabel "tree / versions / ACLs") via `create` ("persist tree").
- `Block Service` → `Block Storage` (store, sublabel "object store") via `create` ("store unique blocks").
- `Metadata Service` → `Notification Svc` (queue, sublabel "device fan-out") via `async` ("change event").
- `Notification Svc` → `Client` via `async` ("notify other devices").
- `title` contains "Cloud drive architecture"; `caption` names the **metadata/block split**,
  **content-addressed** deduplication, **delta sync**, and the notification path, and explains
  the two-plane story in prose. (Per the gotcha, keep "content-addressed" in the caption only;
  distinct node labels.)
- Node kinds: `infra` for the client, `service` for the gateway/metadata/block services,
  `queue` for the notification service, `store` for both the metadata DB and block storage.
- Suggested geometry (viewBox `0 0 820 480`): client {24,210}, syncGateway {200,210},
  metadataSvc {420,90}, blockSvc {420,330}, metadataDb {640,90}, blockStore {640,330},
  notification {200,370} — all `w` ≈ 140, `h` ≈ 56 (store `h` ≈ 60). Adjust to avoid overlaps.

**Step 4: Implement the flow sequences** `cloud-drive-flows.tsx`, exporting four components
(copy the `Sequence`/`StepLabel`/`Actor`/`Step` helpers from `cache-flows.tsx` verbatim).
Each `title` contains the keyword the test matches; keep the four keywords mutually exclusive:
- `FileUploadSequence` — title contains "upload" (e.g. "Sequence: file upload — chunk, dedup, then commit metadata"); actors Client, Block Service, Metadata Service; steps: chunk file + hash, ask which block hashes are missing (dedup check), upload only new blocks, commit version (block list + base version), ack. Caption: the file is chunked and content-hashed; only blocks the server lacks are uploaded (dedup), then a metadata commit publishes the new version.
- `DeltaSyncSequence` — title contains "delta" (e.g. "Sequence: delta sync — transfer only the changed chunks"); actors Client, Block Service, Metadata Service; steps: file edited locally, client diffs chunk list (few changed), upload only changed blocks, commit version referencing unchanged blocks by hash, ack. Caption: editing a large file transfers only changed chunks, not the whole file — the bandwidth win, and why content-defined chunking matters.
- `ChangeNotificationSequence` — title contains "notification" (e.g. "Sequence: change notification — fan-out and cursor catch-up"); actors Metadata Service, Notification Svc, Other Device; steps: commit raises a change event, notification service fans out to the user's devices, the other device pulls the metadata delta since its cursor, fetches new blocks, applies locally. Caption: after a commit, other devices are notified and pull only the metadata delta since their cursor, then fetch new blocks — convergence without full polling.
- `ConflictSequence` — title contains "conflict" (e.g. "Sequence: conflict — concurrent edits become a conflicted copy"); actors Device A, Metadata Service, Device B; steps: A and B both edit from base version N, A commits → N+1, B commits based on stale N, metadata service detects the stale base, B's commit becomes a conflicted copy, both versions preserved. Use `control` for the stale-detect. Caption: concurrent edits from the same base are detected by version; the loser becomes a conflicted copy so no edit is lost (unlike a collaborative editor's operational merge).

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/cloud-drive-architecture.tsx components/diagrams/cloud-drive-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add cloud drive architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX
skeleton with all 18 section ids, and update the two existing "eight tutorials" tests to
"nine".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/cloud-drive.mdx` (skeleton).

IMPORTANT: there are currently EIGHT available tutorials. You add a NINTH. `cloud-drive` is **sequence 23**, the highest of any available tutorial, so in the curriculum's available-by-sequence ordering it appends **at the end**, after `collaborative-doc-editor` (seq 22). Read each test file BEFORE editing to match its exact phrasing. Do NOT change the "returns undefined for unregistered" slug — it is currently `api-gateway`, which stays coming-soon, so that test remains valid.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all NINE tutorials are registered (add `"cloud-drive"` to the sorted `Object.keys` array — sorted, it goes first: `["cloud-drive", "collaborative-doc-editor", ...]`) and add `expect(getTutorial("cloud-drive")?.sections).toHaveLength(18);`. Update the two descriptive `it(...)` strings to mention Cloud Drive. Leave the `getTutorial("api-gateway")` undefined test as-is.

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order, `["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "collaborative-doc-editor", "cloud-drive"]` (cloud-drive is seq 23, appended last). Add `expect(getProblem("cloud-drive")?.title).toBe("Cloud Drive");`. Update the descriptive `it(...)` string.

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `cloud-drive` entry `status` from `"coming-soon"` to `"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add after the `collaborative-doc-editor` entry (before the closing `};`):
```ts
"cloud-drive": {
  slug: "cloud-drive",
  title: "Design a Cloud Drive",
  description:
    "An interview-grade walkthrough of a cloud drive (Dropbox / Google Drive style): the metadata/block split, chunking and content-addressed deduplication, delta sync, the cursor + notification sync protocol, the metadata store and namespace, sharing and permissions, versioning and history, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["Object storage", "Deduplication", "Delta sync", "Metadata"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "chunking-dedup", label: "Chunking & Deduplication", depth: "advanced" },
    { id: "delta-sync", label: "Delta Sync", depth: "advanced" },
    { id: "sync-protocol", label: "Sync Protocol & Notifications", depth: "advanced" },
    { id: "metadata-store", label: "Metadata Store & Namespace", depth: "advanced" },
    { id: "sharing-permissions", label: "Sharing & Permissions", depth: "advanced" },
    { id: "versioning-history", label: "Versioning & History", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add `import CloudDriveContent from "@/content/tutorials/cloud-drive.mdx";` and `"cloud-drive": CloudDriveContent,` to the content map.

**Step 7:** Create `content/tutorials/cloud-drive.mdx` skeleton with all 18 `<h2 id="...">Label</h2>` headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/cloud-drive
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/cloud-drive.mdx
git commit -m "feat: register cloud drive tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks
1–3, then installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have
registered the embedded components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<CloudDriveCapacity assumptions={{ totalUsers: 500000000, avgStorageGbPerUser: 10, dedupRatio: 0.3, dailyActiveUsers: 50000000, avgDailyEditsPerActiveUser: 100, avgEditBytes: 4000000, deltaSyncFraction: 0.1 }} />` then read off the raw-storage / dedup / metadata-QPS / delta-bandwidth lessons.
- `entity-model` — `EntityModel name="File"` (file id, path, owner, current version, size, block list) + prose on File/Namespace node, FileVersion (immutable block-hash list), Block (content-addressed, stored once), ShareACL.
- `api-design` — `ApiContract` for the two-phase write (`POST /blocks` dedup check + `POST /files/{path}/commit` with block list and base version) and `GET /delta?cursor=`.
- `high-level-architecture` — `<CloudDriveArchitecture />` + component prose.
- `detailed-flows` — `<FileUploadSequence />`, `<DeltaSyncSequence />`, `<ChangeNotificationSequence />`, `<ConflictSequence />` with prose.
- deep dives `chunking-dedup`, `delta-sync`, `sync-protocol`, `metadata-store`, `sharing-permissions`, `versioning-history` per spec, each with a `<KnowledgeCheck>` where noted.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/cloud-drive-content.test.ts` (mirror `tests/distributed-cache-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<CloudDriveCapacity`, `<CloudDriveArchitecture`, and the four sequences `<FileUploadSequence`, `<DeltaSyncSequence`, `<ChangeNotificationSequence`, `<ConflictSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with
real embeds and generates `/learn/cloud-drive`) all green. Commit `content: complete cloud drive tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 16), and run full
verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 17 to 16 (nine tutorials now available — verify the current value is 17 first) and add:
```ts
test("learner can open the cloud drive tutorial", async ({ page }) => {
  await page.goto("/learn/cloud-drive");
  await expect(
    page.getByRole("heading", { name: /design a cloud drive/i }),
  ).toBeVisible();
  await page.goto("/learn/cloud-drive#delta-sync");
  await expect(page.locator("#delta-sync")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /cloud drive architecture/i }).first(),
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

**Step 4:** Commit `test: verify cloud drive tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/distributed-cache.mdx` and `video-streaming.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — write / store / persist), `redirect` (green — read / commit-ack path), `async` (violet dashed — change event / notification), `control` (amber dashed — conflict / stale-detect), `muted` (telemetry dotted), `ingress` (plain — client request). Node kinds: `infra` for the client, `service` for gateway/metadata/block services, `queue` for the notification service, `store` for the metadata DB and block storage.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "content-addressed" in the caption only; distinct node labels; not in the title). All four flow titles render into one test DOM — keep the keywords "upload"/"delta"/"notification"/"conflict" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/cloud-drive-estimates.test.ts`.
- **cloud-drive is the LAST available by sequence (23).** It appends to the end of the curriculum available-list ordering — do not insert it mid-list.
