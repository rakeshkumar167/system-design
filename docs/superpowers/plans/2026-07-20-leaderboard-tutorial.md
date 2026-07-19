# Leaderboard Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Leaderboard** tutorial at `/learn/leaderboard` (curriculum seq 32), reusing the tutorial pipeline. Mirror a recent tutorial (e.g. `search-autocomplete`).

## Global Constraints

- Slug `leaderboard`, difficulty **Intermediate**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test `requiredIds`.
- New export names (`LeaderboardCapacity`, `LeaderboardArchitecture`, `SubmitScoreSequence`, `TopKQuerySequence`, `PlayerRankSequence`, `ShardedRankSequence`) — grep `mdx-components.tsx` before registering.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**.
- E2e: **direct fragment navigation**; assert the diagram `img` before the in-viewport check; run `--workers=1`. **Decrement the "coming soon" count by one** (verify current value — expected 15 → 14). Leave "showing 1 of 33" untouched (leaderboard was already in the 33).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge unless asked.

---

### Task 1: Capacity model — `LeaderboardCapacity`

**Files:** create `lib/leaderboard-estimates.ts`, `tests/leaderboard-estimates.test.ts`, `components/learning/leaderboard-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/search-autocomplete-estimates.ts` + wrapper.

- [ ] `tests/leaderboard-estimates.test.ts`: `updateQps` ≈ 57_870.37, `readQps` ≈ 578_703.70, `totalOpsQps` ≈ 636_574.07 (toBeCloseTo), `leaderboardMemoryGb` 5, `nodesForThroughput` 7 — from `{ players: 50_000_000, bytesPerEntry: 100, scoreUpdatesPerDay: 5_000_000_000, readsPerUpdate: 10, opsPerNode: 100_000 }`.
- [ ] Implement `calculateLeaderboardCapacity(a)` (`SECONDS_PER_DAY`, `BYTES_PER_GB`; `Math.ceil` nodes). Run → pass.
- [ ] `leaderboard-capacity.tsx` wrapping `CapacityTable` (throughput-bound / reads-dominate / fits-in-RAM story). Register `LeaderboardCapacity`.
- [ ] `npm test -- leaderboard-estimates` + typecheck green. Commit `feat: add Leaderboard capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/leaderboard-architecture.tsx` + `components/diagrams/leaderboard-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `search-autocomplete-architecture.tsx` (Node/Edge/anchors/Legend) and `search-autocomplete-flows.tsx` (Sequence helper).

- [ ] `LeaderboardArchitecture` HLD: game client → leaderboard service → sorted set (Redis ZSET) + top-K cache; service → score stream → durable DB; DB → ZSET rebuild path. Meaningful caption.
- [ ] Four flow sequences per the spec (`SubmitScoreSequence`, `TopKQuerySequence`, `PlayerRankSequence`, `ShardedRankSequence`), each with a caption whose asserted keyword is caption-only.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows; caption-only keywords). Register all 5 in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` + typecheck green. Commit `feat: add Leaderboard architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create `content/tutorials/leaderboard.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add `leaderboard` `TutorialMeta` (title "Design a Leaderboard", difficulty "Intermediate", readingMinutes ~30, concepts, 18 sections).
- [ ] `curriculum.ts`: flip `leaderboard` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: import + add to the `content` map.
- [ ] `content/tutorials/leaderboard.mdx`: skeleton — 18 `<h2 id>` headings + a placeholder line each.
- [ ] `tests/tutorial-registry.test.ts`: add `leaderboard` to the registered-keys array + a `toHaveLength(18)` assertion.
- [ ] `tests/curriculum.test.ts`: append `"leaderboard"` to the expected available list (it's last, seq 32).
- [ ] `npm test -- tutorial-registry curriculum` + typecheck + `npm run build` green. Commit `feat: register Leaderboard tutorial route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/tutorials/leaderboard.mdx` (18 sections); create `tests/leaderboard-content.test.ts`.

- [ ] Author all 18 sections per the spec — match a recent tutorial's voice/depth/density. Embed `<LeaderboardCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<LeaderboardArchitecture />` (sec 6), the four flow sequences (sec 7), `RequirementsTable` (sec 2), `EntityModel` (sec 4), three `ApiContract` (sec 5), `TradeoffTable` (sec 14), `FailureMatrix` (sec 15), `DecisionRecord` (sec 16), two `Callout variant="interview"` (sec 1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/leaderboard-content.test.ts`: 18 required ids, embeds present, assumptions match, ≥6 KnowledgeCheck, ≥12 `question:`.
- [ ] `npm test -- leaderboard-content`, lint, typecheck, `npm run build` green. Commit `content: complete Leaderboard tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/leaderboard` test: open the tutorial, assert the h1, navigate to `#sorted-sets` (mid-page) via fragment, assert the diagram `img` then in-viewport. **Decrement the coming-soon count assertion by one** (15 → 14).
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify Leaderboard tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1. ✅
- Export-name clash check + coming-soon decrement noted. ✅
