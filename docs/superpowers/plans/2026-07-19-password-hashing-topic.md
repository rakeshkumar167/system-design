# Password Hashing Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Password Hashing** topic at `/topics/security/password-hashing`, reusing the topic-content pipeline (registry, nested route, `TopicLayout`, available-card link) built with the Authentication, TLS, and Authorization topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it (new registry entry, new line in the route's `content` map, flip the card) rather than building it. Mirror the Authorization topic's files exactly (`authorization-*` → `password-hashing-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `password-hashing`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`PasswordHashingCapacity`, `PasswordRegistrationSequence`, `PasswordVerificationSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation** (`page.goto(...#id)`), not TOC clicks.
- Adding a topic does **not** change the curriculum problem count — leave `tests/curriculum.test.ts`, the e2e "showing 1 of 33", and the e2e "coming soon = 15" assertions untouched (they are on `/curriculum`, not `/topics`).
- The existing `tests/topic-registry.test.ts` asserts `getTopic("password-hashing")` is `undefined` — **change it to `encryption-key-management`** (still coming-soon) now that Password Hashing is registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge.

---

### Task 1: Capacity model — `PasswordHashingCapacity`

**Files:** create `lib/password-hashing-estimates.ts`, `tests/password-hashing-estimates.test.ts`, `components/learning/password-hashing-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/authorization-estimates.ts` + `components/learning/authorization-capacity.tsx`.

- [ ] Write `tests/password-hashing-estimates.test.ts` asserting the spec's deterministic results:
  `hashCoresNeeded` 1_250, `peakConcurrentHashes` 1_250, `peakHashMemoryMiB` 80_000, `attackerSlowdownFactor` 5_000_000 — from assumptions `{ loginsPerSec: 5_000, hashCostMs: 250, hashMemoryMiB: 64, msPerCorePerSec: 1_000, attackerFastHashesPerSec: 10_000_000_000, attackerSlowHashesPerSec: 2_000 }`.
- [ ] Implement `calculatePasswordHashingCapacity(a): PasswordHashingCapacityResults` (integer cores via `Math.ceil`). Run → pass.
- [ ] `components/learning/password-hashing-capacity.tsx` wrapping `CapacityTable` (mirror `authorization-capacity.tsx`; assumption rows + result rows telling the deliberate-slowness / attacker-slowdown story). Register `PasswordHashingCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- password-hashing-estimates` green; `npm run typecheck`. Commit `feat: add Password Hashing capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/password-hashing-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/authorization-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `PasswordRegistrationSequence` — actors: User → Auth Service → CSPRNG (salt) → Hash Function → Credential Store. Steps: set password → generate random salt → hash(salt+password) at tuned cost → store algorithm+params+salt+hash. Caption explains the one-way store: a stolen database yields no usable passwords.
- [ ] `PasswordVerificationSequence` — actors: User → Auth Service → Credential Store → Hash Function. Steps: submit password → fetch stored record → recompute with stored salt/params → constant-time compare → allow (or deny). Caption explains recompute-and-compare and constant-time comparison; never decrypt.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add Password Hashing registration and verification diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/password-hashing.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `password-hashing` `TopicMeta` (10 sections from the spec outline; `readingMinutes` ~22; `concepts: ["Salting","Work factor","Argon2/bcrypt","Memory-hardness","Peppering"]`).
- [ ] `lib/topics.ts`: flip `password-hashing` → `available`.
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/password-hashing.mdx`: skeleton — 10 `<h2 id>` headings (ids from outline) + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add password-hashing assertions; change the `undefined` check to `encryption-key-management`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register Password Hashing topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/password-hashing.mdx` (all 10 sections); create `tests/password-hashing-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the Authorization topic's voice/depth/density. Embed `<PasswordHashingCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<PasswordRegistrationSequence />` (sec 1), `<PasswordVerificationSequence />` (sec 8). `TradeoffTable` (algorithms in sec 5), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/password-hashing-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- password-hashing-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete Password Hashing topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the Password Hashing card as available and it links through; `page.goto('/topics/security/password-hashing#slow-hashing')` asserts the heading + a diagram `img`. Do **not** change the "showing 1 of 33" / "coming soon 15" curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Commit `test: verify Password Hashing topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
