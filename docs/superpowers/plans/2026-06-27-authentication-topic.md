# Authentication Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the **Authentication** topic and, with it, build the reusable **topic-content pipeline** (registry, nested route, layout, available-card link) so the Security category's first topic is readable at `/topics/security/authentication`.

**Architecture:** Mirror the tutorial pipeline, parallel and lighter. A new `lib/topic-registry.ts` (`TopicMeta` reusing `TutorialSection`) feeds a new route `app/topics/[category]/[slug]/page.tsx` that renders a new `TopicLayout` (reuses `ReadingProgress` + `TutorialToc`, no difficulty/section-nav). Content is an 11-section MDX file reusing the existing learning components plus one new capacity model and two new flow diagrams. The `TopicCard` gains an available state linking to the route.

**Tech Stack:** Next.js App Router (static routes), MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic scope is **authentication only** (authN). Authorization/RBAC, password-hashing internals, TLS, session-store ops, and rate limiting are **separate topics** — cross-reference, never duplicate.
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New diagram/component export names must not collide in `mdx-components.tsx` — grep before registering. Chosen names (`AuthenticationCapacity`, `OAuthAuthCodeSequence`, `SessionVsTokenSequence`) are currently unused.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts via `screen.getByText(...)` must appear in the **caption only**, never also as a node/step label.
- E2e: use **direct fragment navigation** (`page.goto(".../#anchor")`), not TOC clicks.
- Adding a topic does **not** change the curriculum problem count — leave `tests/curriculum.test.ts` and the e2e "showing 1 of 33" assertion untouched.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Do not push or merge.

---

### Task 1: Capacity model — `AuthenticationCapacity`

**Files:**
- Create: `lib/authentication-estimates.ts`
- Create: `tests/authentication-estimates.test.ts`
- Create: `components/learning/authentication-capacity.tsx`
- Modify: `mdx-components.tsx` (import + register `AuthenticationCapacity`)

**Interfaces:**
- Produces: `calculateAuthenticationCapacity(a: AuthenticationCapacityAssumptions): AuthenticationCapacityResults`; React `AuthenticationCapacity({ assumptions })`.
- Consumes: `CapacityTable`, `AssumptionRow`, `ResultRow` from `./capacity-table`.

- [ ] **Step 1: Write the failing estimates test**

`tests/authentication-estimates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calculateAuthenticationCapacity } from "@/lib/authentication-estimates";

describe("calculateAuthenticationCapacity", () => {
  const result = calculateAuthenticationCapacity({
    dailyActiveUsers: 50_000_000,
    authedRequestsPerUserPerDay: 200,
    peakMultiplier: 3,
    sessionStoreReadsPerNode: 50_000,
  });

  it("derives average authenticated requests per second", () => {
    expect(result.avgRequestsPerSec).toBeCloseTo(115740.74, 1);
  });
  it("derives peak authenticated requests per second", () => {
    expect(result.peakRequestsPerSec).toBeCloseTo(347222.22, 1);
  });
  it("charges stateful sessions one central read per request", () => {
    expect(result.statefulSessionReadsPerSec).toBeCloseTo(347222.22, 1);
  });
  it("sizes the session-store fleet for peak read load", () => {
    expect(result.statefulSessionStoreNodes).toBe(7);
  });
  it("charges stateless token verification zero central reads", () => {
    expect(result.statelessVerifyReadsPerSec).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, expect failure** — `npm test -- authentication-estimates` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/authentication-estimates.ts`**

