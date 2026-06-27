# Authentication Topic — Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Topic:** `authentication` (category `security`)

## Goal

Author the **first topic-content page** in the cross-cutting **Topics** taxonomy, and with it
establish the **reusable topic-content pattern** that every later topic (the other 11 Security
topics, and future categories) will follow. The topic is **Authentication** — "prove who you
are" — covering credentials/password login, stateful sessions vs stateless tokens, JWT
internals, OAuth 2.0, OpenID Connect (OIDC), multi-factor authentication, and the token
lifecycle (refresh + revocation).

Until now, topics in `lib/topics.ts` are **card-only placeholders**; the original topics design
(`docs/superpowers/specs/2026-06-26-topics-by-category-design.md`) explicitly deferred per-topic
routes and content. This spec fills that gap for `authentication` and builds the rendering
infrastructure once, so subsequent topics are pure content + registry entries.

This is a **lighter shape** than the 18-section curriculum tutorials: a focused **~11-section
concept explainer** that reuses the tutorial reading-view chrome (TOC, reading progress) and the
existing learning components, but does not adopt the full interview-tutorial spine.

## Scope

**In scope (Authentication = authN only):**
- What authentication is, and the authN-vs-authZ boundary.
- Credentials & password login (the authN-relevant view; deep password *storage* defers to the
  **Password hashing** topic).
- **Sessions vs tokens** — stateful server sessions (cookie + session store) vs stateless,
  self-contained tokens. The central decision the topic is built around.
- A **capacity model** quantifying that decision: stateful sessions require a central
  session-store lookup on every authenticated request; stateless verification removes it.
- **JWT internals** — `header.payload.signature`, claims, HMAC vs asymmetric signing, expiry,
  verification.
- **OAuth 2.0** — delegated authorization, the roles, the authorization-code flow + PKCE, grant
  types, and the "OAuth 2.0 is authorization, not authentication" caveat.
- **OIDC** — the authentication layer on top of OAuth 2.0, the ID token, why it exists.
- **MFA** — factors (knowledge/possession/inherence), TOTP, WebAuthn/passkeys (mention).
- **Token lifecycle** — access vs refresh tokens, refresh-token rotation + reuse detection, and
  the **JWT revocation problem** (short TTL + denylist / introspection).
- Pitfalls & best practices; knowledge checks; FAQ.

**Out of scope (cross-reference, don't duplicate):** authorization / RBAC / ABAC (its own
**Authorization** topic), password-hashing algorithm internals (**Password hashing** topic),
TLS/certificate mechanics (**TLS/HTTPS** topic), session-store operational detail (**Session
management** topic), rate limiting of auth endpoints (**Rate limiting** topic). Name the boundary
and link conceptually; don't re-teach them.

## Rendering architecture (the reusable topic pattern)

Mirror the tutorial pipeline, parallel and lighter.

### Types — `lib/types.ts`
Add, next to `TutorialMeta` (reusing `TutorialSection` / `SectionDepth`):

```ts
export interface TopicMeta {
  slug: string;            // "authentication"
  categorySlug: string;    // "security"
  title: string;           // "Authentication"
  description: string;     // one-sentence summary for header + <meta>
  readingMinutes: number;
  concepts: readonly string[];           // chips: "Sessions vs tokens", "JWT", "OAuth 2.0", "OIDC", "MFA"
  sections: readonly TutorialSection[];  // drives TOC + anchors
}
```

### Registry — `lib/topic-registry.ts` (new)
Parallel to `tutorial-registry.ts`: a `topics: Record<string, TopicMeta>` keyed by slug, plus
`getTopic(slug)`. Metadata only (no MDX imports) so it stays trivially unit-testable. Holds the
`authentication` entry with its 11 sections.

### Route — `app/topics/[category]/[slug]/page.tsx` (new)
- `generateStaticParams()` — over **available** topics (from `topicCategories`), yielding
  `{ category, slug }`.
- `generateMetadata()` — title/description from `getTopic(slug)`.
- The page resolves `slug → TopicMeta` (and validates `category` matches `meta.categorySlug`)
  and `slug → compiled MDX content` via a local `content` map, then renders `<TopicLayout>`.
  `notFound()` when either is missing or the category mismatches.

