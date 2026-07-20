# Object Storage Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Object Storage** tutorial at `/learn/object-storage` (curriculum seq 12), reusing the tutorial pipeline. Mirror a recent tutorial (e.g. `metrics-monitoring` / `leaderboard`).

## Global Constraints

- Slug `object-storage`, difficulty **Advanced**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test `requiredIds`.
- New export names (`ObjectStorageCapacity`, `ObjectStorageArchitecture`, `PutObjectSequence`, `MultipartUploadSequence`, `GetObjectSequence`, `ScrubRepairSequence`) — grep `mdx-components.tsx` before registering.
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only**.
- E2e: direct fragment navigation; assert the diagram `img` before the in-viewport check; run `--workers=1`. **Decrement the "coming soon" count by one (13 → 12)**. Leave "showing 1 of 33" untouched.
- **`tests/tutorial-registry.test.ts` "returns undefined" slug is currently `object-storage` — repoint it to `photo-sharing`** (next coming-soon by sequence) since object-storage is now registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge unless asked.

---

### Task 1: Capacity model — `ObjectStorageCapacity`

**Files:** create `lib/object-storage-estimates.ts`, `tests/object-storage-estimates.test.ts`, `components/learning/object-storage-capacity.tsx`; modify `mdx-components.tsx`.

- [ ] `tests/object-storage-estimates.test.ts`: `logicalDataPb` 1000, `erasureStoredPb` 1500, `replicationStoredPb` 3000, `storageSavedPb` 1500, `fragmentFailuresTolerated` 4 — from `{ objectsStored: 1_000_000_000_000, avgObjectBytes: 1_000_000, dataShards: 8, parityShards: 4, replicationFactor: 3 }`.
- [ ] Implement `calculateObjectStorageCapacity(a)` (`BYTES_PER_PB`). Run → pass.
- [ ] `object-storage-capacity.tsx` wrapping `CapacityTable` (erasure-coding-vs-replication / durability-affordably story). Register `ObjectStorageCapacity`.
- [ ] `npm test -- object-storage-estimates` + typecheck green. Commit `feat: add Object Storage capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/object-storage-architecture.tsx` + `object-storage-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `ObjectStorageArchitecture` HLD: client → object API → metadata service + erasure coder → storage nodes (fragments across failure domains); scrubber/repair background. Caption keyword caption-only.
- [ ] Four flow sequences per spec (`PutObjectSequence`, `MultipartUploadSequence`, `GetObjectSequence`, `ScrubRepairSequence`), caption-only asserted keywords.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows). Register all 5.
- [ ] `npm test -- diagrams` + typecheck green. Commit `feat: add Object Storage architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create `content/tutorials/object-storage.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add `object-storage` `TutorialMeta` (title "Design Object Storage", difficulty "Advanced", readingMinutes ~36, concepts, 18 sections).
- [ ] `curriculum.ts`: flip `object-storage` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: import + map.
- [ ] `content/tutorials/object-storage.mdx`: skeleton — 18 `<h2 id>` + placeholder each.
- [ ] `tests/tutorial-registry.test.ts`: add `object-storage` to sorted keys (after `notification-service`, before `pastebin`) + `toHaveLength(18)`; **change the `returns undefined` slug from `object-storage` to `photo-sharing`**.
- [ ] `tests/curriculum.test.ts`: insert `"object-storage"` into the available list **after `video-streaming`, before `ticket-booking`** (seq 12).
- [ ] `npm test -- tutorial-registry curriculum` + typecheck + build green. Commit `feat: register Object Storage tutorial route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/tutorials/object-storage.mdx` (18 sections); create `tests/object-storage-content.test.ts`.

- [ ] Author all 18 sections per spec — match recent tutorial voice/density. Embed `<ObjectStorageCapacity assumptions={{…}} />` (exact = test), `<ObjectStorageArchitecture />` (sec 6), the four flows (sec 7 + scrub in sec 12), `RequirementsTable` (2), `EntityModel` (4), three `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15), `DecisionRecord` (16), two `Callout variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/object-storage-content.test.ts`: 18 ids, embeds present, assumptions match, ≥6 KnowledgeCheck, ≥12 `question:`.
- [ ] `npm test -- object-storage-content`, lint, typecheck, build green. Commit `content: complete Object Storage tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/object-storage` test: open, assert h1, navigate to `#high-level-architecture`, assert the diagram `img` then in-viewport. **Decrement coming-soon 13 → 12.**
- [ ] Full suite: `npm test`, lint, typecheck, build, `npm run test:e2e -- --workers=1`. Commit `test: verify Object Storage tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1. ✅
- Export-clash check + coming-soon decrement + `returns undefined` repoint + curriculum insert position noted. ✅
