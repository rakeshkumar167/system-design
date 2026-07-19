# OWASP Top 10 Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **OWASP Top 10** topic at `/topics/security/owasp-top-10`, reusing the topic-content pipeline built with the five prior Security topics. A **survey/hub** topic that cross-references the others.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it. Mirror the Encryption topic's files exactly (`encryption-key-management-*` → `owasp-top-10-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `owasp-top-10`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`OwaspRiskCapacity`, `InjectionAttackSequence`, `SsrfAttackSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation**; target a **mid-page** section; assert the diagram before the in-viewport check; run with `--workers=1`.
- Adding a topic does **not** change the curriculum count — leave `tests/curriculum.test.ts` and the e2e curriculum assertions untouched.
- The existing `tests/topic-registry.test.ts` asserts `getTopic("owasp-top-10")` is `undefined` — **change it to `api-security`** (still coming-soon).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- Capacity fn uses `Math.round` on the breach counts (discrete attacks; removes `0.1**3` float noise).
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge unless asked.

---

### Task 1: Capacity model — `OwaspRiskCapacity`

**Files:** create `lib/owasp-top-10-estimates.ts`, `tests/owasp-top-10-estimates.test.ts`, `components/learning/owasp-top-10-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/encryption-key-management-estimates.ts` + wrapper.

- [ ] Write `tests/owasp-top-10-estimates.test.ts`: `singleControlBreaches` 100_000, `layeredBreaches` 1_000, `defenseInDepthFactor` 100, `overallReductionFactor` 1_000 — from `{ attackAttemptsPerDay: 1_000_000, blockRatePerLayer: 0.9, layers: 3 }`.
- [ ] Implement `calculateOwaspRiskCapacity(a): OwaspRiskCapacityResults` (`Math.round` breach counts and factors). Run → pass.
- [ ] `components/learning/owasp-top-10-capacity.tsx` wrapping `CapacityTable` (mirror the Encryption wrapper; assumption rows + result rows telling the multiplicative defense-in-depth story). Register `OwaspRiskCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- owasp-top-10-estimates` green; `npm run typecheck`. Commit `feat: add OWASP Top 10 capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/owasp-top-10-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/encryption-key-management-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `InjectionAttackSequence` — actors: Attacker → Web App → Database. Steps: send crafted input → concatenate input into SQL → execute injected query → return extra rows → data exfiltrated. Caption: the interpreter treats untrusted input as code; parameterized queries keep code and data separate.
- [ ] `SsrfAttackSequence` — actors: Attacker → Vulnerable Server → Metadata Endpoint. Steps: submit crafted URL param → server fetches the URL → request steered to internal metadata address → credentials returned → attacker receives secrets. Caption: fix by allowlisting outbound destinations and blocking internal ranges.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add injection and SSRF attack diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/owasp-top-10.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `owasp-top-10` `TopicMeta` (10 sections; `readingMinutes` ~24; `concepts: ["Broken access control","Injection","Cryptographic failures","SSRF","Defense in depth"]`).
- [ ] `lib/topics.ts`: flip `owasp-top-10` → `available` (add a short blurb).
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/owasp-top-10.mdx`: skeleton — 10 `<h2 id>` headings + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add owasp assertions; change the `undefined` check to `api-security`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register OWASP Top 10 topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/owasp-top-10.mdx` (all 10 sections); create `tests/owasp-top-10-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the prior topics' voice/depth/density; lean into the hub role (cross-ref the other Security topics by name/link). Embed `<OwaspRiskCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<InjectionAttackSequence />` (sec 5), `<SsrfAttackSequence />` (sec 8). `TradeoffTable` (the 10-list table in sec 2), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/owasp-top-10-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- owasp-top-10-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete OWASP Top 10 topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the OWASP card as available and it links through; `page.goto('/topics/security/owasp-top-10#injection')` asserts the heading + a diagram `img` (diagram assertion first, then in-viewport). Do **not** change the curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify OWASP Top 10 topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
