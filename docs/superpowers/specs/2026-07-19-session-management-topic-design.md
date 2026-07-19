# Session Management Topic — Design Spec

**Date:** 2026-07-19
**Status:** Approved for planning
**Topic:** `session-management` (category `security`)

## Goal

Author the **eighth** topic in the Security category, reusing the topic-content pipeline built with
the seven prior Security topics. The topic is **Session Management** — how a server maintains an
authenticated identity across the stateless HTTP protocol, and how to do it without letting an
attacker steal, fixate, or ride that session. It picks up where [Authentication](/topics/security/authentication)
leaves off (authentication proves identity *once*; the session carries it across every subsequent
request) and goes deep on the session id and cookies, server-side vs client-side sessions, the session
lifecycle and timeouts, the session-specific attacks (**hijacking, fixation, CSRF**), the cost of
session lookups at scale, sessions in a distributed system, and the secure-session checklist.

A **~10-section concept explainer** in the established lighter topic shape (reuse `TopicLayout` chrome
and the learning components; nested route `/topics/security/session-management`). The pipeline exists, so
the new work is content + a registry entry + a capacity model + two diagrams + flipping the card to
`available`.

## Scope

**In scope:** why sessions exist (**HTTP is stateless**; after login the server issues a **session** so
it recognizes the same user on later requests) and that the **session id is a temporary credential** as
sensitive as the password itself; **session ids & cookies** — the id must be **high-entropy, random
(CSPRNG, ≥128 bits), and unpredictable**, transported in a **cookie** with the security attributes
**HttpOnly** (no JS access → blunts XSS theft), **Secure** (HTTPS only), **SameSite** (blunts CSRF),
and scoped **Domain/Path** with an **expiry**; **server-side vs client-side sessions** — **stateful**
(an opaque id → a server **session store**, e.g. Redis; instantly revocable, needs a lookup) vs
**stateless** (a **signed/encrypted cookie or JWT** carrying the state itself; no lookup but hard to
revoke before expiry) — the same trade covered from the session angle (cross-ref
[Authentication](/topics/security/authentication) sessions-vs-tokens); the **session lifecycle** —
creation at login, active use, **idle timeout** vs **absolute timeout**, sliding renewal, and **logout /
server-side invalidation**; the **session attacks** — **hijacking** (stealing the id via XSS or a
plaintext channel), **fixation** (an attacker plants a *known* id before the victim logs in → fixed by
**regenerating the id on login**), **CSRF** (the browser auto-sends the session cookie, so a forged
cross-site request rides the session → fixed by **SameSite** + **CSRF tokens**), and **prediction**
(weak/guessable ids); a **capacity model** for the **per-request session-store lookup** and the memory to
hold active sessions, and how a **session cache** amortizes it; **sessions at scale** — **sticky
sessions** (fragile) vs a **shared session store** vs going **stateless**; and the **secure-session
checklist** in practice (regenerate on login & privilege change, HttpOnly+Secure+SameSite, always TLS,
short idle + absolute timeouts, invalidate on logout).

