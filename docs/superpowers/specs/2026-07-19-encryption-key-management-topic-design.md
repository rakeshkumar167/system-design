# Encryption & Key Management Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `encryption-key-management` (category `security`)

## Goal

Author the **fifth** topic in the Security category, reusing the topic-content pipeline built with
[Authentication](2026-06-27-authentication-topic-design.md),
[TLS/HTTPS and Certificates](2026-06-27-tls-https-certificates-topic-design.md),
[Authorization](2026-07-18-authorization-topic-design.md), and
[Password Hashing](2026-07-19-password-hashing-topic-design.md). The topic is **Encryption & Key
Management** — protecting data *confidentiality* when it is stored and moved, and the harder half:
managing the keys. It covers the **symmetric/asymmetric** split and hybrid encryption; the three
data states (**at rest, in transit, in use**); **envelope encryption** and the **DEK/KEK key
hierarchy**; the **KMS** and **HSM** (crypto-as-a-service, hardware root of trust); a capacity model
for why you cache data keys instead of calling the KMS per operation; **key rotation and lifecycle**
(and **crypto-shredding**); **key management in practice** (access control, separation of duties,
audit, BYOK, per-tenant keys); and the pitfalls (hardcoded keys, ECB, nonce reuse, homemade crypto,
losing keys = losing data).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout`
chrome and the learning components; nested route `/topics/security/encryption-key-management`). The
pipeline exists, so the new work is content + a registry entry + a capacity model + two diagrams +
flipping the card to `available`.

## Scope

**In scope:** the goal of **confidentiality** (encrypted data is useless to whoever steals it) and
the maxim that **"encryption is easy, key management is hard"**; **symmetric** encryption (one shared
key, fast — **AES**) vs **asymmetric** (a public/private **keypair**, slow — **RSA/ECC**), and
**hybrid** encryption (asymmetric to exchange a symmetric key — the pattern TLS uses); the three
**data states** — **at rest** (disk/volume/TDE/field-level), **in transit** (TLS — cross-ref), **in
use** (confidential computing / enclaves, briefly); **envelope encryption** — a per-object **data
encryption key (DEK)** encrypts the data, a **key encryption key (KEK)** / master key encrypts the
DEK, so you store the **wrapped DEK next to the ciphertext** and only the KEK is precious; the
**key hierarchy** (root/master → KEK → DEK); the **KMS** (a key-management service that performs
crypto so keys never leave — AWS KMS, GCP KMS, HashiCorp Vault) and **HSM** (tamper-resistant
hardware, **FIPS 140-2/3**, the root of trust); a **capacity model** for why envelope encryption +
a **DEK cache** turns a KMS-call-per-operation into a KMS-call-per-key; **key lifecycle** —
generation, activation, **rotation**, expiry, revocation, destruction — rotating the KEK by
**re-wrapping DEKs** (not re-encrypting all data), and **crypto-shredding** (destroy the key to make
the data unrecoverable); **key management in practice** — IAM/access policies on keys, **separation
of duties**, **audit logging** of key use, **BYOK/HYOK**, **per-tenant keys** for isolation and
crypto-shredding; pitfalls (**hardcoded/committed keys**, **ECB mode**, **nonce/IV reuse**,
home-rolled crypto, no rotation, storing **key and data in the same blast radius**, **losing the key
= losing the data**).

**Out of scope (cross-reference, don't duplicate):** the TLS handshake, certificates, and the PKI
chain of trust ([TLS/HTTPS](/topics/security/tls-https-certificates) — referenced for in-transit and
hybrid encryption); one-way password storage
([Password Hashing](/topics/security/password-hashing) — hashing is *not* encryption); proving
identity ([Authentication](/topics/security/authentication)) and access decisions
([Authorization](/topics/security/authorization) — IAM on keys is *named*, not taught); a full
[secrets-management](/topics/security/secrets-management) treatment (storing/rotating app secrets is
its own topic — the KMS here manages *encryption keys*, and the overlap is noted, not taught); deep
cryptographic algorithm internals (AES/RSA/ECC math is *named*, not derived); any change to other
topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What Encryption & Key Management Is | fundamentals |
| 2 | `symmetric-asymmetric` | Symmetric vs Asymmetric Encryption | fundamentals |
| 3 | `data-states` | Data at Rest, in Transit, in Use | interview-ready |
| 4 | `envelope-encryption` | Envelope Encryption & the Key Hierarchy | interview-ready |
| 5 | `kms-hsm` | KMS & HSMs | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Cost of Encryption | interview-ready |
| 7 | `key-rotation-lifecycle` | Key Rotation & Lifecycle | advanced |
| 8 | `key-management-in-practice` | Key Management in Practice | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What Encryption & Key Management Is** — encryption makes data **confidential**: transformed so
   that only a holder of the right **key** can read it, and useless to anyone who steals the storage.
   The algorithms are standardized and easy to call; the hard, system-design part is **key
   management** — generating, storing, distributing, rotating, and destroying keys without ever
   leaking them or losing them. `Callout variant="info"`: "encryption is easy, key management is
   hard — the cipher is a library call; protecting the key is the system." Note the contrast with the
   [Password Hashing](/topics/security/password-hashing) topic (one-way, no key) and
   [TLS](/topics/security/tls-https-certificates) (encryption in transit).
2. **Symmetric vs Asymmetric Encryption** — **symmetric** uses **one shared secret key** for both
   encrypt and decrypt (**AES**); it's **fast** and ideal for bulk data, but both sides need the same
   key (the distribution problem). **Asymmetric** uses a **keypair** — a public key encrypts, only
   the private key decrypts (**RSA, ECC**); it solves distribution but is **orders of magnitude
   slower**, so it's used on small payloads. **Hybrid encryption** combines them: use asymmetric to
   share a fresh symmetric key, then symmetric for the data — exactly what TLS does (cross-ref).
   `TradeoffTable` (symmetric vs asymmetric: key model, speed, use). ≥1 `<KnowledgeCheck>`.
3. **Data at Rest, in Transit, in Use** — data must be protected in **three states**. **At rest**:
   stored data — full-disk/volume encryption, **transparent database encryption (TDE)**, or
   **field-level** encryption for the most sensitive columns. **In transit**: data on the wire —
   **TLS** (cross-ref the TLS topic). **In use**: data live in memory — the hardest, addressed by
   **confidential computing / secure enclaves** (brief). The interview point: "encrypted" is
   meaningless without saying *which state* and *against which threat* (disk theft ≠ network
   eavesdropping ≠ a compromised host). ≥1 `<KnowledgeCheck>`.
4. **Envelope Encryption & the Key Hierarchy** — you don't encrypt data directly with the master
   key. Instead: a per-object **data encryption key (DEK)** encrypts the data (fast symmetric AES),
   and a **key encryption key (KEK)** — the master key, held in the KMS — encrypts (**wraps**) the
   DEK. You store the **wrapped DEK right next to the ciphertext**; the plaintext DEK is used and
   discarded. Why: only the KEK is precious (one key to guard, not millions), you can **rotate the
   KEK by re-wrapping DEKs** without touching the data, and the data + wrapped key can live together
   safely because the wrapped key is worthless without the KEK. Introduces the **key hierarchy**
   (root/master → KEK → DEK). Embed `<EnvelopeEncryptSequence />`. ≥1 `<KnowledgeCheck>`.
5. **KMS & HSMs** — a **Key Management Service** is crypto-as-a-service: it **generates, stores, and
   uses keys so the key material never leaves** — you send it a wrapped DEK and it returns the
   plaintext DEK (or does the encrypt/decrypt), but the KEK itself is never exported. An **HSM**
   (Hardware Security Module) is tamper-resistant hardware, certified to **FIPS 140-2/3**, that is
   the **root of trust** underneath a KMS. Cloud KMSs (AWS KMS, GCP KMS, Azure Key Vault) and
   Vault give this as a managed service, typically HSM-backed. The model: **the KMS is the one thing
   that touches the master key; everything else just asks it.** ≥1 `<KnowledgeCheck>`.
6. **Capacity: The Cost of Encryption** — `EncryptionCapacity` fed by
   `lib/encryption-key-management-estimates.ts`. The cipher (AES) is nearly free and often
   hardware-accelerated; the real cost and bottleneck is the **KMS call**. Naively calling the KMS to
   unwrap a DEK on **every** operation would need a KMS call per op — far beyond KMS quotas and a
   network hop each. Envelope encryption + a **DEK cache** (one DEK protects many objects, cache the
   plaintext DEK briefly) collapses that. Headline: at 500k ops/s, a KMS-per-op design needs
   **500,000 KMS calls/s** (impossible); a **99.9%-hit DEK cache** drops it to **500 KMS calls/s** —
   a **1,000× reduction** — while the local AES work is only ~**5 cores**. So encryption throughput
   is bounded by **KMS calls, not the cipher**, and DEK caching is what makes it scale — traded
   against a cached key's blast radius (bounded by the cache TTL).
7. **Key Rotation & Lifecycle** — keys have a lifecycle: **generate → activate → rotate → expire →
   revoke → destroy**. **Rotation** limits the damage of a leaked key and the volume encrypted under
   any one key, but re-encrypting all data on every rotation is infeasible — so with envelope
   encryption you **rotate the KEK and re-wrap the (small) DEKs**, leaving the bulk ciphertext
   untouched; DEKs themselves rotate as data is rewritten. **Crypto-shredding**: because data is
   unreadable without its key, **destroying the key reliably destroys the data** — the practical way
   to "delete" data that's replicated/backed-up everywhere (e.g. per-user keys for GDPR erasure).
   `Callout` on crypto-shredding. ≥1 `<KnowledgeCheck>` may live here or later.
8. **Key Management in Practice** — the operational disciplines: **access control on keys** (IAM
   policies — who may use vs manage a key; cross-ref [Authorization](/topics/security/authorization)),
   **separation of duties** (the people who use keys can't exfiltrate them; key admins can't read
   data), **audit logging** of every key use (a KMS logs each decrypt — an investigation and
   anomaly-detection goldmine), **never hardcode/commit keys** (they belong in the KMS, not source),
   **BYOK/HYOK** (bring/hold your own key for customer trust and control), and **per-tenant keys**
   (isolation, and crypto-shredding a single tenant). Embed `<EnvelopeDecryptSequence />` here (shows
   the KMS unwrap + DEK caching on the read path). ≥1 `<KnowledgeCheck>`.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **hardcoded / committed keys** (keys
   in source control or images — the most common leak), **ECB mode** (identical plaintext blocks →
   identical ciphertext, leaks structure; use an authenticated mode like **AES-GCM**), **nonce/IV
   reuse** (catastrophic for stream/GCM modes — reused nonce breaks confidentiality/integrity),
   **home-rolled crypto** (use vetted libraries and standard modes), **no rotation** (one key
   forever, unbounded blast radius), **key and data in the same blast radius** (the wrapped DEK is
   fine next to data, but the *KEK* must live in the KMS, not the app DB), and **losing the key**
   (no key = permanently unrecoverable data — key durability and backup are as vital as secrecy). A
   `DecisionRecord` with the default recommendation (AES-GCM, envelope encryption, KMS/HSM-backed
   KEK, DEK caching, scheduled rotation, per-tenant keys, IAM + audit).
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total across the page, plus a `<Faq>` with
    **≥ 10** entries (symmetric vs asymmetric; hybrid; three states; envelope encryption; DEK vs KEK;
    what a KMS/HSM is; why cache DEKs; rotation without re-encrypting; crypto-shredding; ECB/nonce;
    hardcoded keys; losing keys; encryption vs hashing).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. (No `ApiContract` —
encryption/key management is a crypto/storage concern, not a REST API. `TradeoffTable` for
symmetric vs asymmetric.)

### New, Encryption-specific
- `lib/encryption-key-management-estimates.ts` — pure capacity calc, typed
  `EncryptionCapacityAssumptions` / `EncryptionCapacityResults`.
- `components/learning/encryption-key-management-capacity.tsx` — wraps `CapacityTable`, registered as
  `EncryptionCapacity`.
- `components/diagrams/encryption-key-management-flows.tsx` — `EnvelopeEncryptSequence` (app asks KMS
  for a data key → gets plaintext DEK + wrapped DEK → encrypts locally with AES → stores ciphertext +
  wrapped DEK → discards plaintext DEK) and `EnvelopeDecryptSequence` (app reads ciphertext + wrapped
  DEK → sends wrapped DEK to KMS → KMS unwraps with the KEK → returns plaintext DEK → app decrypts
  locally and caches the DEK). Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `encryption-key-management` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `EncryptionCapacity`, `EnvelopeEncryptSequence`,
  `EnvelopeDecryptSequence`.
- `lib/topics.ts` — flip `encryption-key-management` to `available`.
- `content/topics/encryption-key-management.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing
  `getTopic` "returns undefined" check from `encryption-key-management` to a still-coming-soon slug
  (`owasp-top-10`).

