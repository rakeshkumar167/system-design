# TLS/HTTPS and Certificates Topic — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Topic:** `tls-https-certificates` (category `security`)

## Goal

Author the **second** topic in the Security category, reusing the topic-content pipeline built with
[Authentication](2026-06-27-authentication-topic-design.md). The topic is **TLS/HTTPS and
Certificates** — how a connection becomes private, tamper-proof, and authenticated: the
symmetric/asymmetric crypto split, the TLS handshake, certificates and the PKI chain of trust,
certificate lifecycle (issuance/expiry/revocation), HTTPS in practice, and TLS termination/mTLS.

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout`
chrome and the learning components; nested route `/topics/security/tls-https-certificates`). Since
the pipeline exists, the new work is content + a registry entry + a capacity model + two diagrams +
flipping the card to `available`.

## Scope

**In scope:** what TLS/HTTPS provide (confidentiality, integrity, authentication) and that HTTPS =
HTTP over TLS; **symmetric vs asymmetric** crypto and the key-distribution problem TLS solves;
the **TLS handshake** (key exchange to agree a shared secret over an insecure channel, ephemeral
Diffie-Hellman / forward secrecy, TLS 1.3 vs 1.2 at a high level, session resumption / 0-RTT); a
**capacity model** for the CPU cost of handshakes and how resumption amortizes it; **certificates
& the chain of trust** (X.509, CAs, root/intermediate/leaf, how a browser validates a chain to a
trusted root); **certificate lifecycle** (DV/OV/EV, expiry, ACME/Let's Encrypt automation,
revocation via CRL/OCSP/OCSP stapling); **HTTPS in practice** (SNI, ALPN, HSTS, http→https
redirect, mixed content); **TLS termination & mTLS** (where TLS terminates — LB/reverse-proxy/CDN
edge — termination vs passthrough vs re-encryption, mutual TLS for service-to-service);
pitfalls/best practices.

**Out of scope (cross-reference, don't duplicate):** password hashing and token/credential auth
(the [Authentication](/topics/security/authentication) topic — TLS authenticates the *server/
connection*, not the user's login); deep cipher/algorithm internals and the math of AES/RSA/ECDHE
(named, not derived); [encryption & key management](/topics/security/encryption-key-management) at
rest (a separate topic); VPNs and non-web TLS uses beyond a mention.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What TLS & HTTPS Are | fundamentals |
| 2 | `symmetric-asymmetric` | Symmetric vs Asymmetric Crypto | fundamentals |
| 3 | `tls-handshake` | The TLS Handshake | interview-ready |
| 4 | `capacity-estimates` | Capacity: The Cost of TLS | interview-ready |
| 5 | `certificates-pki` | Certificates & the Chain of Trust | interview-ready |
| 6 | `certificate-lifecycle` | Issuance, Expiry & Revocation | advanced |
| 7 | `https-in-practice` | HTTPS in Practice | interview-ready |
| 8 | `tls-termination` | TLS Termination & mTLS | advanced |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What TLS & HTTPS Are** — TLS (formerly SSL) is the protocol that makes a connection secure;
   **HTTPS is just HTTP over TLS**. It provides three guarantees: **confidentiality** (encryption
   — eavesdroppers see ciphertext), **integrity** (tamper-evidence — MITM can't alter messages
   undetected), and **authentication** (you're talking to the *real* server, via its certificate).
   `Callout variant="info"` naming the three guarantees and "HTTPS = HTTP + TLS."
2. **Symmetric vs Asymmetric Crypto** — **symmetric** (one shared key, fast, used for bulk data)
   vs **asymmetric** (public/private key pair, slow, solves key distribution). The core problem:
   two strangers must agree on a shared symmetric key over a channel an attacker is watching,
   *without* transmitting the key. Asymmetric crypto (and Diffie-Hellman key exchange) solves it.
   TLS is a **hybrid**: asymmetric to establish a shared secret, then symmetric to encrypt the
   actual traffic — best of both. Sets up the handshake. ≥1 `<KnowledgeCheck>`.
3. **The TLS Handshake** — the negotiation before any data: client and server agree on protocol
   version + cipher suite, the server presents its **certificate** (proving identity), and they
   perform a **key exchange** (ephemeral Diffie-Hellman) to derive a shared symmetric session key
   that an eavesdropper can't reconstruct — giving **forward secrecy** (a later key compromise
   can't decrypt past sessions). TLS 1.3 streamlines this to one round trip (and 0-RTT resumption);
   TLS 1.2 took two. Embed `<TlsHandshakeSequence />`. ≥1 `<KnowledgeCheck>`.
4. **Capacity: The Cost of TLS** — `TlsCapacity` fed by `lib/tls-estimates.ts`. The asymmetric
   handshake is the expensive part (CPU); bulk symmetric encryption is cheap. **Session resumption**
   (and keep-alive) amortize handshakes. Headline: at 50k new connections/sec, full handshakes cost
   ~100 CPU cores; with 80% resumed, ~24 cores — resumption cuts handshake CPU ~4×, which is why TLS
   termination is sized by *handshakes*, not bytes.
5. **Certificates & the Chain of Trust** — an **X.509 certificate** binds a domain to a public key,
   signed by a **Certificate Authority (CA)**. Trust is a **chain**: the server's **leaf** cert is
   signed by an **intermediate** CA, signed (ultimately) by a **root** CA whose certificate ships
   pre-installed in the OS/browser **trust store**. The client validates the chain up to a trusted
   root, checks the domain matches and the cert is unexpired. This is **PKI**. Embed
   `<CertValidationSequence />`. ≥1 `<KnowledgeCheck>`.
6. **Issuance, Expiry & Revocation** — getting a cert: **domain validation (DV)** (prove control of
   the domain — automated via **ACME/Let's Encrypt**), vs OV/EV (more vetting). Certs **expire**
   (short lifetimes now the norm — automate renewal or you get the dreaded "certificate expired"
   outage). **Revocation** before expiry: **CRL** (revocation lists), **OCSP** (online status
   check), and **OCSP stapling** (server attaches a fresh signed status so the client needn't ask
   the CA — fixing OCSP's latency/privacy problems).
7. **HTTPS in Practice** — operational HTTPS: **SNI** (the client says which hostname it wants in the
   ClientHello, so one IP can host many TLS sites), **ALPN** (negotiate HTTP/2 vs HTTP/1.1 during
   the handshake), **HSTS** (a header forcing browsers to use HTTPS, preventing downgrade), the
   **http→https redirect**, and **mixed content** (an HTTPS page loading http assets is unsafe and
   blocked). ≥1 `<KnowledgeCheck>` may live here or later.
8. **TLS Termination & mTLS** — **where** TLS ends: usually at the edge — a **load balancer,
   reverse proxy, or CDN** terminates TLS and forwards plaintext (or re-encrypts) to backends —
   centralizing certs and offloading handshake CPU. **Termination vs passthrough vs
   re-encryption**. **Mutual TLS (mTLS)**: both sides present certificates, so the *client* is
   authenticated too — the backbone of zero-trust service-to-service auth and service meshes.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: expired certificates (the #1
   outage — automate renewal), weak/old protocol versions and cipher suites (disable SSLv3/TLS 1.0/
   1.1), self-signed/untrusted chains, not validating the hostname, downgrade & stripping attacks
   (mitigate with HSTS), protecting the private key, and prefer TLS 1.3 + forward secrecy. A
   `DecisionRecord` with the default recommendation.
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total across the page, plus a `<Faq>` with
    **≥ 10** entries.

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. (No `ApiContract` —
TLS is a wire protocol, not a REST API; a `TradeoffTable` for termination modes fits better.)

### New, TLS-specific
- `lib/tls-estimates.ts` — pure capacity calc, typed `TlsCapacityAssumptions` / `TlsCapacityResults`.
- `components/learning/tls-capacity.tsx` — wraps `CapacityTable`, registered as `TlsCapacity`.
- `components/diagrams/tls-flows.tsx` — `TlsHandshakeSequence` (the handshake → derived session key
  → encrypted application data) and `CertValidationSequence` (server presents chain → client
  verifies up to a trusted root in its store). Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `tls-https-certificates` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `TlsCapacity`, `TlsHandshakeSequence`, `CertValidationSequence`.
- `lib/topics.ts` — flip `tls-https-certificates` to `available`.
- `content/topics/tls-https-certificates.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic.

