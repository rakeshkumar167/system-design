# Secure SDLC Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Secure SDLC** topic at `/topics/security/secure-sdlc`, reusing the topic-content pipeline built with the eight prior Security topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it. Mirror the Session Management topic's files exactly (`session-management-*` → `secure-sdlc-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `secure-sdlc`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`SecureSdlcCapacity`, `SecureSdlcPipelineSequence`, `VulnerabilityResponseSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation**; target a **mid-page** section; assert the diagram before the in-viewport check; run with `--workers=1`.
- Adding a topic does **not** change the curriculum count — leave `tests/curriculum.test.ts` and the e2e curriculum assertions untouched.
- The existing `tests/topic-registry.test.ts` "returns undefined" check uses `rate-limiting` (still coming-soon, NOT being built) — **leave it unchanged** (we're registering `secure-sdlc`, not `rate-limiting`).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- Vuln counts computed as `reachProd = vulnsPerRelease - vulnsPerRelease*shiftLeftCatchRate` (exact for 0.9).
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge unless asked.

---

### Task 1: Capacity model — `SecureSdlcCapacity`

**Files:** create `lib/secure-sdlc-estimates.ts`, `tests/secure-sdlc-estimates.test.ts`, `components/learning/secure-sdlc-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/session-management-estimates.ts` + wrapper.

- [ ] Write `tests/secure-sdlc-estimates.test.ts`: `prodCostPerVuln` 10_000, `baselineCostAllInProd` 1_000_000, `shiftLeftTotalCost` 109_000, `costSaved` 891_000 — from `{ vulnsPerRelease: 100, costFixInDesign: 100, prodCostMultiplier: 100, shiftLeftCatchRate: 0.9 }`.
- [ ] Implement `calculateSecureSdlcCapacity(a): SecureSdlcCapacityResults`. Run → pass.
- [ ] `components/learning/secure-sdlc-capacity.tsx` wrapping `CapacityTable` (mirror the Session wrapper; assumption rows + result rows telling the shift-left cost-curve story; format costs as `$`). Register `SecureSdlcCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- secure-sdlc-estimates` green; `npm run typecheck`. Commit `feat: add Secure SDLC capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/secure-sdlc-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/session-management-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `SecureSdlcPipelineSequence` — actors: Developer → CI Pipeline → Staging → Production. Steps: commit → SAST + secret scan → SCA dependency scan → build, sign & SBOM → DAST in staging → deploy + runtime monitoring. Caption: automated security gates at each stage catch flaws before they reach production (shift-left in the pipeline).
- [ ] `VulnerabilityResponseSequence` — actors: Reporter/Scanner → Security Team → Engineering. Steps: report/discover a vulnerability → triage & severity → prioritize → patch developed → tested & verified → deploy fix. Caption: the vulnerability-management loop that closes findings from scans, pentests, and bug-bounty reports.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add secure pipeline and vulnerability-response diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/secure-sdlc.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `secure-sdlc` `TopicMeta` (10 sections; `readingMinutes` ~23; `concepts: ["Shift-left","SAST/DAST/SCA","Threat modeling","CI/CD security","Vulnerability management"]`).
- [ ] `lib/topics.ts`: flip `secure-sdlc` → `available` (keep/trim the existing blurb).
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/secure-sdlc.mdx`: skeleton — 10 `<h2 id>` headings + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add secure-sdlc assertions; leave the `undefined` check as `rate-limiting`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register Secure SDLC topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/secure-sdlc.mdx` (all 10 sections); create `tests/secure-sdlc-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the prior topics' voice/depth/density; cross-ref OWASP, Secrets Management, Threat Modeling (named), and the other Security topics. Embed `<SecureSdlcCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<SecureSdlcPipelineSequence />` (sec 5), `<VulnerabilityResponseSequence />` (sec 8). `TradeoffTable` (SAST/DAST/IAST/SCA in sec 4), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/secure-sdlc-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- secure-sdlc-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete Secure SDLC topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the Secure SDLC card as available and it links through; `page.goto('/topics/security/secure-sdlc#supply-chain')` asserts the heading + a diagram `img` (diagram assertion first, then in-viewport). Do **not** change the curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify Secure SDLC topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- `undefined` assertion intentionally left as `rate-limiting` (not building it). ✅