## Capacity Model (exact)

`lib/encryption-key-management-estimates.ts`, pure & deterministic. Integer cores via `Math.ceil`.

Assumptions (used in the MDX embed and the test):
```ts
{
  operationsPerSec: 500_000,
  kmsUnwrapMs: 20,
  dekCacheHitRate: 0.999,
  aesEncryptMs: 0.01,
  msPerCorePerSec: 1_000,
}
```

Results (deterministic):
- `naiveKmsCallsPerSec` = 500,000 (one unwrap per op) = **500,000** /s
- `cachedKmsCallsPerSec` = 500,000 × (1 − 0.999) = **500** /s
- `kmsReductionFactor` = 500,000 / 500 = **1,000**
- `localCryptoCores` = ceil(500,000 × 0.01 / 1,000) = **5**

Headline lesson: the cipher isn't the cost — the **KMS call is**. Unwrapping a data key on every one
of 500,000 ops/s would mean **500,000 KMS calls/s**, which blows past KMS quotas and adds a network
hop to every operation. Envelope encryption lets one DEK protect many objects, so caching the
plaintext DEK for a short window cuts KMS traffic to **500 calls/s** — a **1,000× reduction** — while
the actual AES encryption is ~**5 cores** of nearly-free, hardware-accelerated local compute. So
encryption is sized by **KMS calls, not cipher throughput**, and DEK caching is the lever — traded
against the **blast radius** of a cached key (a leaked cached DEK exposes its objects until the TTL
expires, which is why the TTL is short and the KEK never leaves the KMS).