**Out of scope (cross-reference, don't duplicate):** proving identity — login, passwords, MFA, and the
full sessions-vs-tokens/JWT treatment ([Authentication](/topics/security/authentication) and
[Password Hashing](/topics/security/password-hashing)); what a session is *allowed* to do
([Authorization](/topics/security/authorization)); transport encryption internals
([TLS](/topics/security/tls-https-certificates) — referenced for the Secure flag); the general risk
lists ([OWASP Top 10](/topics/security/owasp-top-10), [API Security](/topics/security/api-security) —
CSRF and hijacking are *named* there, taught here); a Redis/store deep-dive; any change to other
topics/tutorials.

## Section Outline (10 sections)

Section `id`s must match the `h2` ids in the MDX and the registry `sections`.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `overview` | What Session Management Is | fundamentals |
| 2 | `session-ids-cookies` | Session IDs & Cookies | interview-ready |
| 3 | `server-vs-client-side` | Server-Side vs Client-Side Sessions | interview-ready |
| 4 | `lifecycle-timeouts` | Session Lifecycle & Timeouts | interview-ready |
| 5 | `session-attacks` | Session Attacks: Hijacking, Fixation & CSRF | interview-ready |
| 6 | `capacity-estimates` | Capacity: The Cost of Session Lookups | interview-ready |
| 7 | `distributed-sessions` | Sessions at Scale | advanced |
| 8 | `secure-sessions` | Secure Sessions in Practice | interview-ready |
| 9 | `pitfalls-best-practices` | Pitfalls & Best Practices | interview-ready |
| 10 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Section content notes

1. **What Session Management Is** — **HTTP is stateless**: each request is independent, so without a
   session the server would demand a login on every click. A **session** is the server-side notion of
   "this is the same authenticated user," referenced by a **session id** the client presents on each
   request. Crucially, that id is a **bearer credential** — whoever holds it *is* the user for the
   session's lifetime — so it is **as sensitive as a password** and must be protected accordingly.
   `Callout variant="info"`: "the session id is a temporary password — anyone who steals it is you until
   it expires; treat it with the same care." ≥1 `<KnowledgeCheck>`.
2. **Session IDs & Cookies** — the id must be **unpredictable**: generated from a **CSPRNG** with enough
   entropy (**≥128 bits**) so it can't be guessed or brute-forced. It's carried in a **cookie**, whose
   **security attributes** are the front line: **HttpOnly** (JavaScript can't read it — blunts XSS
   theft), **Secure** (sent only over HTTPS — no plaintext leak), **SameSite** (`Lax`/`Strict` — the
   browser won't attach it to cross-site requests, blunting CSRF), plus a scoped **Domain/Path** and a
   sensible **Max-Age/Expires**. Getting these flags right defends against whole attack classes for free.
   ≥1 `<KnowledgeCheck>`.
3. **Server-Side vs Client-Side Sessions** — two ways to hold session state. **Server-side (stateful)**:
   the cookie is an **opaque id** and the real data lives in a **session store** (Redis/DB); the server
   can **revoke instantly** (delete the row) but must **look it up every request**. **Client-side
   (stateless)**: the state itself lives in a **signed (and/or encrypted) cookie or JWT** the client
   holds; **no lookup**, trivially horizontally scalable, but you **can't revoke before expiry** and the
   payload is size-limited and visible. `TradeoffTable` (stateful vs stateless: revocation, per-request
   cost, scale, size). This is the sessions-vs-tokens trade from the session side (cross-ref
   [Authentication](/topics/security/authentication)). ≥1 `<KnowledgeCheck>`.
4. **Session Lifecycle & Timeouts** — a session is **created at login** (fresh id issued), used, and must
   eventually **end**. Two timeouts matter: an **idle (inactivity) timeout** (expire after N minutes of
   no activity — limits an abandoned session) and an **absolute timeout** (a hard cap regardless of
   activity — limits a stolen session's useful life). **Sliding renewal** extends idle on each request.
   **Logout must invalidate server-side** (for stateful sessions, delete the store entry; a stateless
   token can only be blocklisted or left to expire). ≥1 `<KnowledgeCheck>` may live here or later.
5. **Session Attacks: Hijacking, Fixation & CSRF** — the session-specific threats. **Hijacking**:
   stealing a valid id — via **XSS** (mitigated by HttpOnly) or a **plaintext channel** (mitigated by
   TLS + Secure). **Fixation**: the attacker obtains a session id, tricks the victim into
   authenticating *with that id*, and — if the server **doesn't change the id at login** — ends up
   sharing the victim's now-authenticated session; the fix is **regenerate the session id on login**
   (and on privilege change). **CSRF**: because the browser **automatically attaches the session
   cookie**, a malicious site can forge a state-changing request that rides the victim's session; fixes
   are **SameSite cookies** and **anti-CSRF tokens**. **Prediction**: guessable ids — solved by high
   entropy (§2). Embed `<SessionFixationSequence />`. ≥1 `<KnowledgeCheck>`.
6. **Capacity: The Cost of Session Lookups** — `SessionCapacity` fed by
   `lib/session-management-estimates.ts`. Stateful sessions require a **store lookup on every
   authenticated request**, so the session store's load scales with total request rate, and you must
   hold every active session in memory. Headline: at 300k req/s the store would take **300,000
   lookups/s**, and 50M active sessions at 1 KB each is **50 GB**; a **95%-hit session cache** cuts
   store lookups **20×** to **15,000/s**. The lesson: stateful sessions buy **instant revocation** at
   the cost of a **per-request lookup + memory** (amortized by caching), whereas **stateless** sessions
   need **no lookup** but **can't be revoked** before expiry — the core session-storage trade, in
   numbers.
7. **Sessions at Scale** — with many app servers, where does session state live? **Sticky sessions**
   (a load balancer pins a user to one server holding their session in memory) avoid a shared store but
   are **fragile** — that server dies and the session is gone, and it hampers even load distribution.
   A **shared session store** (Redis) is the standard: any server can serve any request, revocation is
   central, at the cost of the lookup from §6. **Stateless** sessions sidestep the store entirely for
   effortless horizontal scale — the recurring trade. `Callout` contrasting sticky vs shared vs
   stateless. ≥1 `<KnowledgeCheck>` may live here or later.
8. **Secure Sessions in Practice** — the concrete checklist that ties it together, shown as the secure
   login-to-request flow: on login **generate a fresh high-entropy id** and **regenerate** it (kills
   fixation), store the session, and set the cookie **HttpOnly + Secure + SameSite**; on every request
   the browser returns the cookie and the server validates it against the store; enforce **idle +
   absolute timeouts**, **always TLS**, **regenerate on privilege change**, and **invalidate on
   logout**. Embed `<SecureLoginSessionSequence />`. ≥1 `<KnowledgeCheck>`.
9. **Pitfalls & Best Practices** — `Callout variant="warning"`: **predictable/short session ids**,
   **session id in the URL** (leaks via referrer/logs/history), **not regenerating on login** (fixation),
   **missing HttpOnly/Secure/SameSite**, **no idle or absolute timeout**, **not invalidating on logout**,
   and **transmitting over HTTP**. A `DecisionRecord` with the default posture (server-side sessions in a
   shared store with a cache for most apps; high-entropy ids; HttpOnly+Secure+SameSite cookies;
   regenerate on login; idle+absolute timeouts; TLS everywhere; stateless only when revocation isn't
   required). ≥1 `<KnowledgeCheck>` may live here.
10. **Knowledge Checks & FAQ** — ≥ 4 `<KnowledgeCheck>` total, plus a `<Faq>` with **≥ 10** entries
    (why sessions exist; id as a credential; cookie flags; stateful vs stateless; idle vs absolute
    timeout; hijacking; fixation & regenerate-on-login; CSRF & SameSite; lookup cost/caching; sticky vs
    shared; logout/revocation; session id in URL).

## Components

### Reused as-is
`Callout` (`info`/`warning`), `TradeoffTable`, `DecisionRecord`, `KnowledgeCheck`, `Faq`,
`DiagramFrame`, diagram primitives, shared `CapacityTable`, `TopicLayout`. `TradeoffTable` for stateful
vs stateless sessions. (No `ApiContract`.)

### New, Session-Management-specific
- `lib/session-management-estimates.ts` — pure capacity calc, typed `SessionCapacityAssumptions` /
  `SessionCapacityResults`.
- `components/learning/session-management-capacity.tsx` — wraps `CapacityTable`, registered as
  `SessionCapacity`.
- `components/diagrams/session-management-flows.tsx` — `SessionFixationSequence` (attacker gets a
  session id → plants it on the victim → victim logs in → server keeps the same id → attacker's id is
  now authenticated; caption: regenerate the id on login to break this) and `SecureLoginSessionSequence`
  (login → server generates a fresh high-entropy id, stores the session, sets a HttpOnly+Secure+SameSite
  cookie → later request returns the cookie → server validates against the store → serves; caption: the
  opaque id is validated server-side each request). Both via `DiagramFrame` with a meaningful caption.

### Wiring (extend the existing pipeline)
- `lib/topic-registry.ts` — add the `session-management` entry (10 sections).
- `app/topics/[category]/[slug]/page.tsx` — import + add to the `content` map.
- `mdx-components.tsx` — register `SessionCapacity`, `SessionFixationSequence`,
  `SecureLoginSessionSequence`.
- `lib/topics.ts` — flip `session-management` to `available`.
- `content/topics/session-management.mdx` — the content.
- `tests/topic-registry.test.ts` — add assertions for the new topic; **update** the existing `getTopic`
  "returns undefined" check from `session-management` to a still-coming-soon slug (`rate-limiting`).

## Capacity Model (exact)

`lib/session-management-estimates.ts`, pure & deterministic. Compute the cached rate as
`requestsPerSec − requestsPerSec × cacheHitRate` (exact for 0.95); memory via a `bytesPerGb` constant.

Assumptions (used in the MDX embed and the test):
```ts
{
  requestsPerSec: 300_000,
  activeSessions: 50_000_000,
  sessionBytes: 1_000,
  cacheHitRate: 0.95,
  bytesPerGb: 1_000_000_000,
}
```

Results (deterministic):
- `storeLookupsWithoutCache` = 300,000 (one per request) = **300,000** /s
- `storeLookupsWithCache` = 300,000 − 300,000 × 0.95 = **15,000** /s
- `lookupReductionFactor` = 300,000 / 15,000 = **20**
- `sessionStoreMemoryGb` = 50,000,000 × 1,000 / 1,000,000,000 = **50**

Headline lesson: stateful sessions cost a **store lookup on every authenticated request** and the
**memory to hold every active session**. At 300k req/s that's **300,000 lookups/s** against the session
store, plus **50 GB** for 50M sessions; a **95%-hit session cache** cuts store lookups **20×** to
**15,000/s**. That's the session-storage trade in numbers: **stateful** buys **instant revocation** but
pays per-request lookup + memory (softened by caching); **stateless** (signed cookie/JWT) pays **no
lookup** and scales trivially but **can't revoke** a session before it expires.

## Numerical & Terminology Invariants

- **HTTP is stateless**; a **session** carries authenticated identity across requests via a **session
  id**, which is a **bearer credential as sensitive as a password**.
- Session id = **CSPRNG, ≥128-bit, unpredictable**; carried in a **cookie** with **HttpOnly** (anti-XSS
  theft), **Secure** (HTTPS only), **SameSite** (anti-CSRF), scoped Domain/Path + expiry.
- **Stateful** (opaque id → server store): **instant revocation**, needs a **per-request lookup**.
  **Stateless** (signed/encrypted cookie/JWT): **no lookup**, scales trivially, **can't revoke** before
  expiry.
- Lifecycle: create on login · **idle timeout** (inactivity) vs **absolute timeout** (hard cap) ·
  **invalidate server-side on logout**.
- Attacks: **hijacking** (steal id — HttpOnly + TLS) · **fixation** (planted id — **regenerate id on
  login**) · **CSRF** (auto-sent cookie — **SameSite** + tokens) · **prediction** (high entropy).
- Capacity: 300k req/s ⇒ **300,000 store lookups/s**; a 95% cache ⇒ **15,000/s** (**20×**); 50M × 1 KB
  = **50 GB**.
- Scale: **sticky** (fragile) vs **shared store** (standard) vs **stateless** (no store).

## Testing

- `tests/topic-registry.test.ts` — add: `session-management` registered; 10 sections; unique ids +
  valid depths. **Update** the "`getTopic` returns undefined" assertion to `rate-limiting` (still
  coming-soon). Prior topic assertions stay.
- `tests/session-management-content.test.ts` — all 10 required `h2` ids present; embeds
  `<SessionCapacity`, `<SessionFixationSequence`, `<SecureLoginSessionSequence`; capacity `assumptions`
  exactly match the estimates test; ≥ 4 `<KnowledgeCheck` and ≥ 10 `question:`.
- `tests/session-management-estimates.test.ts` — the deterministic results above.
- `tests/diagrams.test.tsx` — render assertions for the two new diagrams (assert keywords via the
  **caption only** to avoid `getByText` duplicate-match with node/step labels).
- `e2e/pilot.spec.ts` — from `/topics`, the Session Management card links through; navigate to
  `/topics/security/session-management#session-attacks` (direct `page.goto`) and assert the heading and a
  diagram `img` (assert the diagram first so layout settles before the in-viewport check). Curriculum
  assertions **untouched**. Run e2e with `--workers=1`.

## Out of Scope

Login/MFA/JWT internals (Authentication), authorization, TLS internals, the general risk lists, a Redis
deep-dive, and any change to other topics/tutorials.

## Commit sequence (one per task)

1. `docs: design spec and plan for Session Management topic`
2. `feat: add Session Management capacity model and wrapper`
3. `feat: add session fixation and secure-login diagrams`
4. `feat: register Session Management topic route and skeleton`
5. `content: complete Session Management topic`
6. `test: verify Session Management topic flow end-to-end`