## Capacity Model (exact)

`lib/tls-estimates.ts`, pure & deterministic. Integer core counts via `Math.ceil`.

Assumptions (used in the MDX embed and the test):
```ts
{
  newConnectionsPerSec: 50_000,
  fullHandshakeCpuMs: 2,
  resumedHandshakeCpuMs: 0.1,
  resumptionRate: 0.8,
  msPerCorePerSec: 1_000,
}
```

Results (deterministic):
- `fullHandshakesPerSec` = 50,000 × (1 − 0.8) = **10,000** /s
- `resumedHandshakesPerSec` = 50,000 × 0.8 = **40,000** /s
- `handshakeCpuMsPerSec` = 10,000 × 2 + 40,000 × 0.1 = **24,000** ms/s
- `coresWithResumption` = ceil(24,000 / 1,000) = **24**
- `coresWithoutResumption` = ceil(50,000 × 2 / 1,000) = **100**

Headline lesson: the **asymmetric handshake is the expensive part** of TLS — bulk symmetric
encryption of the actual bytes is cheap. A full handshake costs real CPU (~2 ms here); a **resumed**
session is ~20× cheaper. So TLS-termination capacity is sized by **handshakes per second**, not
throughput, and **session resumption + keep-alive** are the dominant optimization: resuming 80% of
connections cuts the CPU from ~**100 cores to ~24** (~4×). That is why TLS is terminated at a
shared, optimized edge (LB/CDN) rather than re-handshaked everywhere.

