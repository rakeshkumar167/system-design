# Pastebin Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the third complete curriculum tutorial — an interview-grade walkthrough of designing a Pastebin (large-blob storage, expiry/TTL, CDN delivery, privacy) — reusing the existing tutorial infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the URL Shortener and Rate Limiter tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram, four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing themes vs. the URL Shortener are the **blob/metadata storage split**, **expiry/TTL**, **CDN delivery of immutable content**, and **access control**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces (knowledge checks) progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the rendered URL Shortener or Rate Limiter tutorials.
- Content lives in **object storage**, metadata in a **database**; content is **immutable** (the basis for CDN caching); expiry is **lazy + active**; expired reads are **410 Gone**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                         # MODIFY: register pastebin MDX
├── components/
│   ├── diagrams/
│   │   ├── pastebin-architecture.tsx                 # NEW: HLD (CDN, app, metadata DB, object storage, expiry worker)
│   │   └── paste-flows.tsx                           # NEW: create / read-hit / read-miss / expiry sequences
│   └── learning/
│       └── pastebin-capacity.tsx                     # NEW: pastebin wrapper over CapacityTable
├── content/tutorials/pastebin.mdx                    # NEW: full tutorial content
├── lib/
│   ├── pastebin-estimates.ts                         # NEW: pure capacity calc
│   ├── tutorial-registry.ts                          # MODIFY: add pastebin entry (18 sections)
│   └── curriculum.ts                                 # MODIFY: flip pastebin to available
├── mdx-components.tsx                                # MODIFY: register new components
├── tests/
│   ├── pastebin-estimates.test.ts                    # NEW
│   ├── pastebin-content.test.ts                      # NEW
│   ├── diagrams.test.tsx                             # MODIFY: pastebin diagram assertions
│   ├── tutorial-registry.test.ts                     # MODIFY: three tutorials
│   └── curriculum.test.ts                            # MODIFY: three available problems
└── e2e/pilot.spec.ts                                 # MODIFY: pastebin flow + count 23→22
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Pastebin capacity calculation and a thin wrapper over the existing shared
`CapacityTable`.

**Files:**
- Create: `lib/pastebin-estimates.ts`
- Test: `tests/pastebin-estimates.test.ts`
- Create: `components/learning/pastebin-capacity.tsx`
- Modify: `mdx-components.tsx`

**Step 1: Write the failing calculation test**
```ts
// tests/pastebin-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculatePastebinCapacity } from "@/lib/pastebin-estimates";

describe("calculatePastebinCapacity", () => {
  const result = calculatePastebinCapacity({
    newPastesPerMonth: 30_000_000,
    readWriteRatio: 10,
    peakMultiplier: 5,
    avgPasteSizeKb: 10,
    retentionYears: 2,
    metadataBytesPerPaste: 400,
  });

  it("derives average write QPS from monthly volume", () => {
    expect(result.averageWriteQps).toBeCloseTo(11.57, 2);
  });
  it("derives read QPS from the read:write ratio", () => {
    expect(result.averageReadQps).toBeCloseTo(115.74, 1);
  });
  it("derives peak read QPS", () => {
    expect(result.peakReadQps).toBeCloseTo(578.7, 1);
  });
  it("derives the total retained paste count", () => {
    expect(result.totalPastes).toBe(720_000_000);
  });
  it("derives blob (content) storage in TB", () => {
    expect(result.blobStorageTB).toBeCloseTo(7.2, 3);
  });
  it("derives metadata storage in GB", () => {
    expect(result.metadataStorageGB).toBeCloseTo(288, 3);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/pastebin-estimates.test.ts` (module missing).

