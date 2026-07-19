# Password Hashing Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `password-hashing` (category `security`)

## Goal

Author the **fourth** topic in the Security category, reusing the topic-content pipeline built with
[Authentication](2026-06-27-authentication-topic-design.md),
[TLS/HTTPS and Certificates](2026-06-27-tls-https-certificates-topic-design.md), and
[Authorization](2026-07-18-authorization-topic-design.md). The topic is **Password Hashing** — how a
system stores credentials so that a database breach does *not* hand attackers everyone's password:
why passwords are **hashed, never encrypted or stored plaintext**; **salting** and why it kills
rainbow tables; **slow/adaptive hashing** and the **work factor**; the modern **memory-hard
algorithms** (**Argon2**, **scrypt**, **bcrypt**, **PBKDF2**); a capacity model for the *deliberate*
CPU/RAM cost of hashing at login and the attacker-slowdown it buys; **peppering** and credential
storage in depth; **verification in practice** (constant-time compare, upgrade-on-login, timing and
user-enumeration defenses); and the pitfalls (fast hashes, missing salt, unbounded password input,
DoS via login).

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout`
chrome and the learning components; nested route `/topics/security/password-hashing`). The pipeline
exists, so the new work is content + a registry entry + a capacity model + two diagrams + flipping
the card to `available`.

## Scope

**In scope:** the threat model (**offline attack on a stolen credential store**); why you **never
store plaintext** and **never reversibly encrypt** passwords — the store must be **one-way**, so a
breach yields hashes, not passwords; **hashing vs encryption** (one-way digest vs reversible
ciphertext; no key to steal); **salting** — a unique random salt per password defeats **rainbow
tables** and stops identical passwords sharing a hash; **slow hashing** — general-purpose hashes
(MD5, SHA-256) are *too fast*, so password hashing uses **deliberately slow, adaptive** functions
with a tunable **work factor / cost** that's raised as hardware improves; the **algorithms** —
**Argon2** (id, the modern default; **memory-hard**), **scrypt** (memory-hard), **bcrypt** (battle-
tested, moderate), **PBKDF2** (FIPS, iteration-based, *not* memory-hard) — and **memory-hardness** as
the property that defeats GPU/ASIC parallelism; a **capacity model** for the CPU cores and RAM to
hash at the login rate, plus the **attacker slowdown factor**; **peppering** — a secret added from a
KMS/HSM, kept *outside* the database, so a DB-only breach is still not crackable (defense in depth);
**credential storage** — store `algorithm + parameters + salt + hash` together so cost can evolve;
**verification** — recompute and **constant-time compare**, **rehash-on-login** when the cost is
raised, and the **timing / user-enumeration** side channels; pitfalls/best practices (fast hashes,
homemade schemes, missing/global salt, unbounded input enabling **login-time DoS**, logging
passwords).

**Out of scope (cross-reference, don't duplicate):** proving identity and issuing sessions/tokens —
login flows, JWT, OAuth, MFA (the [Authentication](/topics/security/authentication) topic; password
hashing is the *storage* half of password login); deciding what a user may do
([Authorization](/topics/security/authorization)); transport encryption and the symmetric/asymmetric
split ([TLS/HTTPS](/topics/security/tls-https-certificates) — referenced for "hashing ≠ encryption");
a full [secrets-management](/topics/security/secrets-management) treatment (the pepper is stored in a
KMS/HSM — *named*, not taught); generic [rate limiting](/topics/security/rate-limiting) (referenced
as a login-DoS defense); any change to other topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What Password Hashing Is | fundamentals |
| 2 | `hashing-vs-encryption` | Hashing vs Encryption | fundamentals |
| 3 | `salting` | Salting & Rainbow Tables | interview-ready |
| 4 | `slow-hashing` | Slow Hashing & the Work Factor | interview-ready |
| 5 | `algorithms` | The Algorithms: Argon2, scrypt, bcrypt, PBKDF2 | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Cost of Hashing | interview-ready |
| 7 | `peppering-storage` | Peppering & Credential Storage | advanced |
| 8 | `verification-in-practice` | Verification in Practice | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What Password Hashing Is** — the goal is that a **stolen credential database is useless**. You
   store a **one-way transformation** of the password, never the password itself, so that even the
   people who run the system (and anyone who breaches it) cannot recover it. At login you recompute
   the transformation and compare. `Callout variant="info"`: "you never store, log, or transmit the
   plaintext password — only a salted, slow, one-way hash." Embed `<PasswordRegistrationSequence />`
   here (hash-and-store at registration).
2. **Hashing vs Encryption** — the crucial distinction: **encryption is reversible** (there's a key,
   and whoever has it gets the plaintext back), **hashing is one-way** (there's no key and no inverse
   — you can only recompute and compare). Passwords must be **hashed**, because reversible storage
   means the decryption key becomes a single point of catastrophic failure; a hash has nothing to
   steal that reverses it. Cross-reference the [TLS](/topics/security/tls-https-certificates) topic
   for encryption proper. Note a *password hash* ≠ a *general-purpose* hash (next two sections
   explain why). ≥1 `<KnowledgeCheck>`.
3. **Salting & Rainbow Tables** — a **salt** is a unique, random value generated per password and
   stored **alongside** the hash (it is *not* secret). Hash `= H(salt || password)`. Without a salt,
   attackers precompute **rainbow tables** (giant lookup tables of hash→password) once and crack any
   database instantly, and identical passwords produce identical hashes (visible in a breach). A
   **unique per-user salt** makes precomputation worthless — the attacker must attack each password
   separately — and hides which users share a password. `TradeoffTable`? No — use prose + a code
   block showing stored `salt:hash`. ≥1 `<KnowledgeCheck>`.
4. **Slow Hashing & the Work Factor** — salting defeats *precomputation* but not *brute force*:
   given the salt, an attacker still guesses. General-purpose hashes (**MD5, SHA-256**) are designed
   to be **fast** — billions/sec on a GPU — which is exactly wrong for passwords. Password hashing
   uses functions that are **deliberately slow** and have a tunable **work factor / cost** (bcrypt
   cost, PBKDF2 iterations, Argon2 time+memory). You tune it so one hash takes ~**200–300 ms** — a
   trivial cost once per login, but a devastating multiplier across an attacker's billions of
   guesses — and you **raise it over time** as hardware gets faster. ≥1 `<KnowledgeCheck>`.
5. **The Algorithms: Argon2, scrypt, bcrypt, PBKDF2** — the four you should know, and **memory-
   hardness** as the modern differentiator. A fast hash is cheap to *parallelize* on GPUs/ASICs; a
   **memory-hard** function forces each guess to use a lot of **RAM**, which GPUs/ASICs have far less
   of per core — so it neutralizes their advantage. `TradeoffTable` over the four:
   **Argon2** (id variant; memory-hard; the current default / PHC winner), **scrypt** (memory-hard;
   older), **bcrypt** (Blowfish-based; battle-tested; *not* strongly memory-hard; ~72-byte input
   cap), **PBKDF2** (HMAC iterations; FIPS-approved; *not* memory-hard — weakest against GPUs).
   Recommendation: **Argon2id** for new systems, **bcrypt** where Argon2 isn't available, **PBKDF2**
   only when FIPS compliance forces it. ≥1 `<KnowledgeCheck>`.
6. **Capacity: The Cost of Hashing** — `PasswordHashingCapacity` fed by
   `lib/password-hashing-estimates.ts`. Hashing is the rare place you *want* to be slow, and the cost
   is real and must be **sized for the peak login rate** (never per request). Headline: at 5,000
   logins/s with a 250 ms hash, you need ~**1,250 cores** and, for a memory-hard hash at 64 MiB,
   ~**80,000 MiB (~78 GiB)** of RAM at peak concurrency — which is why you hash only at login, and
   rate-limit login so an attacker can't weaponize it as a **CPU-exhaustion DoS**. The same 250 ms
   that's a rounding error for one login is catastrophic for the attacker: a fast hash lets a GPU try
   ~**10 billion/s**, but this memory-hard hash drops it to ~**2,000/s** — a **5,000,000× slowdown**
   that turns a minutes-long crack of a breached DB into geological time.
7. **Peppering & Credential Storage** — **defense in depth** beyond the salt: a **pepper** is a
   *secret* value combined with every password before (or after) hashing — but unlike the salt it is
   **not stored in the database**; it lives in an HSM/KMS or app config. A **database-only** breach
   (the common case — SQL injection, a leaked backup) then yields hashes that **cannot be cracked
   without also stealing the pepper**. Store the full **`algorithm$parameters$salt$hash`** string
   (as PHC/Modular-Crypt format does) so the system is **self-describing** and the cost can be raised
   without a migration. Note: the pepper trades a stronger breach story for the operational burden of
   a rotated, highly-guarded secret (cross-ref [secrets-management](/topics/security/secrets-management)).
   ≥1 `<KnowledgeCheck>` may live here or later.
8. **Verification in Practice** — the login path: fetch the stored record by username, **recompute**
   the hash with the *stored* salt and parameters, and **compare in constant time** (never `==` on
   the raw strings — an early-exit compare leaks how many bytes matched). **Upgrade-on-login**: when
   you raise the work factor (or migrate algorithms), you can only rehash a password when the user
   *supplies* it at login — so verification transparently **rehashes and re-stores** with the new
   cost. Two side channels to defend: **timing** (a "user not found" path must take as long as a real
   verify, or attacker learns which usernames exist) and **user enumeration** (identical error
   messages and timing for bad-user vs bad-password). Embed `<PasswordVerificationSequence />`.
   ≥1 `<KnowledgeCheck>`.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **using a fast/general-purpose hash**
   (MD5/SHA-256 with no stretching — the single most common breach amplifier), **no salt or a single
   global salt** (rainbow-table-able), **home-rolled schemes** ("SHA-256 twice"), **unbounded
   password length** feeding a memory-hard hash → **login-time DoS** (cap input length, e.g. 128
   chars, and rate-limit login), **not raising the cost over years**, **logging or storing the
   plaintext** (request logs, crash dumps), and **non-constant-time comparison**. A `DecisionRecord`
   with the default recommendation (Argon2id, unique salt, tuned cost, optional pepper in a KMS,
   store self-describing records, upgrade-on-login).
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total across the page, plus a `<Faq>` with
    **≥ 10** entries (hash vs encrypt; why salt; salt secret?; why slow; Argon2 vs bcrypt vs PBKDF2;
    memory-hardness; pepper; where to store cost/params; rehash-on-login; constant-time compare;
    login DoS; is a fast hash ever OK).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. (No `ApiContract` —
password hashing is a storage/crypto concern, not a REST API. `TradeoffTable` for the algorithms.)

### New, Password-Hashing-specific
- `lib/password-hashing-estimates.ts` — pure capacity calc, typed
  `PasswordHashingCapacityAssumptions` / `PasswordHashingCapacityResults`.
- `components/learning/password-hashing-capacity.tsx` — wraps `CapacityTable`, registered as
  `PasswordHashingCapacity`.
- `components/diagrams/password-hashing-flows.tsx` — `PasswordRegistrationSequence` (set password →
  generate random salt → hash with Argon2 at the tuned cost → store algorithm+params+salt+hash) and
  `PasswordVerificationSequence` (submit password → fetch stored record → recompute with stored
  salt/params → constant-time compare → allow/deny, rehash if cost is outdated). Both via
  `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `password-hashing` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `PasswordHashingCapacity`, `PasswordRegistrationSequence`,
  `PasswordVerificationSequence`.
