# Ride-Hailing Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Ride-Hailing Service** tutorial at `/learn/ride-hailing` (curriculum seq 14), reusing the tutorial pipeline. Mirror a recent tutorial (e.g. `photo-sharing`).

## Global Constraints

- Slug `ride-hailing`, difficulty **Advanced**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test `requiredIds`.
- New export names (`RideHailingCapacity`, `RideHailingArchitecture`, `LocationUpdateSequence`, `MatchRideSequence`, `TripStateSequence`, `LiveTrackingSequence`) — grep `mdx-components.tsx` before registering.
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only**.
- E2e: direct fragment navigation; assert the diagram `img` and add `scrollIntoViewIfNeeded()` before `toBeInViewport()`; run `--workers=1`. **Decrement "coming soon" count (11 → 10)**. Leave "showing 1 of 33" untouched.
- **`tests/tutorial-registry.test.ts` "returns undefined" slug is currently `ride-hailing` — repoint it to `food-delivery`** (next coming-soon by sequence) since ride-hailing is now registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge unless asked.

---

### Task 1: Capacity model — `RideHailingCapacity`

**Files:** create `lib/ride-hailing-estimates.ts`, `tests/ride-hailing-estimates.test.ts`, `components/learning/ride-hailing-capacity.tsx`; modify `mdx-components.tsx`.

- [ ] `tests/ride-hailing-estimates.test.ts`: `locationUpdatesPerSec` 1_250_000, `locationWriteMbPerSec` 125, `ridesPerSec` ≈ 578.70, `writeToRequestRatio` ≈ 2160, `candidateEvaluationsPerSec` ≈ 5787.04 (toBeCloseTo the non-integers) — from `{ activeDrivers: 5_000_000, pingIntervalSec: 4, locationBytes: 100, ridesPerDay: 50_000_000, candidatesPerMatch: 10 }`.
- [ ] Implement `calculateRideHailingCapacity(a)` (`SECONDS_PER_DAY`). Run → pass.
- [ ] `ride-hailing-capacity.tsx` wrapping `CapacityTable` (location-firehose-dominates / ephemeral-in-memory / matching-is-cheap story). Register `RideHailingCapacity`.
- [ ] `npm test -- ride-hailing-estimates` + typecheck green. Commit `feat: add Ride-Hailing capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/ride-hailing-architecture.tsx` + `ride-hailing-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `RideHailingArchitecture` HLD: driver → location ingest → in-memory geo index; rider → API → matching (queries geo index) → trip service. Caption keyword caption-only.
- [ ] Four flow sequences per spec (`LocationUpdateSequence`, `MatchRideSequence`, `TripStateSequence`, `LiveTrackingSequence`), caption-only asserted keywords.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows). Register all 5.
- [ ] `npm test -- diagrams` + typecheck green. Commit `feat: add Ride-Hailing architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create `content/tutorials/ride-hailing.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add `ride-hailing` `TutorialMeta` (title "Design a Ride-Hailing Service", difficulty "Advanced", readingMinutes ~34, concepts, 18 sections).
- [ ] `curriculum.ts`: flip `ride-hailing` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: import + map.
- [ ] `content/tutorials/ride-hailing.mdx`: skeleton — 18 `<h2 id>` + placeholder each.
- [ ] `tests/tutorial-registry.test.ts`: add `ride-hailing` to sorted keys (after `rate-limiter`, before `search-autocomplete`) + `toHaveLength(18)`; **change the `returns undefined` slug from `ride-hailing` to `food-delivery`**.
- [ ] `tests/curriculum.test.ts`: insert `"ride-hailing"` into the available list **after `photo-sharing`, before `ticket-booking`** (seq 14).
- [ ] `npm test -- tutorial-registry curriculum` + typecheck + build green. Commit `feat: register Ride-Hailing tutorial route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/tutorials/ride-hailing.mdx` (18 sections); create `tests/ride-hailing-content.test.ts`.

- [ ] Author all 18 sections per spec — match recent tutorial voice/density; cross-ref Ticket Booking (contention), Chat System (push), Maps & Navigation (ETA), Payment System, Proximity Service. Embed `<RideHailingCapacity assumptions={{…}} />` (exact = test), `<RideHailingArchitecture />` (sec 6), the four flows (sec 7 + match in sec 10 + trip in sec 11), `RequirementsTable` (2), `EntityModel` (4), three `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15), `DecisionRecord` (16), two `Callout variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/ride-hailing-content.test.ts`: 18 ids, embeds present, assumptions match, ≥6 KnowledgeCheck, ≥12 `question:`.
- [ ] `npm test -- ride-hailing-content`, lint, typecheck, build green. Commit `content: complete Ride-Hailing tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/ride-hailing` test: open, assert h1, navigate to `#high-level-architecture`, assert the diagram `img`, `scrollIntoViewIfNeeded()`, then in-viewport. **Decrement coming-soon 11 → 10.**
- [ ] Full suite: `npm test`, lint, typecheck, build, `npm run test:e2e -- --workers=1`. Commit `test: verify Ride-Hailing tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1. ✅
- Export-clash check + coming-soon decrement + `returns undefined` repoint + curriculum insert position noted. ✅