**Step 3: Implement** `lib/pastebin-estimates.ts`, mirroring `url-shortener-estimates.ts`:
```ts
export interface PastebinCapacityAssumptions {
  /** New pastes created per month. */
  newPastesPerMonth: number;
  /** Read requests per create (write). */
  readWriteRatio: number;
  /** Peak-to-average traffic multiplier. */
  peakMultiplier: number;
  /** Average paste content size, in KB (decimal: 1 KB = 1000 bytes). */
  avgPasteSizeKb: number;
  /** Effective retention horizon for stored (unexpired) pastes, in years. */
  retentionYears: number;
  /** Metadata bytes per paste (row + indexes), excluding the blob. */
  metadataBytesPerPaste: number;
}

export interface PastebinCapacityResults {
  averageWriteQps: number;
  averageReadQps: number;
  peakReadQps: number;
  totalPastes: number;
  blobStorageTB: number;
  metadataStorageGB: number;
}

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. Storage uses decimal units
 * (TB = 10^12 bytes, GB = 10^9 bytes, KB = 10^3 bytes), as cloud storage is billed.
 */
export function calculatePastebinCapacity(
  a: PastebinCapacityAssumptions,
): PastebinCapacityResults {
  const averageWriteQps = a.newPastesPerMonth / SECONDS_PER_MONTH;
  const averageReadQps = averageWriteQps * a.readWriteRatio;
  const peakReadQps = averageReadQps * a.peakMultiplier;

  const totalPastes = a.newPastesPerMonth * a.retentionYears * 12;
  const blobStorageTB = (totalPastes * a.avgPasteSizeKb * 1e3) / 1e12;
  const metadataStorageGB = (totalPastes * a.metadataBytesPerPaste) / 1e9;

  return {
    averageWriteQps,
    averageReadQps,
    peakReadQps,
    totalPastes,
    blobStorageTB,
    metadataStorageGB,
  };
}
```

**Step 4: Run to verify it passes** (6 tests).