### Layout — `components/topic/topic-layout.tsx` (new, adapted from `TutorialLayout`)
- Reuses `ReadingProgress` and `TutorialToc` (TOC is driven by `meta.sections`).
- Header: eyebrow **"{Category} · Topic"** (e.g., "Security · Topic"), `title`, `description`,
  then a meta row with **reading time** + **concept chips**. **No "difficulty"** (doesn't fit a
  concept). Drops the tutorial `SectionNav` (cross-tutorial prev/next) for v1 — YAGNI.

### Content — `content/topics/authentication.mdx` (new)
The 11 `<h2 id="...">` sections below.

### Card — `components/topics/topic-card.tsx`
Add an **available** branch: when `topic.status === "available"`, render the card wrapped in a
`Link` to `/topics/{categorySlug}/{topic.slug}` (remove the lock / "Coming soon", add a hover
affordance consistent with `ProblemCard`). The `TopicCard` needs the category slug to build the
href — pass `categorySlug` as a prop from the topics page map. Coming-soon topics render exactly
as today.

### Data flip — `lib/topics.ts`
Flip `authentication` `status` to `available`. (Its `blurb` "JWT, OAuth 2.0, OIDC" stays.)

## Section Outline (11 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What Authentication Is | fundamentals |
| 2 | `credentials-passwords` | Credentials & Password Login | fundamentals |
| 3 | `sessions-vs-tokens` | Sessions vs Tokens | interview-ready |
| 4 | `capacity-estimates` | Capacity: The Cost of Verifying | interview-ready |
| 5 | `jwt-internals` | JWT Internals | interview-ready |
| 6 | `oauth2-delegated` | OAuth 2.0 | advanced |
| 7 | `oidc` | OpenID Connect (OIDC) | advanced |
| 8 | `mfa` | Multi-Factor Authentication | interview-ready |
| 9 | `token-lifecycle` | Token Lifecycle: Refresh & Revocation | advanced |
| 10 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 11 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What Authentication Is** — authN = proving *who you are* (vs authZ = *what you may do*,
   which links to the Authorization topic). The job: take a claim of identity + evidence
   (factors) and verify it, then carry that proven identity across stateless HTTP requests —
   which is the whole problem the rest of the topic solves. A `Callout variant="info"` drawing
   the authN/authZ line.
2. **Credentials & Password Login** — the classic factor: a username + password. The login flow
   (submit → verify against a stored **hash**, never plaintext → establish an authenticated
   session/token). Keep password *storage* shallow — slow salted hashing (Argon2/bcrypt) is the
   **Password hashing** topic; here we only note "never store plaintext; verify against a salted
   slow hash" and move on. Mention the threats login must resist (credential stuffing, brute
   force → rate-limit + MFA, cross-refs).
3. **Sessions vs Tokens** — the central decision. **Stateful session:** server creates a session
   record (in a session store / cache), hands the client an opaque **session id** in a cookie;
   every request the server looks the id up to know who you are. **Stateless token:** server
   hands the client a **signed, self-contained token** (a JWT) carrying the identity + claims;
   every request the server **verifies the signature** locally — no store lookup. Trade-off:
   sessions are trivially **revocable** (delete the record) but put a **lookup on every request**
   and are awkward across services; tokens **scale** (no per-request central read, easy
   cross-service) but are **hard to revoke** before expiry. `TradeoffTable`. Sets up the capacity
   section and the revocation section. `<KnowledgeCheck>`.
4. **Capacity: The Cost of Verifying** — `AuthenticationCapacity` fed by
   `lib/authentication-estimates.ts`. Quantifies §3: at peak authenticated-request load, a
   **stateful** model issues a central session-store read **per request** (sized at ~**347k
   reads/sec**, needing **7** session-store nodes — a hot-path central dependency), whereas a
   **stateless** model performs **0** central per-request reads (signature verification is local
   CPU). Headline: *the per-request identity check is unavoidable; the design choice is whether it
   hits a central datastore (stateful) or stays local (stateless) — which is exactly why tokens
   scale and why revocation gets hard.*
5. **JWT Internals** — anatomy: `base64url(header).base64url(payload).signature`, the standard
   claims (`iss`, `sub`, `aud`, `exp`, `iat`), **signing**: symmetric **HMAC** (shared secret,
   one party) vs **asymmetric** RSA/ECDSA (private key signs, public key verifies — lets many
   services verify without the signing secret). Verification = recompute/verify signature + check
   `exp`/`aud`. Stress: **a JWT is signed, not encrypted** — the payload is readable; never put
   secrets in it. `ApiContract` for a token-issuing endpoint. `<KnowledgeCheck>`.