- `lib/topics.ts` — flip `password-hashing` to `available`.
- `content/topics/password-hashing.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing
  `getTopic` "returns undefined" check from `password-hashing` to a still-coming-soon slug
  (`encryption-key-management`).

## Capacity Model (exact)

`lib/password-hashing-estimates.ts`, pure & deterministic. Integer cores via `Math.ceil`.

Assumptions (used in the MDX embed and the test):
```ts
{
  loginsPerSec: 5_000,
  hashCostMs: 250,
  hashMemoryMiB: 64,
  msPerCorePerSec: 1_000,
  attackerFastHashesPerSec: 10_000_000_000,
  attackerSlowHashesPerSec: 2_000,
}
```

Results (deterministic):
- `hashCoresNeeded` = ceil(5,000 × 250 / 1,000) = **1,250**
- `peakConcurrentHashes` = 5,000 × (250 / 1,000) = **1,250**
- `peakHashMemoryMiB` = 1,250 × 64 = **80,000**
- `attackerSlowdownFactor` = 10,000,000,000 / 2,000 = **5,000,000**

Headline lesson: password hashing is the one place slowness is a **feature**. Tuning a hash to ~250 ms
means a busy service (5,000 logins/s) burns ~**1,250 cores** and, at 64 MiB per memory-hard hash and
~1,250 concurrent hashes, ~**80,000 MiB (~78 GiB)** of RAM — so you hash **only at login**, never per
request, and **rate-limit login** so the cost can't be weaponized as a DoS. That same 250 ms is
catastrophic for an offline attacker who must try *billions* of guesses: a fast hash gives a GPU
~**10 billion/s**, but the tuned memory-hard hash yields ~**2,000/s** — a **5,000,000× slowdown** that
converts a minutes-long crack of a stolen database into effectively forever.

## Numerical & Terminology Invariants

- **Never store plaintext; never reversibly encrypt** passwords — store a **salted, slow, one-way
  hash**. At login you **recompute and compare**, never decrypt.
- **Hashing is one-way (no key); encryption is reversible (a key).** Passwords are **hashed**.
- **Salt** = unique, random, **per-password**, **stored in the clear** alongside the hash; defeats
  **rainbow tables** and hides shared passwords. **Pepper** = a **secret**, **not** in the DB (KMS/
  HSM); defends a DB-only breach.
- Password hashes are **deliberately slow** with a tunable **work factor / cost**, tuned to ~**200–
  300 ms** and **raised over time**. General-purpose hashes (MD5, SHA-256) are **too fast** — wrong
  for passwords.
- Algorithms: **Argon2id** (memory-hard; default) · **scrypt** (memory-hard) · **bcrypt** (battle-
  tested; ~72-byte cap; not strongly memory-hard) · **PBKDF2** (iterations; FIPS; not memory-hard).
  **Memory-hardness** defeats GPU/ASIC parallelism.
- Capacity: 5,000 logins/s × 250 ms = ~**1,250 cores**; 64 MiB × ~1,250 concurrent = ~**80,000 MiB**;
  attacker fast-vs-slow ratio 10e9 / 2e3 = **5,000,000×**.
- Store **`algorithm$params$salt$hash`** (self-describing); **rehash-on-login** to raise cost;
  **constant-time compare**; defend **timing / user-enumeration**; cap input length + **rate-limit
  login** to prevent a hashing **DoS**.

## Testing

- `tests/topic-registry.test.ts` — add: `password-hashing` registered; 10 sections; unique ids +
  valid depths. **Update** the existing "`getTopic` returns undefined" assertion to use
  `encryption-key-management` (still coming-soon) since `password-hashing` is now registered.
  Authentication + TLS + Authorization assertions stay.
- `tests/password-hashing-content.test.ts` — all 10 required `h2` ids present; embeds
  `<PasswordHashingCapacity`, `<PasswordRegistrationSequence`, `<PasswordVerificationSequence`;
  capacity `assumptions` exactly match the estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10
  `question:`.
- `tests/password-hashing-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the Password Hashing card links through; navigate to
  `/topics/security/password-hashing#slow-hashing` (direct `page.goto`) and assert the heading and a
  diagram `img`. The curriculum "showing 1 of 33" / "coming soon" assertions are **untouched** (a
  topic is not a curriculum problem).

## Out of Scope

Login/session/token issuance (Authentication topic), authorization (Authorization topic), transport
encryption (TLS topic), full secrets-management / KMS rotation (Secrets Management topic — the pepper
is *named*), standalone rate limiting, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for Password Hashing topic`
2. `feat: add Password Hashing capacity model and wrapper`
3. `feat: add Password Hashing registration and verification diagrams`
4. `feat: register Password Hashing topic route and skeleton`
5. `content: complete Password Hashing topic`
6. `test: verify Password Hashing topic flow end-to-end`
