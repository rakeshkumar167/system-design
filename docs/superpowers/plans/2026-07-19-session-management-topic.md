# Session Management Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Session Management** topic at `/topics/security/session-management`, reusing the topic-content pipeline built with the seven prior Security topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it. Mirror the API Security topic's files exactly (`api-security-*` → `session-management-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `session-management`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`SessionCapacity`, `SessionFixationSequence`, `SecureLoginSessionSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation**; target a **mid-page** section; assert the diagram before the in-viewport check; run with `--workers=1`.
- Adding a topic does **not** change the curriculum count — leave `tests/curriculum.test.ts` and the e2e curriculum assertions untouched.
- The existing `tests/topic-registry.test.ts` asserts `getTopic("session-management")` is `undefined` — **change it to `rate-limiting`** (still coming-soon).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- Cached-lookup rate computed as `requestsPerSec - requestsPerSec*cacheHitRate` (exact for 0.95); memory via a `bytesPerGb` constant.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge unless asked.

---

### Task 1: Capacity model — `SessionCapacity`

**Files:** create `lib/session-management-estimates.ts`, `tests/session-management-estimates.test.ts`, `components/learning/session-management-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/api-security-estimates.ts` + wrapper.

- [ ] Write `tests/session-management-estimates.test.ts`: `storeLookupsWithoutCache` 300_000, `storeLookupsWithCache` 15_000, `lookupReductionFactor` 20, `sessionStoreMemoryGb` 50 — from `{ requestsPerSec: 300_000, activeSessions: 50_000_000, sessionBytes: 1_000, cacheHitRate: 0.95, bytesPerGb: 1_000_000_000 }`.
- [ ] Implement `calculateSessionCapacity(a): SessionCapacityResults`. Run → pass.
- [ ] `components/learning/session-management-capacity.tsx` wrapping `CapacityTable` (mirror the API Security wrapper; assumption rows + result rows telling the lookup-cost + revocation-trade story). Register `SessionCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- session-management-estimates` green; `npm run typecheck`. Commit `feat: add Session Management capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/session-management-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/api-security-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `SessionFixationSequence` — actors: Attacker → Victim → Web App. Steps: attacker obtains a session id → plants it on the victim (crafted link) → victim logs in with it → app keeps the same id (the bug) → attacker reuses the now-authenticated id. Caption: the fix is regenerating the session id at login so the pre-login id is worthless.
- [ ] `SecureLoginSessionSequence` — actors: User → Web App → Session Store. Steps: login → app generates a fresh high-entropy id + stores the session → sets HttpOnly+Secure+SameSite cookie → later request returns the cookie → app validates it against the store → serves. Caption: the opaque id is a bearer credential validated server-side on every request.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add session fixation and secure-login diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/session-management.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `session-management` `TopicMeta` (10 sections; `readingMinutes` ~22; `concepts: ["Session IDs & cookies","Stateful vs stateless","Fixation & hijacking","Timeouts","CSRF & SameSite"]`).
- [ ] `lib/topics.ts`: flip `session-management` → `available` (add a short blurb).
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/session-management.mdx`: skeleton — 10 `<h2 id>` headings + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add session-management assertions; change the `undefined` check to `rate-limiting`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register Session Management topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/session-management.mdx` (all 10 sections); create `tests/session-management-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the prior topics' voice/depth/density; cross-ref Authentication, Authorization, TLS, OWASP, API Security by name/link. Embed `<SessionCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<SessionFixationSequence />` (sec 5), `<SecureLoginSessionSequence />` (sec 8). `TradeoffTable` (stateful vs stateless in sec 3), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/session-management-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- session-management-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete Session Management topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the Session Management card as available and it links through; `page.goto('/topics/security/session-management#session-attacks')` asserts the heading + a diagram `img` (diagram assertion first, then in-viewport). Do **not** change the curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify Session Management topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