```ts
const SECONDS_PER_DAY = 86_400;

export interface AuthenticationCapacityAssumptions {
  /** Daily active users. */
  dailyActiveUsers: number;
  /** Authenticated requests one user makes per day. */
  authedRequestsPerUserPerDay: number;
  /** Peak-to-average traffic ratio. */
  peakMultiplier: number;
  /** Reads/sec a single session-store node sustains. */
  sessionStoreReadsPerNode: number;
}

export interface AuthenticationCapacityResults {
  avgRequestsPerSec: number;
  peakRequestsPerSec: number;
  /** Stateful: one central session-store read per authenticated request. */
  statefulSessionReadsPerSec: number;
  statefulSessionStoreNodes: number;
  /** Stateless: signature verification is local CPU — no central read. */
  statelessVerifyReadsPerSec: number;
}

/**
 * Pure, deterministic capacity model. The lesson: every authenticated request must verify
 * identity. Stateful sessions turn that into a central session-store read on the hot path of
 * EVERY request (~347k reads/sec at peak ⇒ ~7 store nodes to keep available); stateless tokens
 * make it a local signature check (0 central reads). That is why tokens scale — and, because a
 * self-contained token can't be deleted, why revocation is hard.
 */
export function calculateAuthenticationCapacity(
  a: AuthenticationCapacityAssumptions,
): AuthenticationCapacityResults {
  const avgRequestsPerSec = (a.dailyActiveUsers * a.authedRequestsPerUserPerDay) / SECONDS_PER_DAY;
  const peakRequestsPerSec = avgRequestsPerSec * a.peakMultiplier;
  const statefulSessionReadsPerSec = peakRequestsPerSec;
  const statefulSessionStoreNodes = Math.ceil(statefulSessionReadsPerSec / a.sessionStoreReadsPerNode);
  const statelessVerifyReadsPerSec = 0;

  return {
    avgRequestsPerSec,
    peakRequestsPerSec,
    statefulSessionReadsPerSec,
    statefulSessionStoreNodes,
    statelessVerifyReadsPerSec,
  };
}
```

- [ ] **Step 4: Run it, expect pass** — `npm test -- authentication-estimates` → PASS.

- [ ] **Step 5: Implement the wrapper `components/learning/authentication-capacity.tsx`**

```tsx
import {
  calculateAuthenticationCapacity,
  type AuthenticationCapacityAssumptions,
} from "@/lib/authentication-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function AuthenticationCapacity({
  assumptions,
}: {
  assumptions: AuthenticationCapacityAssumptions;
}) {
  const r = calculateAuthenticationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Auth requests / user / day", value: fmt(assumptions.authedRequestsPerUserPerDay) },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Session reads / node", value: `${fmt(assumptions.sessionStoreReadsPerNode)} /s` },
  ];

  const results: ResultRow[] = [
    { label: "Avg auth checks / sec", value: `${fmt(r.avgRequestsPerSec)} /s`, consequence: "Every authenticated request must verify identity — this part is unavoidable, whatever the mechanism." },
    { label: "Peak auth checks / sec", value: `${fmt(r.peakRequestsPerSec)} /s`, consequence: "The hot-path load the verification mechanism must absorb at peak." },
    { label: "Stateful session reads / sec", value: `${fmt(r.statefulSessionReadsPerSec)} /s`, consequence: "Stateful sessions hit a central session store on EVERY request — a network read on the hot path." },
    { label: "Session-store nodes", value: fmt(r.statefulSessionStoreNodes), consequence: "The session store becomes a sized, replicated, must-stay-available dependency in front of every request." },
    { label: "Stateless verify reads / sec", value: fmt(r.statelessVerifyReadsPerSec), consequence: "Stateless JWT verification is local CPU (a signature check) — the per-request central lookup disappears. This is why tokens scale." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

- [ ] **Step 6: Register in `mdx-components.tsx`** — add `import { AuthenticationCapacity } from "@/components/learning/authentication-capacity";` near the other capacity imports, and add `AuthenticationCapacity,` to the `teachingComponents` object.

- [ ] **Step 7: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add lib/authentication-estimates.ts tests/authentication-estimates.test.ts components/learning/authentication-capacity.tsx mdx-components.tsx
git commit -m "feat: add authentication capacity model and wrapper"
```

---

### Task 2: Flow diagrams (run AFTER Task 1 — shares `mdx-components.tsx`)

**Files:**
- Create: `components/diagrams/authentication-flows.tsx`
- Modify: `tests/diagrams.test.tsx` (append a describe block)
- Modify: `mdx-components.tsx` (import + register both sequences)

**Interfaces:**
- Produces: `OAuthAuthCodeSequence()`, `SessionVsTokenSequence()` React components.
- Consumes: the private `Sequence`/`StepLabel` pattern — **copy** the `Actor`/`Step` interfaces, constants, `actorColor`, `Sequence`, and `StepLabel` from `components/diagrams/chat-system-flows.tsx` verbatim (they are file-local, not exported).

