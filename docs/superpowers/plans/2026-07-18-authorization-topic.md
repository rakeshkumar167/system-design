# Authorization Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Authorization** topic at `/topics/security/authorization`, reusing the topic-content pipeline (registry, nested route, `TopicLayout`, available-card link) built with the Authentication and TLS topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 4 *extends* it (new registry entry, new line in the route's `content` map, flip the card) rather than building it. Mirror the TLS topic's files exactly (`tls-*` → `authorization-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `authorization`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`AuthorizationCapacity`, `AuthorizationDecisionSequence`, `RelationshipCheckSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation** (`page.goto(...#id)`), not TOC clicks.
- Adding a topic does **not** change the curriculum problem count — leave `tests/curriculum.test.ts` and the e2e "showing 1 of 33" assertion untouched.
- The existing `tests/topic-registry.test.ts` asserts `getTopic("authorization")` is `undefined` — **change it to `password-hashing`** (still coming-soon) now that Authorization is registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge.

---

### Task 1: Capacity model — `AuthorizationCapacity`

**Files:** create `lib/authorization-estimates.ts`, `tests/authorization-estimates.test.ts`, `components/learning/authorization-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/tls-estimates.ts` + `components/learning/tls-capacity.tsx`.

- [ ] Write failing `tests/authorization-estimates.test.ts` asserting the spec's deterministic results:
  `totalChecksPerSec` 600_000, `cachedChecksPerSec` 540_000, `evaluatedChecksPerSec` 60_000, `decisionCpuMsPerSec` 30_000, `coresWithCache` 30, `coresWithoutCache` 300 — from assumptions `{ requestsPerSec: 200_000, checksPerRequest: 3, decisionCpuMs: 0.5, cacheHitRate: 0.9, msPerCorePerSec: 1_000 }`.
- [ ] Run → fail. Implement `calculateAuthorizationCapacity(a): AuthorizationCapacityResults` (integer cores via `Math.ceil`). Run → pass.
- [ ] `components/learning/authorization-capacity.tsx` wrapping `CapacityTable` (mirror `tls-capacity.tsx`; assumption rows + result rows telling the cache-amortization story). Register `AuthorizationCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- authorization-estimates` green; `npm run typecheck`. Commit `feat: add Authorization capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/authorization-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/tls-flows.tsx`.

- [ ] `AuthorizationDecisionSequence` — actors: Client → PEP (gateway/service) → PDP (policy engine) → PIP (attributes) → back allow/deny → Resource. Caption explains externalized decision (PEP enforces, PDP decides).
- [ ] `RelationshipCheckSequence` — `check(user, relation, object)` → Authz service walks relationship tuples (user → group → object) → returns allowed → Resource served. Caption explains the relationship graph / Zanzibar.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add Authorization decision and relationship-check diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/authorization.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `authorization` `TopicMeta` (10 sections from the spec outline; `readingMinutes` ~22; `concepts: ["RBAC","ABAC","ReBAC","Policy engines","Least privilege"]`).
- [ ] `lib/topics.ts`: flip `authorization` → `available`.
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/authorization.mdx`: skeleton — 10 `<h2 id>` headings (ids from outline) + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add authorization assertions; change the `undefined` check to `password-hashing`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register Authorization topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/authorization.mdx` (all 10 sections); create `tests/authorization-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the TLS topic's voice/depth/density. Embed `<AuthorizationCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<AuthorizationDecisionSequence />` (sec 5), `<RelationshipCheckSequence />` (sec 7). `TradeoffTable` (models in sec 2), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/authorization-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- authorization-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete Authorization topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the Authorization card as available and it links through; `page.goto('/topics/security/authorization#policy-architecture')` asserts the heading + the decision-flow diagram `img`. Do **not** change the "showing 1 of 33" curriculum assertion.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Commit `test: verify Authorization topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
