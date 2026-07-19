# Metrics & Monitoring Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Metrics and Monitoring System** tutorial at `/learn/metrics-monitoring` (curriculum seq 19), reusing the tutorial pipeline. Mirror a recent tutorial (e.g. `leaderboard` / `search-autocomplete`).

## Global Constraints

- Slug `metrics-monitoring`, difficulty **Advanced**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test `requiredIds`.
- New export names (`MetricsCapacity`, `MetricsArchitecture`, `IngestSampleSequence`, `RangeQuerySequence`, `AlertEvaluationSequence`, `DownsampleRetentionSequence`) — grep `mdx-components.tsx` before registering.
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only**.
- E2e: direct fragment navigation; assert the diagram `img` before the in-viewport check; run `--workers=1`. **Decrement the "coming soon" count by one (14 → 13)**. Leave "showing 1 of 33" untouched.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge unless asked.

---

### Task 1: Capacity model — `MetricsCapacity`

**Files:** create `lib/metrics-monitoring-estimates.ts`, `tests/metrics-monitoring-estimates.test.ts`, `components/learning/metrics-monitoring-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/leaderboard-estimates.ts` + wrapper.

- [ ] `tests/metrics-monitoring-estimates.test.ts`: `activeSeries` 200_000_000, `ingestSamplesPerSec` 20_000_000, `rawStoragePerDayTb` ≈ 27.648, `compressedStoragePerDayTb` ≈ 3.456 (toBeCloseTo), `compressionRatio` 8 — from `{ monitoredTargets: 1_000_000, seriesPerTarget: 200, scrapeIntervalSec: 10, rawBytesPerSample: 16, compressedBytesPerSample: 2 }`.
- [ ] Implement `calculateMetricsCapacity(a)` (`SECONDS_PER_DAY`, `BYTES_PER_TB`). Run → pass.
- [ ] `metrics-monitoring-capacity.tsx` wrapping `CapacityTable` (write-firehose / compression / write-and-storage-bound story). Register `MetricsCapacity`.
- [ ] `npm test -- metrics-monitoring-estimates` + typecheck green. Commit `feat: add Metrics and Monitoring capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/metrics-monitoring-architecture.tsx` + `metrics-monitoring-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `MetricsArchitecture` HLD: targets → ingestion → TSDB (+downsampler) → query engine → dashboards; alerting engine evaluates + fires. Caption keyword caption-only.
- [ ] Four flow sequences per spec (`IngestSampleSequence`, `RangeQuerySequence`, `AlertEvaluationSequence`, `DownsampleRetentionSequence`), caption-only asserted keywords.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows). Register all 5.
- [ ] `npm test -- diagrams` + typecheck green. Commit `feat: add Metrics and Monitoring architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create `content/tutorials/metrics-monitoring.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add `metrics-monitoring` `TutorialMeta` (title "Design a Metrics and Monitoring System", difficulty "Advanced", readingMinutes ~34, concepts, 18 sections).
- [ ] `curriculum.ts`: flip `metrics-monitoring` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: import + map.
- [ ] `content/tutorials/metrics-monitoring.mdx`: skeleton — 18 `<h2 id>` + placeholder each.
- [ ] `tests/tutorial-registry.test.ts`: add `metrics-monitoring` to the sorted keys array (after `maps-navigation`, before `news-feed`) + `toHaveLength(18)`.
- [ ] `tests/curriculum.test.ts`: insert `"metrics-monitoring"` into the available list **after `payment-system`, before `distributed-logging`** (seq 19).
- [ ] `npm test -- tutorial-registry curriculum` + typecheck + build green. Commit `feat: register Metrics and Monitoring tutorial route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/tutorials/metrics-monitoring.mdx` (18 sections); create `tests/metrics-monitoring-content.test.ts`.

- [ ] Author all 18 sections per spec — match recent tutorial voice/density. Embed `<MetricsCapacity assumptions={{…}} />` (exact = test), `<MetricsArchitecture />` (sec 6), the four flows (sec 7 + alerting/downsampling in their deep dives), `RequirementsTable` (2), `EntityModel` (4), three `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15), `DecisionRecord` (16), two `Callout variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/metrics-monitoring-content.test.ts`: 18 ids, embeds present, assumptions match, ≥6 KnowledgeCheck, ≥12 `question:`.
- [ ] `npm test -- metrics-monitoring-content`, lint, typecheck, build green. Commit `content: complete Metrics and Monitoring tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/metrics-monitoring` test: open, assert h1, navigate to `#high-level-architecture`, assert the diagram `img` then in-viewport. **Decrement coming-soon 14 → 13.**
- [ ] Full suite: `npm test`, lint, typecheck, build, `npm run test:e2e -- --workers=1`. Commit `test: verify Metrics and Monitoring tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1. ✅
- Export-name clash check + coming-soon decrement + curriculum insert position noted. ✅