## Numerical & Terminology Invariants

- Encryption provides **confidentiality**; **"encryption is easy, key management is hard."** (Distinct
  from one-way [password hashing](/topics/security/password-hashing).)
- **Symmetric** = one shared key, fast (**AES**); **asymmetric** = public/private keypair, slow
  (**RSA/ECC**); **hybrid** = asymmetric to exchange a symmetric key (what TLS does).
- Three data states: **at rest** (disk/TDE/field), **in transit** (**TLS**), **in use** (enclaves).
- **Envelope encryption**: **DEK** encrypts data, **KEK** (master key) wraps the DEK; store the
  **wrapped DEK next to the ciphertext**; only the KEK is precious. Hierarchy: root → KEK → DEK.
- **KMS** performs crypto so **keys never leave**; **HSM** = tamper-resistant hardware, **FIPS
  140-2/3**, the root of trust.
- Capacity: 500k ops/s ⇒ naive **500,000 KMS calls/s**; a 99.9% DEK cache ⇒ **500 calls/s**
  (**1,000×** cut); local AES ≈ **5 cores**. Sized by **KMS calls, not the cipher**.
- Lifecycle: generate→activate→rotate→expire→revoke→destroy. **Rotate the KEK by re-wrapping DEKs**
  (don't re-encrypt all data). **Crypto-shredding**: destroy the key to destroy the data.
- Practice: **IAM on keys**, **separation of duties**, **audit every key use**, **never hardcode
  keys**, **BYOK**, **per-tenant keys**. Pitfalls: **ECB**, **nonce/IV reuse**, **losing the key =
  losing the data** (use **AES-GCM**).

## Testing

- `tests/topic-registry.test.ts` — add: `encryption-key-management` registered; 10 sections; unique
  ids + valid depths. **Update** the existing "`getTopic` returns undefined" assertion to use
  `owasp-top-10` (still coming-soon). Prior topic assertions stay.
- `tests/encryption-key-management-content.test.ts` — all 10 required `h2` ids present; embeds
  `<EncryptionCapacity`, `<EnvelopeEncryptSequence`, `<EnvelopeDecryptSequence`; capacity
  `assumptions` exactly match the estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/encryption-key-management-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the Encryption card links through; navigate to
  `/topics/security/encryption-key-management#envelope-encryption` (direct `page.goto`) and assert
  the heading and a diagram `img`. The curriculum "showing 1 of 33" / "coming soon" assertions are
  **untouched**. (Use a **mid-page** section for the mobile in-viewport check — deep sections don't
  scroll into the mobile viewport. Run e2e with `--workers=1` to avoid the parallel `toBeInViewport`
  flake.)

## Out of Scope

TLS handshake/PKI (TLS topic), one-way password hashing (Password Hashing topic), identity/authz
(their topics — IAM on keys is named), full secrets-management, cryptographic algorithm internals,
and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for Encryption & Key Management topic`
2. `feat: add Encryption & Key Management capacity model and wrapper`
3. `feat: add envelope encrypt and decrypt diagrams`
4. `feat: register Encryption & Key Management topic route and skeleton`
5. `content: complete Encryption & Key Management topic`
6. `test: verify Encryption & Key Management topic flow end-to-end`