- [ ] **Step 1: Create `components/diagrams/authentication-flows.tsx`**

Copy the header imports, `Actor`/`Step` interfaces, layout constants, `actorColor`, the `Sequence` function, and the `StepLabel` function from `chat-system-flows.tsx` exactly. Then add the two exported sequences below:

```tsx
export function OAuthAuthCodeSequence() {
  return (
    <Sequence
      title="Sequence: OAuth 2.0 authorization-code flow with PKCE"
      caption="OAuth lets a user grant an app limited access to their data on another service without ever revealing their password to that app. The browser is redirected to the authorization server to log in and consent; the app receives a short-lived authorization code, then exchanges it (with its PKCE verifier) at the token endpoint for an access token. With OpenID Connect the same exchange also returns an ID token, a signed JWT that proves the user's identity."
      actors={[
        { id: "user",   label: "User",        kind: "external" },
        { id: "client", label: "Client App",  kind: "service" },
        { id: "authsrv", label: "Auth Server", kind: "service" },
        { id: "api",    label: "Resource API", kind: "store" },
      ]}
      steps={[
        { from: "user",   to: "client", label: "click sign in",                  variant: "ingress" },
        { from: "client", to: "authsrv", label: "redirect to authorize + PKCE",  variant: "redirect" },
        { from: "authsrv", to: "user",  label: "prompt login + consent",         variant: "control" },
        { from: "user",   to: "authsrv", label: "authenticate + approve",        variant: "ingress" },
        { from: "authsrv", to: "client", label: "redirect back with code",       variant: "redirect", reply: true },
        { from: "client", to: "authsrv", label: "exchange code at token endpoint", variant: "create" },
        { from: "authsrv", to: "client", label: "access token (+ ID token)",     variant: "redirect", reply: true },
        { from: "client", to: "api",    label: "call API with bearer token",     variant: "redirect" },
      ]}
    />
  );
}

export function SessionVsTokenSequence() {
  return (
    <Sequence
      title="Sequence: stateful session lookup vs stateless token verification"
      caption="Stateful sessions: the client sends an opaque session id (in a cookie) and the API server reads a central session store to recover the user's identity on every request — a network round-trip on the hot path that scales with traffic and must stay available. The stateless alternative replaces those store steps with a local signature check of a self-contained token: no shared lookup, which is why tokens scale, but also nothing to delete, which is why revoking them early is hard."
      actors={[
        { id: "client", label: "Client",        kind: "external" },
        { id: "server", label: "API Server",    kind: "service" },
        { id: "store",  label: "Session Store", kind: "cache" },
      ]}
      steps={[
        { from: "client", to: "server", label: "request + session cookie", variant: "ingress" },
        { from: "server", to: "store",  label: "look up session by id",    variant: "control" },
        { from: "store",  to: "server", label: "return user identity",     variant: "redirect", reply: true },
        { from: "server", to: "client", label: "authorized response",      variant: "redirect", reply: true },
      ]}
    />
  );
}
```

- [ ] **Step 2: Register in `mdx-components.tsx`** — add `import { OAuthAuthCodeSequence, SessionVsTokenSequence } from "@/components/diagrams/authentication-flows";` after the chat-system-flows import, and add both names to `teachingComponents`.

- [ ] **Step 3: Append render assertions to `tests/diagrams.test.tsx`**

```tsx
import {
  OAuthAuthCodeSequence,
  SessionVsTokenSequence,
} from "@/components/diagrams/authentication-flows";

describe("Authentication flow diagrams", () => {
  it("exposes the OAuth authorization-code flow to non-visual readers", () => {
    render(<OAuthAuthCodeSequence />);
    expect(
      screen.getByRole("img", { name: /authorization-code flow with pkce/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/without ever revealing their password/i)).toBeInTheDocument();
  });

  it("contrasts stateful session lookup with stateless verification", () => {
    render(<SessionVsTokenSequence />);
    expect(
      screen.getByRole("img", { name: /session lookup vs stateless token/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/network round-trip on the hot path/i)).toBeInTheDocument();
  });
});
```

