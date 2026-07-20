# Photo Sharing Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Photo Sharing Platform** tutorial at `/learn/photo-sharing` (curriculum seq 13), reusing the tutorial pipeline. Mirror a recent tutorial (e.g. `object-storage`).

## Global Constraints

- Slug `photo-sharing`, difficulty **Advanced**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test `requiredIds`.
- New export names (`PhotoSharingCapacity`, `PhotoSharingArchitecture`, `UploadPhotoSequence`, `ProcessImageSequence`, `ServeImageSequence`, `FeedLoadSequence`) — grep `mdx-components.tsx` before registering.
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only**.
- E2e: direct fragment navigation; assert the diagram `img` before the in-viewport check; add `scrollIntoViewIfNeeded()` before `toBeInViewport()` to avoid the mobile flake; run `--workers=1`. **Decrement "coming soon" count (12 → 11)**. Leave "showing 1 of 33" untouched.
- **`tests/tutorial-registry.test.ts` "returns undefined" slug is currently `photo-sharing` — repoint it to `ride-hailing`** (next coming-soon by sequence) since photo-sharing is now registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge unless asked.

---

### Task 1: Capacity model — `PhotoSharingCapacity`

**Files:** create `lib/photo-sharing-estimates.ts`, `tests/photo-sharing-estimates.test.ts`, `components/learning/photo-sharing-capacity.tsx`; modify `mdx-components.tsx`.

- [ ] `tests/photo-sharing-estimates.test.ts`: `uploadsPerSec` ≈ 1157.41, `dailyStorageTb` 600, `viewQps` ≈ 115_740.74, `originQps` ≈ 2_314.81, `cdnOffloadFactor` ≈ 50 (toBeCloseTo for the non-integers) — from `{ uploadsPerDay: 100_000_000, derivativesPerPhoto: 5, originalBytes: 4_000_000, derivativeBytes: 400_000, viewsPerUpload: 100, cdnHitRate: 0.98 }`.
- [ ] Implement `calculatePhotoSharingCapacity(a)` (`SECONDS_PER_DAY`, `BYTES_PER_TB`). Run → pass.
- [ ] `photo-sharing-capacity.tsx` wrapping `CapacityTable` (write-amplified storage + CDN-offloaded read story). Register `PhotoSharingCapacity`.
- [ ] `npm test -- photo-sharing-estimates` + typecheck green. Commit `feat: add Photo Sharing capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/photo-sharing-architecture.tsx` + `photo-sharing-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `PhotoSharingArchitecture` HLD: client → app/API → object store + metadata DB + async image pipeline (queue+workers) + CDN. Caption keyword caption-only.
- [ ] Four flow sequences per spec (`UploadPhotoSequence`, `ProcessImageSequence`, `ServeImageSequence`, `FeedLoadSequence`), caption-only asserted keywords.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows). Register all 5.
- [ ] `npm test -- diagrams` + typecheck green. Commit `feat: add Photo Sharing architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create `content/tutorials/photo-sharing.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add `photo-sharing` `TutorialMeta` (title "Design a Photo Sharing Platform", difficulty "Advanced", readingMinutes ~34, concepts, 18 sections).
- [ ] `curriculum.ts`: flip `photo-sharing` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: import + map.
- [ ] `content/tutorials/photo-sharing.mdx`: skeleton — 18 `<h2 id>` + placeholder each.
- [ ] `tests/tutorial-registry.test.ts`: add `photo-sharing` to sorted keys (after `payment-system`, before `rate-limiter`) + `toHaveLength(18)`; **change the `returns undefined` slug from `photo-sharing` to `ride-hailing`**.
- [ ] `tests/curriculum.test.ts`: insert `"photo-sharing"` into the available list **after `object-storage`, before `ticket-booking`** (seq 13).
- [ ] `npm test -- tutorial-registry curriculum` + typecheck + build green. Commit `feat: register Photo Sharing tutorial route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/tutorials/photo-sharing.mdx` (18 sections); create `tests/photo-sharing-content.test.ts`.

- [ ] Author all 18 sections per spec — match recent tutorial voice/density; cross-ref Object Storage + News Feed + Video Streaming (CDN) by name/link. Embed `<PhotoSharingCapacity assumptions={{…}} />` (exact = test), `<PhotoSharingArchitecture />` (sec 6), the four flows (sec 7 + process in sec 9 + serve in sec 10 + feed in sec 11), `RequirementsTable` (2), `EntityModel` (4), three `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15), `DecisionRecord` (16), two `Callout variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/photo-sharing-content.test.ts`: 18 ids, embeds present, assumptions match, ≥6 KnowledgeCheck, ≥12 `question:`.
- [ ] `npm test -- photo-sharing-content`, lint, typecheck, build green. Commit `content: complete Photo Sharing tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/photo-sharing` test: open, assert h1, navigate to `#high-level-architecture`, assert the diagram `img`, `scrollIntoViewIfNeeded()`, then in-viewport. **Decrement coming-soon 12 → 11.**
- [ ] Full suite: `npm test`, lint, typecheck, build, `npm run test:e2e -- --workers=1`. Commit `test: verify Photo Sharing tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1. ✅
- Export-clash check + coming-soon decrement + `returns undefined` repoint + curriculum insert position noted. ✅
