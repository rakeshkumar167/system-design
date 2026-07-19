# API Security Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **API Security** topic at `/topics/security/api-security`, reusing the topic-content pipeline built with the six prior Security topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it. Mirror the OWASP Top 10 topic's files exactly (`owasp-top-10-*` → `api-security-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `api-security`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`ApiSecurityCapacity`, `BolaAttackSequence`, `GatewayEnforcementSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation**; target a **mid-page** section; assert the diagram before the in-viewport check; run with `--workers=1`.
- Adding a topic does **not** change the curriculum count — leave `tests/curriculum.test.ts` and the e2e curriculum assertions untouched.
- The existing `tests/topic-registry.test.ts` asserts `getTopic("api-security")` is `undefined` — **change it to `session-management`** (still coming-soon).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge unless asked.

---

### Task 1: Capacity model — `ApiSecurityCapacity`

**Files:** create `lib/api-security-estimates.ts`, `tests/api-security-estimates.test.ts`, `components/learning/api-security-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/owasp-top-10-estimates.ts` + wrapper.

- [ ] Write `tests/api-security-estimates.test.ts`: `gatewaySecurityCores` 50, `backendCoresWithoutFiltering` 1_000, `backendCoresWithFiltering` 500, `netCoresSaved` 450 — from `{ requestsPerSec: 200_000, abusiveFraction: 0.5, gatewayCheckCpuMs: 0.25, backendCpuMs: 5, msPerCorePerSec: 1_000 }`.
- [ ] Implement `calculateApiSecurityCapacity(a): ApiSecurityCapacityResults` (integer cores via `Math.ceil`). Run → pass.
- [ ] `components/learning/api-security-capacity.tsx` wrapping `CapacityTable` (mirror the OWASP wrapper; assumption rows + result rows telling the edge-check-saves-backend story). Register `ApiSecurityCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- api-security-estimates` green; `npm run typecheck`. Commit `feat: add API Security capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/api-security-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/owasp-top-10-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `BolaAttackSequence` — actors: Attacker → API → Database. Steps: request own object (authenticated) → returns own record → swap id to a victim's object → server skips the ownership check → returns victim's record. Caption: authentication passed but object-level authorization was never enforced; the fix is a per-object ownership check on every request.
- [ ] `GatewayEnforcementSequence` — actors: Client → API Gateway → Service. Steps: request with bearer token → gateway terminates TLS, verifies token, checks rate limit + scope → forwards to service → service runs object-level authz → response. Caption: the gateway does coarse edge enforcement but can't know object ownership, so the service still checks it (defense in depth).
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add BOLA and gateway enforcement diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/api-security.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `api-security` `TopicMeta` (10 sections; `readingMinutes` ~23; `concepts: ["API keys & tokens","BOLA/BFLA","Rate limiting","API gateway","Data exposure"]`).
- [ ] `lib/topics.ts`: flip `api-security` → `available` (add a short blurb).
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/api-security.mdx`: skeleton — 10 `<h2 id>` headings + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add api-security assertions; change the `undefined` check to `session-management`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register API Security topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/api-security.mdx` (all 10 sections); create `tests/api-security-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the prior topics' voice/depth/density; cross-ref the other Security topics and the API Gateway tutorial by name/link. Embed `<ApiSecurityCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<BolaAttackSequence />` (sec 3), `<GatewayEnforcementSequence />` (sec 7). `TradeoffTable` (client-auth options in sec 2), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/api-security-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- api-security-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete API Security topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the API Security card as available and it links through; `page.goto('/topics/security/api-security#authorizing-requests')` asserts the heading + a diagram `img` (diagram assertion first, then in-viewport). Do **not** change the curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify API Security topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