(Both asserted phrases — "without ever revealing their password", "network round-trip on the hot path" — appear in captions only, never in a node or step label.)

- [ ] **Step 4: Run tests** — `npm test -- diagrams` → PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add components/diagrams/authentication-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add authentication OAuth and session/token flow diagrams"
```

---

### Task 3: Topic-content pipeline + skeleton

**Files:**
- Modify: `lib/types.ts` (add `TopicMeta`)
- Create: `lib/topic-registry.ts`
- Create: `components/topic/topic-layout.tsx`
- Create: `app/topics/[category]/[slug]/page.tsx`
- Modify: `components/topics/topic-card.tsx` (available link state + `categorySlug` prop)
- Modify: `app/topics/page.tsx` (pass `categorySlug` to each card)
- Modify: `lib/topics.ts` (flip `authentication` → `available`)
- Create: `content/topics/authentication.mdx` (11-section skeleton)
- Create: `tests/topic-registry.test.ts`

**Interfaces:**
- Produces: `TopicMeta`; `topicMetas: Record<string, TopicMeta>`, `getTopic(slug)`; `TopicLayout({ meta, categoryTitle, children })`.
- Consumes: `TutorialSection`/`ProblemStatus` from `lib/types`, `ReadingProgress`, `TutorialToc`, `getTopicCategory`.

- [ ] **Step 1: Add `TopicMeta` to `lib/types.ts`** (after `TutorialMeta`):
```ts
export interface TopicMeta {
  slug: string;
  categorySlug: string;
  title: string;
  description: string;
  readingMinutes: number;
  concepts: readonly string[];
  sections: readonly TutorialSection[];
}
```

- [ ] **Step 2: Write the failing registry test `tests/topic-registry.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { getTopic, topicMetas } from "@/lib/topic-registry";
import { topicCategories } from "@/lib/topics";