6. **OAuth 2.0** — the **delegated authorization** framework: let a user grant App A limited
   access to their data on Service B **without sharing their password**. Roles (resource owner,
   client, authorization server, resource server). The **authorization-code flow** (+ **PKCE**
   for public clients): redirect → consent → `code` → exchange `code` for an **access token** at
   the token endpoint → call the API with the bearer token. Brief mention of other grants
   (client-credentials for machine-to-machine; why implicit/password grants are deprecated). The
   crucial caveat: **OAuth 2.0 is authorization (access), not authentication (identity)** — which
   is why OIDC exists. Diagram: `OAuthAuthCodeSequence`. `<KnowledgeCheck>`.
7. **OpenID Connect (OIDC)** — a thin **identity layer on top of OAuth 2.0**: adds the **ID
   token** (a JWT asserting *who the user is*, with standardized identity claims) and the
   `userinfo` endpoint, so "Sign in with Google/Apple" is genuine authentication, not just API
   access. Distinguish the **ID token** (for the client, proves identity) from the **access
   token** (for the API, grants access). This is the standard SSO building block.
8. **Multi-Factor Authentication** — strengthen authN by requiring **2+ factors** from different
   categories: **knowledge** (password), **possession** (phone/TOTP, security key), **inherence**
   (biometric). **TOTP** (RFC 6238 — time-based one-time codes from a shared seed). **WebAuthn /
   passkeys** as the phishing-resistant, password-replacing direction. Why SMS OTP is the weakest
   second factor (SIM-swap). `<KnowledgeCheck>`.
9. **Token Lifecycle: Refresh & Revocation** — **short-lived access token + long-lived refresh
   token**: the access token expires fast (minutes) to bound the damage of a leak; the refresh
   token (stored, revocable) mints new access tokens without re-login. **Refresh-token rotation**
   + **reuse detection** (a replayed old refresh token ⇒ revoke the whole chain). The **JWT
   revocation problem**: a self-contained token can't be un-signed before `exp`, so revocation
   needs either **short TTLs** (accept a small window) or a **denylist / token introspection**
   (which re-introduces a per-request lookup — back to the §3/§4 trade-off). `<KnowledgeCheck>`.
10. **Pitfalls & Best Practices** — `Callout variant="warning"` + prose: `alg: none` & algorithm-
    confusion attacks (always pin the algorithm); JWT-as-session anti-patterns; storing tokens in
    `localStorage` (XSS) vs `HttpOnly` `Secure` `SameSite` cookies (CSRF considerations); never
    putting secrets in a JWT payload; always validate `iss`/`aud`/`exp`/signature; short token
    lifetimes; MFA on sensitive actions; rate-limit + lockout on login. A `DecisionRecord`
    capturing the one-paragraph default recommendation.
11. **Knowledge Checks & FAQ** — ≥ 4 `KnowledgeCheck` total across the page (some embedded in
    §3/§5/§6/§8/§9), plus a `Faq` with **≥ 10** entries.

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `ApiContract`, `DecisionRecord`, `KnowledgeCheck`,
`Faq`, `DiagramFrame`, diagram primitives, shared `CapacityTable`, `ReadingProgress`,
`TutorialToc`.

### New, authentication-specific
- `lib/authentication-estimates.ts` — pure capacity calc, typed
  `AuthenticationCapacityAssumptions` / `AuthenticationCapacityResults`.
- `components/learning/authentication-capacity.tsx` — wraps `CapacityTable`, registered as
  `AuthenticationCapacity`.
- `components/diagrams/authentication-flows.tsx` — `OAuthAuthCodeSequence` (OAuth 2.0 / OIDC
  authorization-code + PKCE flow) and `SessionVsTokenSequence` (stateful session lookup vs
  stateless local JWT verify on a request). Both via `DiagramFrame` with a meaningful caption
  (`role="img"` accessible name).

### New infrastructure (the topic pattern)
- `lib/topic-registry.ts`, `app/topics/[category]/[slug]/page.tsx`,
  `components/topic/topic-layout.tsx`, `content/topics/authentication.mdx`.
- `mdx-components.tsx` — register `AuthenticationCapacity`, `OAuthAuthCodeSequence`,
  `SessionVsTokenSequence`.