## Numerical & Terminology Invariants

- HTTPS = **HTTP over TLS**; TLS gives **confidentiality + integrity + authentication**.
- **Symmetric** = one shared key, fast, bulk data; **asymmetric** = key pair, slow, solves key
  distribution. TLS is a **hybrid**: asymmetric handshake → symmetric session.
- The **handshake** agrees a shared session key via **ephemeral Diffie-Hellman** (→ **forward
  secrecy**); TLS 1.3 = 1-RTT (+ 0-RTT resumption), TLS 1.2 = 2-RTT.
- Capacity: handshake CPU dominates; **resumption cuts ~100 cores → ~24** (~4×) at 50k conn/s.
- **Chain of trust**: leaf ← intermediate CA ← root CA in the **trust store**; client validates the
  chain + hostname + expiry. This is **PKI**.
- Lifecycle: **DV/OV/EV**, **ACME/Let's Encrypt** auto-renewal, **expiry** outages; revocation =
  **CRL / OCSP / OCSP stapling**.
- Practice: **SNI** (host selection), **ALPN** (protocol negotiation), **HSTS** (force HTTPS),
  http→https redirect, **mixed content**.
- **Termination** at the edge (LB/reverse-proxy/CDN); **mTLS** authenticates both sides
  (service-to-service / zero-trust).

## Testing

- `tests/topic-registry.test.ts` — add: `tls-https-certificates` registered; 10 sections; unique
  ids + valid depths. (Existing authentication assertions and the "returns undefined" check —
  `getTopic("authorization")` — stay valid.)
- `tests/tls-content.test.ts` — all 10 required `h2` ids present; embeds `<TlsCapacity`,
  `<TlsHandshakeSequence`, `<CertValidationSequence`; capacity `assumptions` exactly match the
  estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/tls-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the TLS card links through; navigate to
  `/topics/security/tls-https-certificates#tls-handshake` (direct `page.goto`) and assert the
  heading and the handshake diagram `img`.

## Out of Scope

Password/credential auth (Authentication topic), encryption-at-rest & KMS (its own topic), cipher
math, VPNs/non-web TLS beyond a mention, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for TLS/HTTPS and Certificates topic`
2. `feat: add TLS capacity model and wrapper`
3. `feat: add TLS handshake and certificate-chain diagrams`
4. `feat: register TLS topic route and skeleton`
5. `content: complete TLS/HTTPS and Certificates topic`
6. `test: verify TLS topic flow end-to-end`