describe("topic registry", () => {
  it("registers the authentication topic", () => {
    expect(Object.keys(topicMetas)).toContain("authentication");
  });
  it("describes authentication's eleven sections", () => {
    expect(getTopic("authentication")?.sections).toHaveLength(11);
  });
  it("gives every section a unique id and a valid depth", () => {
    const sections = getTopic("authentication")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("points every registered topic at a real category", () => {
    const slugs = new Set(topicCategories.map((c) => c.slug));
    for (const meta of Object.values(topicMetas)) {
      expect(slugs.has(meta.categorySlug)).toBe(true);
    }
  });
  it("returns undefined for an unregistered topic", () => {
    expect(getTopic("authorization")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it, expect failure** — `npm test -- topic-registry` → FAIL (module not found).

- [ ] **Step 4: Create `lib/topic-registry.ts`**
```ts
import type { TopicMeta } from "./types";

/**
 * Static registry of fully-authored topics, keyed by slug. Metadata only (no MDX imports)
 * so it stays trivially unit-testable; the route resolves slug → MDX separately. Section
 * `id`s must match the heading ids in the corresponding MDX file.
 */
export const topicMetas: Record<string, TopicMeta> = {
  authentication: {
    slug: "authentication",
    categorySlug: "security",
    title: "Authentication",
    description:
      "How a system proves who a user is — from password login and the sessions-vs-tokens decision through JWTs, OAuth 2.0, OpenID Connect, MFA, and the token lifecycle.",
    readingMinutes: 22,
    concepts: ["Sessions vs tokens", "JWT", "OAuth 2.0", "OIDC", "MFA"],
    sections: [
      { id: "overview", label: "What Authentication Is", depth: "fundamentals" },
      { id: "credentials-passwords", label: "Credentials & Password Login", depth: "fundamentals" },
      { id: "sessions-vs-tokens", label: "Sessions vs Tokens", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity: The Cost of Verifying", depth: "interview-ready" },
      { id: "jwt-internals", label: "JWT Internals", depth: "interview-ready" },
      { id: "oauth2-delegated", label: "OAuth 2.0", depth: "advanced" },
      { id: "oidc", label: "OpenID Connect (OIDC)", depth: "advanced" },
      { id: "mfa", label: "Multi-Factor Authentication", depth: "interview-ready" },
      { id: "token-lifecycle", label: "Token Lifecycle: Refresh & Revocation", depth: "advanced" },
      { id: "pitfalls-best-practices", label: "Pitfalls & Best Practices", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
};

export function getTopic(slug: string): TopicMeta | undefined {
  return topicMetas[slug];
}
```

- [ ] **Step 5: Run it, expect pass** — `npm test -- topic-registry` → PASS.

- [ ] **Step 6: Create `components/topic/topic-layout.tsx`**
```tsx
import { Clock } from "lucide-react";
import type { TopicMeta } from "@/lib/types";
import { ReadingProgress } from "@/components/tutorial/reading-progress";
import { TutorialToc } from "@/components/tutorial/tutorial-toc";

export function TopicLayout({
  meta,
  categoryTitle,
  children,
}: {
  meta: TopicMeta;
  categoryTitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ReadingProgress />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <header className="border-b border-border pb-8">
          <p className="text-sm font-medium text-accent">{categoryTitle} · Topic</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{meta.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-muted">{meta.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} aria-hidden />
              {meta.readingMinutes} min read
            </span>
            <span className="flex flex-wrap gap-1.5">
              {meta.concepts.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px]"
                >
                  {c}
                </span>
              ))}
            </span>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-12">
          <article className="prose-tutorial min-w-0 py-8">{children}</article>
          <aside className="hidden lg:block">
            <div className="sticky top-20 py-8">
              <TutorialToc sections={meta.sections} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 7: Create the route `app/topics/[category]/[slug]/page.tsx`**
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { getTopic, topicMetas } from "@/lib/topic-registry";
import { getTopicCategory } from "@/lib/topics";
import { TopicLayout } from "@/components/topic/topic-layout";
import AuthenticationContent from "@/content/topics/authentication.mdx";

/** Maps each registered topic slug to its compiled MDX content component. */
const content: Record<string, ComponentType> = {
  authentication: AuthenticationContent,
};

export function generateStaticParams() {
  return Object.values(topicMetas).map((t) => ({
    category: t.categorySlug,
    slug: t.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getTopic(slug);
  if (!meta) return { title: "Topic not found" };
  return { title: meta.title, description: meta.description };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const meta = getTopic(slug);
  const Content = content[slug];
  if (!meta || !Content || meta.categorySlug !== category) notFound();
  const cat = getTopicCategory(category);

  return (
    <TopicLayout meta={meta} categoryTitle={cat?.title ?? meta.categorySlug}>
      <Content />
    </TopicLayout>
  );
}
```

- [ ] **Step 8: Update `components/topics/topic-card.tsx`** to add the available link state and a `categorySlug` prop:
```tsx
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Topic } from "@/lib/types";

export function TopicCard({
  topic,
  categorySlug,
}: {
  topic: Topic;
  categorySlug: string;
}) {
  if (topic.status === "available") {
    return (
      <Link
        href={`/topics/${categorySlug}/${topic.slug}`}
        className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong"
      >
        <h3 className="text-base font-semibold tracking-tight">{topic.title}</h3>
        {topic.blurb ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{topic.blurb}</p>
        ) : null}
        <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium text-accent">
          Read topic
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </Link>
    );
  }

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm opacity-75"
      aria-disabled="true"
    >
      <h3 className="text-base font-semibold tracking-tight">{topic.title}</h3>
      {topic.blurb ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{topic.blurb}</p>
      ) : null}
      <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium">
        <span className="inline-flex items-center gap-1.5 text-ink-faint">
          <Lock size={13} aria-hidden />
          Coming soon
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Update `app/topics/page.tsx`** — pass the category slug to each card:
```tsx
<TopicCard key={topic.slug} topic={topic} categorySlug={category.slug} />
```

- [ ] **Step 10: Flip `authentication` to available in `lib/topics.ts`** — change that topic's `status: "coming-soon"` to `status: "available"` (leave its blurb).

- [ ] **Step 11: Create the skeleton `content/topics/authentication.mdx`** — 11 headings, one placeholder line each (Task 5 fills them):
```mdx
<h2 id="overview">What Authentication Is</h2>

Placeholder.

<h2 id="credentials-passwords">Credentials & Password Login</h2>

Placeholder.

<h2 id="sessions-vs-tokens">Sessions vs Tokens</h2>

Placeholder.

<h2 id="capacity-estimates">Capacity: The Cost of Verifying</h2>

Placeholder.

<h2 id="jwt-internals">JWT Internals</h2>

Placeholder.

<h2 id="oauth2-delegated">OAuth 2.0</h2>

Placeholder.

<h2 id="oidc">OpenID Connect (OIDC)</h2>

Placeholder.

<h2 id="mfa">Multi-Factor Authentication</h2>

Placeholder.

<h2 id="token-lifecycle">Token Lifecycle: Refresh & Revocation</h2>

Placeholder.

<h2 id="pitfalls-best-practices">Pitfalls & Best Practices</h2>

Placeholder.

<h2 id="knowledge-checks-faq">Knowledge Checks & FAQ</h2>

Placeholder.
```

- [ ] **Step 12: Build + typecheck + lint** — `npm run build` (must generate `/topics/security/authentication`), `npm run typecheck`, `npm run lint`, `npm test -- topic-registry`. All green.

- [ ] **Step 13: Commit**
```bash
git add lib/types.ts lib/topic-registry.ts components/topic/topic-layout.tsx "app/topics/[category]/[slug]/page.tsx" components/topics/topic-card.tsx app/topics/page.tsx lib/topics.ts content/topics/authentication.mdx tests/topic-registry.test.ts
git commit -m "feat: add topic-content pipeline (registry, route, layout) + authentication skeleton"
```

---

### Task 4: Content — sections 1–6 (Opus orchestrator authors)

**Files:** Modify `content/topics/authentication.mdx` (replace placeholders for `overview`, `credentials-passwords`, `sessions-vs-tokens`, `capacity-estimates`, `jwt-internals`, `oauth2-delegated`).

Author interview-grade prose matching the voice/density of `content/tutorials/chat-system.mdx`. Requirements:
- **overview:** authN = proving identity vs authZ = permissions (link the Authorization topic). The core problem: carry a proven identity across stateless HTTP. `Callout variant="info"` drawing the authN/authZ line.
- **credentials-passwords:** the password factor + login flow (verify against a stored salted slow hash, never plaintext — defer hashing depth to the Password hashing topic). Threats: credential stuffing / brute force → rate-limit + MFA (cross-refs).
- **sessions-vs-tokens:** the central decision. Stateful session (opaque id + central store lookup per request, easily revocable) vs stateless token (signed self-contained JWT verified locally, scales, hard to revoke). Embed `<SessionVsTokenSequence />`. A `TradeoffTable`. ≥1 `<KnowledgeCheck>`.
- **capacity-estimates:** embed `<AuthenticationCapacity assumptions={{ dailyActiveUsers: 50000000, authedRequestsPerUserPerDay: 200, peakMultiplier: 3, sessionStoreReadsPerNode: 50000 }} />` (must match the estimates test exactly). Prose: peak ~347k auth checks/sec ⇒ stateful needs ~7 store nodes on the hot path; stateless = 0 central reads — why tokens scale, foreshadowing revocation.
- **jwt-internals:** `header.payload.signature`, standard claims, HMAC vs asymmetric signing, verification, "signed not encrypted — never put secrets in it." An `ApiContract` for a token-issuing endpoint. ≥1 `<KnowledgeCheck>`.
- **oauth2-delegated:** delegated authorization, the roles, authorization-code flow + PKCE, other grants briefly, and "OAuth 2.0 is authorization, not authentication." Embed `<OAuthAuthCodeSequence />`. ≥1 `<KnowledgeCheck>`.

- [ ] **Step 1:** Replace the six placeholders with authored content.
- [ ] **Step 2:** `npm run build` (compiles the MDX with real embeds) → succeeds.
- [ ] **Step 3:** Commit is deferred to Task 5 (content lands as one `content:` commit).

---

### Task 5: Content — sections 7–11 + content test (Opus orchestrator authors)

**Files:** Modify `content/topics/authentication.mdx` (sections `oidc`, `mfa`, `token-lifecycle`, `pitfalls-best-practices`, `knowledge-checks-faq`); Create `tests/authentication-content.test.ts`.

Requirements:
- **oidc:** identity layer on OAuth 2.0; the ID token (JWT proving identity) vs access token (grants API access); the SSO building block ("Sign in with…").
- **mfa:** 2+ factors across knowledge/possession/inherence; TOTP; WebAuthn/passkeys (phishing-resistant); why SMS OTP is weakest. ≥1 `<KnowledgeCheck>`.
- **token-lifecycle:** short access + long refresh token; refresh-token rotation + reuse detection; the JWT revocation problem (short TTL vs denylist/introspection — which re-introduces the §4 per-request lookup). ≥1 `<KnowledgeCheck>`.
- **pitfalls-best-practices:** `Callout variant="warning"` — `alg: none`/algorithm confusion, JWT-as-session anti-patterns, `localStorage` (XSS) vs `HttpOnly`/`Secure`/`SameSite` cookies (CSRF), never secrets in a JWT, always validate `iss`/`aud`/`exp`/signature, short lifetimes, MFA on sensitive actions, login lockout. A `DecisionRecord` with the default recommendation.
- **knowledge-checks-faq:** any remaining `<KnowledgeCheck>` to reach **≥ 4 total** across the page, plus a `<Faq items={[…]} />` with **≥ 10** entries covering the spine.

- [ ] **Step 1:** Author the five sections.
- [ ] **Step 2: Create `tests/authentication-content.test.ts`**
```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/authentication.mdx", "utf8");

const requiredIds = [
  "overview",
  "credentials-passwords",
  "sessions-vs-tokens",
  "capacity-estimates",
  "jwt-internals",
  "oauth2-delegated",
  "oidc",
  "mfa",
  "token-lifecycle",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Authentication topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });
  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of ["<AuthenticationCapacity", "<OAuthAuthCodeSequence", "<SessionVsTokenSequence"]) {
      expect(content).toContain(tag);
    }
  });
  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
```

- [ ] **Step 3: Verify** — `npm test -- authentication-content`, then `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`. All green.
- [ ] **Step 4: Commit**
```bash
git add content/topics/authentication.mdx tests/authentication-content.test.ts
git commit -m "content: complete Authentication topic"
```

---

### Task 6: E2e + final verification

**Files:** Modify `e2e/pilot.spec.ts` (append one test).

- [ ] **Step 1: Append the e2e test**
```ts
test("learner can open the authentication security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /authentication/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^authentication$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/authentication#oauth2-delegated");
  await expect(page.locator("#oauth2-delegated")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /authorization-code flow with pkce/i }).first(),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run e2e** — `npm run test:e2e` (desktop + mobile) → all pass.
- [ ] **Step 3: Full verification gates** — `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (confirm `/topics/security/authentication` in the output), `git diff --check`. All green.
- [ ] **Step 4: Commit**
```bash
git add e2e/pilot.spec.ts
git commit -m "test: verify Authentication topic flow end-to-end"
```

---

## Self-Review

- **Spec coverage:** scope (authN-only, cross-refs) → Tasks 4–5 section requirements; rendering architecture (types/registry/route/layout/card/data flip) → Task 3; capacity model → Task 1; two diagrams → Task 2; 11-section content → Tasks 4–5; testing (registry, content, estimates, diagrams, e2e) → Tasks 1,2,3,5,6. All covered.
- **Placeholder scan:** content Tasks 4–5 intentionally describe sections (authored by the Opus orchestrator, per the established workflow) but pin every embed, component, and count concretely; all mechanical tasks carry full code. No stray TODO/TBD.
- **Type consistency:** `topicMetas`/`getTopic`/`TopicMeta`/`TopicLayout({meta, categoryTitle, children})`/`AuthenticationCapacity`/`OAuthAuthCodeSequence`/`SessionVsTokenSequence` are used identically across tasks. Capacity assumptions identical in estimates test, wrapper, MDX embed, and content test.
- **Count check:** adding a topic leaves the curriculum problem count at 33 — no curriculum/e2e count edits.
