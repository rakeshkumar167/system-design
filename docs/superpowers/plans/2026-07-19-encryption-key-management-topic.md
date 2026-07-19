# Encryption & Key Management Topic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author the **Encryption & Key Management** topic at `/topics/security/encryption-key-management`, reusing the topic-content pipeline (registry, nested route, `TopicLayout`, available-card link) built with the Authentication, TLS, Authorization, and Password Hashing topics.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline already exists — Task 3 *extends* it. Mirror the Password Hashing topic's files exactly (`password-hashing-*` → `encryption-key-management-*`).

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `encryption-key-management`, category `security`, **10 sections** (ids in the spec's outline table).
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`EncryptionCapacity`, `EnvelopeEncryptSequence`, `EnvelopeDecryptSequence`) — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation** (`page.goto(...#id)`), not TOC clicks; target a **mid-page** section for the mobile in-viewport check; run with `--workers=1` to dodge the parallel `toBeInViewport` flake.
- Adding a topic does **not** change the curriculum problem count — leave `tests/curriculum.test.ts`, the e2e "showing 1 of 33", and the e2e "coming soon = 15" assertions untouched (they are on `/curriculum`).
- The existing `tests/topic-registry.test.ts` asserts `getTopic("encryption-key-management")` is `undefined` — **change it to `owasp-top-10`** (still coming-soon) now that this topic is registered.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge unless asked.

---

### Task 1: Capacity model — `EncryptionCapacity`

**Files:** create `lib/encryption-key-management-estimates.ts`, `tests/encryption-key-management-estimates.test.ts`, `components/learning/encryption-key-management-capacity.tsx`; modify `mdx-components.tsx`. Mirror `lib/password-hashing-estimates.ts` + `components/learning/password-hashing-capacity.tsx`.

- [ ] Write `tests/encryption-key-management-estimates.test.ts` asserting the spec's deterministic results:
  `naiveKmsCallsPerSec` 500_000, `cachedKmsCallsPerSec` 500, `kmsReductionFactor` 1_000, `localCryptoCores` 5 — from assumptions `{ operationsPerSec: 500_000, kmsUnwrapMs: 20, dekCacheHitRate: 0.999, aesEncryptMs: 0.01, msPerCorePerSec: 1_000 }`.
- [ ] Implement `calculateEncryptionCapacity(a): EncryptionCapacityResults` (integer cores via `Math.ceil`). Run → pass.
- [ ] `components/learning/encryption-key-management-capacity.tsx` wrapping `CapacityTable` (mirror `password-hashing-capacity.tsx`; assumption rows + result rows telling the KMS-call-vs-cipher / DEK-cache story). Register `EncryptionCapacity` in `mdx-components.tsx`.
- [ ] `npm test -- encryption-key-management-estimates` green; `npm run typecheck`. Commit `feat: add Encryption & Key Management capacity model and wrapper`.

### Task 2: Diagrams

**Files:** create `components/diagrams/encryption-key-management-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`. Mirror `components/diagrams/password-hashing-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).

- [ ] `EnvelopeEncryptSequence` — actors: App Server → KMS / HSM → Data Store. Steps: generate data key → plaintext DEK + wrapped DEK → encrypt payload with DEK (AES) → discard plaintext DEK → store ciphertext + wrapped DEK. Caption explains the master key never leaves the KMS and the stored data is useless without it.
- [ ] `EnvelopeDecryptSequence` — actors: App Server → Data Store → KMS / HSM. Steps: read ciphertext + wrapped DEK → ciphertext + wrapped DEK → unwrap DEK → plaintext DEK → decrypt locally, cache DEK. Caption explains unwrap-inside-the-KMS and that the key service is consulted per data key, not per object.
- [ ] Append render assertions to `tests/diagrams.test.tsx` (assert distinctive keywords via **caption only**). Register both in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` green; `npm run typecheck`. Commit `feat: add envelope encrypt and decrypt diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/topic-registry.ts`, `lib/topics.ts`, `app/topics/[category]/[slug]/page.tsx`, `tests/topic-registry.test.ts`; create `content/topics/encryption-key-management.mdx` (skeleton).

- [ ] `lib/topic-registry.ts`: add `encryption-key-management` `TopicMeta` (10 sections from the spec outline; `readingMinutes` ~22; `concepts: ["Symmetric/asymmetric","Envelope encryption","KMS/HSM","Key rotation","Crypto-shredding"]`).
- [ ] `lib/topics.ts`: flip `encryption-key-management` → `available`.
- [ ] `app/topics/[category]/[slug]/page.tsx`: import the MDX + add to the `content` map.
- [ ] `content/topics/encryption-key-management.mdx`: skeleton — 10 `<h2 id>` headings (ids from outline) + one placeholder line each.
- [ ] `tests/topic-registry.test.ts`: add encryption assertions; change the `undefined` check to `owasp-top-10`.
- [ ] `npm test -- topic-registry` green; `npm run typecheck`. Commit `feat: register Encryption & Key Management topic route and skeleton`.

### Task 4 + 5: Content (Opus)

**Files:** rewrite `content/topics/encryption-key-management.mdx` (all 10 sections); create `tests/encryption-key-management-content.test.ts`.

- [ ] Author sections 1–10 per the spec's content notes — match the Password Hashing topic's voice/depth/density. Embed `<EncryptionCapacity assumptions={{…}} />` (assumptions exactly = estimates test), `<EnvelopeEncryptSequence />` (sec 4), `<EnvelopeDecryptSequence />` (sec 8). `TradeoffTable` (symmetric vs asymmetric in sec 2), `DecisionRecord` (sec 9), ≥4 `<KnowledgeCheck>`, `<Faq>` ≥10 entries.
- [ ] `tests/encryption-key-management-content.test.ts`: required ids present, three embeds present, assumptions match, ≥4 KnowledgeCheck, ≥10 `question:`.
- [ ] `npm test -- encryption-key-management-content`, `npm run lint`, `npm run typecheck` green. Commit `content: complete Encryption & Key Management topic`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add: `/topics` shows the Encryption card as available and it links through; `page.goto('/topics/security/encryption-key-management#envelope-encryption')` asserts the heading + a diagram `img`. Do **not** change the curriculum assertions.
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1`. Commit `test: verify Encryption & Key Management topic flow end-to-end`.

## Self-Review
- Every spec section (outline, capacity numbers, invariants, components, testing) maps to a task above. ✅
- No placeholder numbers — capacity results are fixed in the spec and Task 1. ✅
- Export names checked for clash before registering (Tasks 1–2). ✅
- Registry `undefined` assertion migration handled (Task 3). ✅