**Step 5: Create the wrapper** `components/learning/pastebin-capacity.tsx`, mirroring
`components/learning/rate-limiter-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculatePastebinCapacity,
  type PastebinCapacityAssumptions,
} from "@/lib/pastebin-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PastebinCapacity({
  assumptions,
}: {
  assumptions: PastebinCapacityAssumptions;
}) {
  const r = calculatePastebinCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New pastes / month", value: fmt(assumptions.newPastesPerMonth) },
    { label: "Read : write ratio", value: `${fmt(assumptions.readWriteRatio)}:1` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Avg paste size", value: `${fmt(assumptions.avgPasteSizeKb)} KB` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
    { label: "Bytes / metadata row", value: `${fmt(assumptions.metadataBytesPerPaste)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Average write QPS", value: fmt(r.averageWriteQps), consequence: "Writes are light — a single partitioned database absorbs ingest comfortably." },
    { label: "Average read QPS", value: fmt(r.averageReadQps), consequence: "Reads dominate writes 10×; the read path is what we cache and scale." },
    { label: "Peak read QPS", value: fmt(r.peakReadQps), consequence: "Provision for peak. A CDN serves most of this so the origin sees a fraction." },
    { label: "Total stored pastes", value: fmt(r.totalPastes), consequence: "Hundreds of millions of objects — too many for one node, so metadata partitions." },
    { label: "Content (blob) storage", value: `${fmt(r.blobStorageTB, 1)} TB`, consequence: "Content dominates by ~25× even at 10 KB; it belongs in object storage, not the DB." },
    { label: "Metadata storage", value: `${fmt(r.metadataStorageGB)} GB`, consequence: "Tiny beside the blobs; pointers + attributes fit in a partitioned database." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `PastebinCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/pastebin-estimates.test.ts tests/url-shortener-estimates.test.ts tests/rate-limiter-estimates.test.ts
npm run typecheck && npm run lint
git add lib/pastebin-estimates.ts tests/pastebin-estimates.test.ts components/learning/pastebin-capacity.tsx mdx-components.tsx
git commit -m "feat: add pastebin capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives in
`components/diagrams/diagram-primitives.tsx` and framed by `DiagramFrame`. Mirror
`components/diagrams/architecture-diagram.tsx` (for the HLD) and
`components/diagrams/request-flow-diagrams.tsx` (for the sequences) exactly — do not
invent new SVG conventions.

**Files:**
- Create: `components/diagrams/pastebin-architecture.tsx`
- Create: `components/diagrams/paste-flows.tsx`
- Modify: `tests/diagrams.test.tsx`
- Modify: `mdx-components.tsx`

**Step 1: Write failing diagram tests** — append to `tests/diagrams.test.tsx`:
```tsx
import { PastebinArchitecture } from "@/components/diagrams/pastebin-architecture";
import {
  CreatePasteSequence,
  ReadCacheHitSequence,
  ReadCacheMissSequence,
  ExpirySequence,
} from "@/components/diagrams/paste-flows";

describe("PastebinArchitecture", () => {
  it("exposes the pastebin architecture to non-visual readers", () => {
    render(<PastebinArchitecture />);
    expect(
      screen.getByRole("img", { name: /pastebin architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/object storage/i)).toBeInTheDocument();
  });
});

describe("paste flow sequences", () => {
  it("renders the create, read-hit, read-miss, and expiry sequences", () => {
    render(<CreatePasteSequence />);
    expect(screen.getByRole("img", { name: /creat/i })).toBeInTheDocument();
    render(<ReadCacheHitSequence />);
    expect(screen.getByRole("img", { name: /cache hit/i })).toBeInTheDocument();
    render(<ReadCacheMissSequence />);
    expect(screen.getByRole("img", { name: /cache miss/i })).toBeInTheDocument();
    render(<ExpirySequence />);
    expect(screen.getByRole("img", { name: /expir/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx` (modules missing).

**Step 3: Implement the architecture diagram** `components/diagrams/pastebin-architecture.tsx`
following the exact pattern of `architecture-diagram.tsx` (a `const N` node-geometry
map, `DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before
nodes, a `Legend`). It must show:
- `Client` → `CDN` (cache kind) → `App / API` (service) for reads.
- `App / API` → `Metadata DB` (store) for paste attributes/expiry/visibility.
- `App / API` → `Object Storage` (store) for the blob content; reads fetch the blob and backfill the CDN.
- An `Expiry Worker` (queue/service kind) that sweeps the `Metadata DB` and deletes expired blobs from `Object Storage` (use an `async` or `control` variant edge).
- `title` contains "Pastebin architecture"; `caption` names **object storage**, **metadata**, **CDN**, and **expiry** and explains the immutable-content/CDN and blob/metadata-split behavior in prose.

**Step 4: Implement the flow sequences** `components/diagrams/paste-flows.tsx`, exporting
four components. Reuse the local `Sequence`/`StepLabel` structure from
`request-flow-diagrams.tsx` (copy the helper into this file or factor it — copying is
acceptable and matches the existing pattern). Each `title` contains the keyword the
test matches:
- `CreatePasteSequence` — title contains "creat"; actors Client, App/API, Object Storage, Metadata DB; steps: `POST /v1/pastes`, write blob to object storage (returns blob_key), write metadata row (id, blob_key, expiry, visibility), `201 {id, url}`. Content is written **before** metadata so a committed metadata row always points to a real blob.
- `ReadCacheHitSequence` — title contains "cache hit"; actors Client, CDN; steps: `GET /{id}/raw`, CDN edge hit → returns immutable content. Caption: most reads end here.
- `ReadCacheMissSequence` — title contains "cache miss"; actors Client, CDN, App/API, Metadata DB, Object Storage; steps: `GET /{id}/raw`, CDN miss, app reads metadata (check expiry + visibility), fetch blob from object storage, return + CDN backfill with TTL.
- `ExpirySequence` — title contains "expir"; show both lazy and active deletion: a read of an expired paste returns `410 Gone` (lazy, app checks `expires_at`), and an Expiry Worker actively deletes the metadata row and the object-storage blob. Actors: Client, App/API, Metadata DB, Object Storage (+ Expiry Worker as an actor, or a self-step). Use `control` variant for the 410 / delete edges.

**Step 5: Register in MDX** — in `mdx-components.tsx` import and add to
`teachingComponents`: `PastebinArchitecture`, `CreatePasteSequence`,
`ReadCacheHitSequence`, `ReadCacheMissSequence`, `ExpirySequence`.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/pastebin-architecture.tsx components/diagrams/paste-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add pastebin architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, and add a
compiling MDX skeleton with all 18 section ids. Update the two existing tests that
assert "two tutorials". Ends with the route building and statically generating.

**Files:**
- Modify: `lib/tutorial-registry.ts`
- Modify: `lib/curriculum.ts`
- Modify: `tests/tutorial-registry.test.ts`
- Modify: `tests/curriculum.test.ts`
- Modify: `app/learn/[slug]/page.tsx`
- Create: `content/tutorials/pastebin.mdx` (skeleton)

**Step 1: Update the registry test for three tutorials.** Adjust the existing
"registers ..." and section-count assertions to include `pastebin` (18 sections), and
change the "returns undefined for unregistered" slug from `pastebin` to a still-missing
one like `notification-service`. Read the current file first; match its exact phrasing.

**Step 2: Update the curriculum test for three available problems.** The available
slugs become `["url-shortener", "rate-limiter", "pastebin"]`; assert
`getProblem("pastebin")?.title` is `"Pastebin"`.

**Step 3: Run both to verify they fail.**

**Step 4: Flip the curriculum status** — in `lib/curriculum.ts` change the `pastebin`
entry `status` from `"coming-soon"` to `"available"` (leave sequence/summary/concepts).

**Step 5: Add the registry entry** to `lib/tutorial-registry.ts`:
```ts
"pastebin": {
  slug: "pastebin",
  title: "Design a Pastebin",
  description:
    "An interview-grade walkthrough of a Pastebin: storing large text blobs in object storage with metadata in a database, expiry and TTL, CDN delivery of immutable content, privacy and access control, scaling, and failure modes.",
  difficulty: "Foundational",
  readingMinutes: 32,
  concepts: ["Blob storage", "TTL & expiry", "CDN", "Access control"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "blob-metadata-split", label: "Blob & Metadata Storage", depth: "advanced" },
    { id: "expiry-and-ttl", label: "Expiry & TTL", depth: "advanced" },
    { id: "caching-cdn", label: "Caching & CDN", depth: "advanced" },
    { id: "access-control", label: "Access Control & Privacy", depth: "advanced" },
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

**Step 6: Wire the route** — in `app/learn/[slug]/page.tsx` add
`import PastebinContent from "@/content/tutorials/pastebin.mdx";` and the
`"pastebin": PastebinContent` entry in the `content` map.

**Step 7: Create the compiling MDX skeleton** `content/tutorials/pastebin.mdx` with all
18 `h2` headings in order (matching the ids above), each with one placeholder sentence.

**Step 8: Verify route builds and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/pastebin.mdx
git commit -m "feat: register pastebin tutorial route and skeleton"
```

---

### Task 4: Author Content — Sections 1–9 (Opus)

Replace the skeleton's first nine sections (framing → expiry) with complete,
technically consistent content embedding the components from Tasks 1–2. Authored by
the orchestrator (Opus). Verification is the production build.

Required embeds/substance per the design spec section notes (1–9), in particular:
- `interview-framing` — `Callout variant="interview"` 45-min allocation; in/out-of-scope.
- `requirements` — `RequirementsTable` (functional + non-functional with the targets in the spec).
- `capacity-estimates` — `<PastebinCapacity assumptions={{ newPastesPerMonth: 30000000, readWriteRatio: 10, peakMultiplier: 5, avgPasteSizeKb: 10, retentionYears: 2, metadataBytesPerPaste: 400 }} />` then read off the blob-vs-metadata lesson.
- `entity-model` — `EntityModel name="Paste"` (id, blob_key, owner_id, visibility, expires_at, one_time, created_at, size_bytes, language).
- `api-design` — `ApiContract` for create, read, raw, and the 404/410/403 responses.
- `high-level-architecture` — `<PastebinArchitecture />` + component prose.
- `detailed-flows` — `<CreatePasteSequence />`, `<ReadCacheHitSequence />`, `<ReadCacheMissSequence />`, `<ExpirySequence />` with prose.
- `blob-metadata-split` — why content→object storage, metadata→DB; pointer indirection.
- `expiry-and-ttl` — lazy + active deletion, one-time burn-after-read atomic read-and-delete.

End: `npm run build` compiles the MDX with real embeds; `npm test` still green (content test arrives in Task 5). Commit `content: author pastebin sections 1-9`.

---

### Task 5: Author Content — Sections 10–18 + Content Test (Opus)

Complete the tutorial (caching/CDN → FAQ) and add the structural content test.

Sections 10–18 per the spec notes, including:
- `caching-cdn` — immutable content, long edge TTLs, invalidation on expiry, negative caching, private bypass.
- `access-control` — public/unlisted/private/password; unlisted relies on id entropy; private bypasses shared CDN; signed URLs.
- `scalability-evolution` — `TradeoffTable` of four stages (columns Stage, Trigger, Cost).
- `resiliency-failure-modes` — `FailureMatrix` with ≥ 6 rows (object-storage outage, metadata-DB outage, CDN stale/outage, expiry-worker lag, hot paste, region loss, partial write).
- `security-abuse` — size limits, secret/malware scanning, spam/phishing + takedown, stored-XSS (serve raw as text/plain), id enumeration.
- `observability` — read latency, CDN hit ratio, expiry backlog/storage growth, 404/410 rates.
- `tradeoffs-alternatives` — `DecisionRecord` + axes prose.
- `interview-summary` — `Callout variant="interview"` 60-second answer + follow-ups.
- `knowledge-checks-faq` — **≥ 6** `<KnowledgeCheck>` and one `<Faq items={[...]} />` with **≥ 12** `{ question, answer }` entries. (Distribute a few `KnowledgeCheck`s earlier in the deep-dive sections too, like the rate-limiter tutorial does.)

Then create `tests/pastebin-content.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/pastebin.mdx", "utf8");

const requiredIds = [
  "interview-framing", "requirements", "capacity-estimates", "entity-model",
  "api-design", "high-level-architecture", "detailed-flows", "blob-metadata-split",
  "expiry-and-ttl", "caching-cdn", "access-control", "scalability-evolution",
  "resiliency-failure-modes", "security-abuse", "observability",
  "tradeoffs-alternatives", "interview-summary", "knowledge-checks-faq",
];

describe("Pastebin content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) expect(content).toContain(`id="${id}"`);
  });
  it("embeds the capacity model and architecture diagram", () => {
    for (const tag of ["<PastebinCapacity", "<PastebinArchitecture"]) {
      expect(content).toContain(tag);
    }
  });
  it("embeds the flow sequence diagrams", () => {
    for (const tag of ["<CreatePasteSequence", "<ReadCacheHitSequence", "<ReadCacheMissSequence", "<ExpirySequence"]) {
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

End: `npm test -- tests/pastebin-content.test.ts` and `npm run build` pass. Commit
`content: complete pastebin tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite to cover the pastebin path, fix the curriculum
"Coming soon" count (now 22), and run the full verification suite.

**Files:**
- Modify: `e2e/pilot.spec.ts`
- Modify: any component only if browser verification exposes a real defect

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count assertion
from 23 to 22 (three tutorials now available) and add:
```ts
test("learner can open the pastebin tutorial", async ({ page }) => {
  await page.goto("/learn/pastebin");
  await expect(
    page.getByRole("heading", { name: /design a pastebin/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^expiry & ttl$/i }).click();
  await expect(page.locator("#expiry-and-ttl")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /pastebin architecture/i }).first(),
  ).toBeVisible();
});
```
If a TOC link label differs, match the actual `label` from the registry; adjust the
selector, not the content.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals
(overflow at 390 px, anchors hidden by sticky header, invisible focus, unreadable
dark-mode diagram labels).

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify pastebin tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/rate-limiter.mdx` and `url-shortener.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent), `redirect` (green, used for the read path), `async` (violet dashed), `control` (amber dashed — use for expiry/delete/410), `muted` (telemetry dotted), `ingress` (plain).
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/pastebin-estimates.test.ts`.