- `components/topics/topic-card.tsx` + `app/topics/page.tsx` — available-state link.

## Capacity Model (exact)

`lib/authentication-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`.
Integer node counts use `Math.ceil`; float results asserted with `toBeCloseTo`.

Assumptions (used in the MDX embed and the test):
```ts
{
  dailyActiveUsers: 50_000_000,
  authedRequestsPerUserPerDay: 200,
  peakMultiplier: 3,
  sessionStoreReadsPerNode: 50_000, // reads/sec one session-store node sustains
}
```

Results (deterministic):
- `avgRequestsPerSec` = 50,000,000 × 200 / 86,400 ≈ **115,740.74** /s
- `peakRequestsPerSec` = avg × 3 ≈ **347,222.22** /s
- `statefulSessionReadsPerSec` = peak ≈ **347,222.22** /s (one central lookup per request)
- `statefulSessionStoreNodes` = ceil(347,222.22 / 50,000) = **7**
- `statelessVerifyReadsPerSec` = **0** (signature verification is local CPU; no central read)

Headline lesson: every authenticated request must verify identity — that part is unavoidable. The
design choice is **where** the check happens. **Stateful sessions** turn it into a **central
session-store read on every request** (~347k reads/sec at peak, ~7 store nodes that sit on the hot
path and must be replicated and kept available), while **stateless tokens** make it a **local
signature check** (0 central reads). That is precisely *why tokens scale* — and the same
self-containment is *why revocation is hard* (you can't delete a record that doesn't exist),
tying §3 → §4 → §9 together.

## Numerical & Terminology Invariants

- authN = proving **identity** (vs authZ = **permissions**, a separate topic).
- **Stateful session** = opaque id + central session-store lookup **per request**, easily
  revocable. **Stateless token** = signed self-contained JWT, **verified locally**, scales but
  hard to revoke.
- Capacity: peak ~**347k** auth checks/sec ⇒ stateful needs ~**7** session-store nodes on the hot
  path; stateless = **0** central per-request reads.
- **JWT** = `header.payload.signature`, **signed not encrypted**; HMAC (shared secret) vs
  asymmetric (private signs / public verifies); validate `exp`/`aud`/`iss`/signature.
- **OAuth 2.0** = delegated **authorization** (access), authorization-code flow + **PKCE**; **not
  authentication**. **OIDC** = identity layer adding the **ID token** (authN).
- **MFA** = 2+ factors across knowledge/possession/inherence; **TOTP**, **WebAuthn/passkeys**.
- **Token lifecycle** = short access token + rotating refresh token (reuse detection); revocation
  = short TTL or denylist/introspection (re-introduces a lookup).

## Testing

- `tests/topic-registry.test.ts` — `authentication` is registered; slugs unique; every section
  has non-empty `id`/`label` and a valid `depth`; `categorySlug` matches a real category;
  `getTopic` returns undefined for an unregistered/`coming-soon` slug.
- `tests/authentication-content.test.ts` — the MDX source contains all 11 required `h2` ids and
  embeds the new components (`AuthenticationCapacity`, `OAuthAuthCodeSequence`,
  `SessionVsTokenSequence`, plus `Faq`, `KnowledgeCheck`); the capacity `assumptions` exactly
  match the estimates test; ≥ 4 `KnowledgeCheck` and a `Faq` with ≥ 10 items.
- `tests/authentication-estimates.test.ts` — deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node labels).
- `e2e/pilot.spec.ts` — on `/topics`, the Authentication card is a link; navigate to
  `/topics/security/authentication` (direct `page.goto`, not a TOC click) and assert the heading
  and the OAuth flow diagram `img`.

## Out of Scope

Authorization/RBAC/ABAC, password-hashing internals, TLS/certificate mechanics, session-store ops,
auth-endpoint rate limiting (all separate topics — cross-reference only); building any other
topic; cross-topic prev/next navigation; search/filter on the topics page.

## Commit sequence (one per task)

1. `docs: design spec and plan for Authentication topic`
2. `feat: add authentication capacity model and wrapper`
3. `feat: add authentication OAuth and session/token flow diagrams`
4. `feat: add topic-content pipeline (registry, route, layout) + authentication skeleton`
5. `content: complete Authentication topic`
6. `test: verify Authentication topic flow end-to-end`
