# URL Shortener Tutorial Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, Vercel-ready system-design learning app with the complete 25-problem curriculum and one rigorous, diagram-rich URL Shortener tutorial.

**Architecture:** Use the Next.js App Router for statically generated pages, MDX for long-form tutorial content, typed TypeScript modules for curriculum and tutorial metadata, and focused React components for structured teaching elements. Technical diagrams are authored as responsive React SVG components so labels, paths, accessibility text, and visual semantics remain precise and reviewable.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4.3.1, `@next/mdx` 16.2.9, Vitest 4.1.9, Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- The application must deploy cleanly to Vercel and require no runtime backend.
- The URL Shortener is the only complete tutorial in this pilot; all other tutorials are labeled “Coming soon.”
- Content depth is layered as Fundamentals, Interview-ready, and Advanced.
- Architecture and sequence diagrams must be custom, precise, accessible SVG—not generated imagery.
- The reading experience must work without client-side enhancements; interactive additions progressively enhance static content.
- Support responsive layouts, keyboard navigation, visible focus states, reduced motion, light theme, and dark theme.
- A new tutorial should primarily require MDX content, typed metadata, and diagram assets.
- User accounts, synced progress, payments, comments, CMS integration, and heavy gamification are out of scope.

---

## Planned File Structure

```text
system-design/
├── app/
│   ├── curriculum/page.tsx              # Searchable/filterable curriculum
│   ├── learn/[slug]/page.tsx            # Static tutorial route
│   ├── learn/[slug]/not-found.tsx        # Tutorial-specific missing state
│   ├── globals.css                       # Design tokens and article styling
│   ├── layout.tsx                        # Metadata, fonts, theme bootstrap
│   ├── not-found.tsx                     # Global missing state
│   └── page.tsx                          # Home and featured tutorial
├── components/
│   ├── curriculum/
│   │   ├── curriculum-browser.tsx        # Client-side search and filters
│   │   └── problem-card.tsx              # Curriculum item
│   ├── diagrams/
│   │   ├── architecture-diagram.tsx      # URL Shortener HLD
│   │   ├── diagram-frame.tsx             # Caption, legend, expand control
│   │   ├── request-flow-diagrams.tsx     # Create/redirect sequence diagrams
│   │   └── scale-evolution.tsx           # Four-stage architecture evolution
│   ├── learning/
│   │   ├── api-contract.tsx              # API request/response presentation
│   │   ├── callout.tsx                   # Interview/risk/decision callouts
│   │   ├── capacity-model.tsx            # Transparent estimate calculations
│   │   ├── depth-section.tsx             # Fundamentals/interview/advanced cue
│   │   ├── entity-model.tsx              # Entity definitions
│   │   ├── failure-matrix.tsx            # Failure impact/mitigation table
│   │   ├── faq.tsx                       # Accessible FAQ disclosure
│   │   ├── knowledge-check.tsx           # Progressive quiz enhancement
│   │   └── tradeoff-table.tsx            # Structured design comparisons
│   ├── shell/
│   │   ├── site-footer.tsx
│   │   ├── site-header.tsx
│   │   └── theme-toggle.tsx
│   └── tutorial/
│       ├── reading-progress.tsx
│       ├── section-nav.tsx
│       ├── tutorial-layout.tsx
│       └── tutorial-toc.tsx
├── content/
│   └── tutorials/
│       └── url-shortener.mdx             # Complete pilot content
├── lib/
│   ├── curriculum.ts                     # All 25 typed problems
│   ├── tutorial-registry.ts              # Static slug-to-content registry
│   └── types.ts                          # Shared domain types
├── public/
│   └── favicon.svg
├── tests/
│   ├── curriculum.test.ts
│   ├── learning-components.test.tsx
│   ├── tutorial-registry.test.ts
│   └── url-shortener-content.test.ts
├── e2e/
│   └── pilot.spec.ts
├── mdx-components.tsx
├── eslint.config.mjs
├── next.config.mjs
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

---

### Task 1: Scaffold the Tested Next.js Application Shell

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Create: `components/shell/site-header.tsx`
- Create: `components/shell/site-footer.tsx`
- Create: `components/shell/theme-toggle.tsx`
- Create: `tests/site-shell.test.tsx`
- Create: `public/favicon.svg`

**Interfaces:**
- Produces: Root layout, global design tokens, `SiteHeader`, `SiteFooter`, and `ThemeToggle`.
- Consumes: No project code.

- [ ] **Step 1: Write the shell test**

```tsx
// tests/site-shell.test.tsx
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

it("presents the pilot and its primary learning action", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: /master system design/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /start url shortener/i })).toHaveAttribute(
    "href",
    "/learn/url-shortener",
  );
});
```

- [ ] **Step 2: Install the exact project dependencies**

Run:

```bash
npm init -y
npm install next@16.2.9 react@19.2.7 react-dom@19.2.7 @next/mdx@16.2.9 @mdx-js/loader @mdx-js/react lucide-react
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss@4.3.1 @tailwindcss/postcss vitest@4.1.9 jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test@1.61.0 eslint eslint-config-next
```

Expected: dependencies install with no unresolved peer-dependency error.

- [ ] **Step 3: Configure scripts, MDX, TypeScript, Tailwind, and Vitest**

Use these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "engines": {
    "node": ">=20.9.0"
  }
}
```

Configure `next.config.mjs` with `pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"]` and `@next/mdx`. Configure Vitest for `jsdom`, the `@/` alias, and `vitest.setup.ts`. Configure ESLint with the Next.js Core Web Vitals and TypeScript flat-config entries.

- [ ] **Step 4: Implement the root shell and visual tokens**

Create a server-rendered root layout with:

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
```

Define CSS custom properties for canvas, surface, ink, muted ink, border, accent, fundamentals, interview, advanced, success, warning, and danger in both themes. Use `prefers-reduced-motion` and a graph-paper background that fades behind article content.

- [ ] **Step 5: Run the focused checks**

Run:

```bash
npm test -- tests/site-shell.test.tsx
npm run typecheck
```

Expected: one passing test and zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.mjs tsconfig.json postcss.config.mjs eslint.config.mjs vitest.config.ts vitest.setup.ts app components/shell public/favicon.svg tests/site-shell.test.tsx
git commit -m "feat: scaffold tutorial application shell"
```

---

### Task 2: Add the Typed 25-Problem Curriculum

**Files:**
- Create: `lib/types.ts`
- Create: `lib/curriculum.ts`
- Create: `components/curriculum/problem-card.tsx`
- Create: `components/curriculum/curriculum-browser.tsx`
- Create: `app/curriculum/page.tsx`
- Modify: `app/page.tsx`
- Create: `tests/curriculum.test.ts`

**Interfaces:**
- Produces: `Problem`, `ProblemDifficulty`, `ProblemStatus`, `problems`, `getProblem(slug)`, `ProblemCard`, `CurriculumBrowser`.
- Consumes: Shell and visual tokens from Task 1.

- [ ] **Step 1: Write curriculum contract tests**

```ts
// tests/curriculum.test.ts
import { getProblem, problems } from "@/lib/curriculum";

it("contains the approved 25 unique problems", () => {
  expect(problems).toHaveLength(25);
  expect(new Set(problems.map((problem) => problem.slug)).size).toBe(25);
});

it("only exposes URL Shortener as available", () => {
  expect(problems.filter((problem) => problem.status === "available").map((problem) => problem.slug))
    .toEqual(["url-shortener"]);
  expect(getProblem("url-shortener")?.title).toBe("URL Shortener");
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/curriculum.test.ts`

Expected: FAIL because `@/lib/curriculum` does not exist.

- [ ] **Step 3: Define types and all curriculum records**

Define:

```ts
export type ProblemDifficulty = "Foundational" | "Intermediate" | "Advanced";
export type ProblemStatus = "available" | "coming-soon";

export interface Problem {
  slug: string;
  title: string;
  summary: string;
  difficulty: ProblemDifficulty;
  concepts: readonly string[];
  status: ProblemStatus;
  sequence: number;
}
```

Add the approved 25 entries in exact sequence, each with a concise description, a difficulty, and 3–5 concepts. Export:

```ts
export const getProblem = (slug: string) =>
  problems.find((problem) => problem.slug === slug);
```

- [ ] **Step 4: Build curriculum presentation**

`CurriculumBrowser` accepts `{ problems: readonly Problem[] }`, provides a labeled search input and difficulty buttons, and always distinguishes unavailable items with visible “Coming soon” text. `ProblemCard` links only available tutorials.

- [ ] **Step 5: Integrate home and curriculum pages**

The home page must include:

- Hero focused on mastering the design conversation.
- Three learning-depth explanations.
- Featured URL Shortener tutorial.
- A compact curriculum preview.
- Links to `/learn/url-shortener` and `/curriculum`.

The curriculum page must render all 25 items and preserve meaningful content before hydration.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- tests/curriculum.test.ts
npm run typecheck
npm run lint
```

Expected: all commands pass.

```bash
git add lib components/curriculum app/page.tsx app/curriculum tests/curriculum.test.ts
git commit -m "feat: add system design curriculum"
```

---

### Task 3: Build the Static MDX Tutorial System

**Files:**
- Create: `lib/tutorial-registry.ts`
- Create: `mdx-components.tsx`
- Create: `content/tutorials/url-shortener.mdx`
- Create: `app/learn/[slug]/page.tsx`
- Create: `app/learn/[slug]/not-found.tsx`
- Create: `app/not-found.tsx`
- Create: `components/tutorial/tutorial-layout.tsx`
- Create: `components/tutorial/tutorial-toc.tsx`
- Create: `components/tutorial/section-nav.tsx`
- Create: `components/tutorial/reading-progress.tsx`
- Create: `tests/tutorial-registry.test.ts`

**Interfaces:**
- Produces: `TutorialMeta`, `tutorials`, `getTutorial(slug)`, `TutorialLayout`, and statically generated `/learn/url-shortener`.
- Consumes: `Problem` metadata from Task 2 and MDX configuration from Task 1.

- [ ] **Step 1: Write registry and route tests**

```ts
// tests/tutorial-registry.test.ts
import { getTutorial, tutorials } from "@/lib/tutorial-registry";

it("registers only the URL Shortener pilot", () => {
  expect(Object.keys(tutorials)).toEqual(["url-shortener"]);
  expect(getTutorial("url-shortener")?.sections).toHaveLength(18);
});

it("returns undefined for unavailable tutorials", () => {
  expect(getTutorial("rate-limiter")).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/tutorial-registry.test.ts`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the explicit static registry**

Define metadata with:

```ts
export interface TutorialSection {
  id: string;
  label: string;
  depth: "fundamentals" | "interview-ready" | "advanced";
}

export interface TutorialMeta {
  slug: string;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  readingMinutes: number;
  concepts: readonly string[];
  sections: readonly TutorialSection[];
  Content: React.ComponentType;
}
```

Use an explicit import of `content/tutorials/url-shortener.mdx`; do not use runtime filesystem reads or unconstrained dynamic imports.

- [ ] **Step 4: Build the tutorial route and navigation**

Use `generateStaticParams()` from registry keys, `generateMetadata()` from tutorial metadata, and `notFound()` for unknown slugs. `TutorialLayout` renders metadata, sticky desktop TOC, mobile section selector, reading progress, article, and previous/next section controls.

- [ ] **Step 5: Add a minimal compiling MDX skeleton**

Create all 18 required `h2` IDs in the correct order, each with one introductory sentence. This skeleton exists only to establish the route; Task 7 replaces it with complete content.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- tests/tutorial-registry.test.ts
npm run typecheck
npm run build
```

Expected: one statically generated tutorial route and no build errors.

```bash
git add lib/tutorial-registry.ts mdx-components.tsx content app/learn app/not-found.tsx components/tutorial tests/tutorial-registry.test.ts
git commit -m "feat: add static MDX tutorial framework"
```

---

### Task 4: Implement Reusable Teaching Components

**Files:**
- Create: `components/learning/callout.tsx`
- Create: `components/learning/depth-section.tsx`
- Create: `components/learning/api-contract.tsx`
- Create: `components/learning/entity-model.tsx`
- Create: `components/learning/tradeoff-table.tsx`
- Create: `components/learning/failure-matrix.tsx`
- Create: `components/learning/faq.tsx`
- Create: `components/learning/knowledge-check.tsx`
- Modify: `mdx-components.tsx`
- Create: `tests/learning-components.test.tsx`

**Interfaces:**
- Produces: `Callout`, `DepthSection`, `ApiContract`, `EntityModel`, `TradeoffTable`, `FailureMatrix`, `Faq`, `KnowledgeCheck`.
- Consumes: Global semantic tokens from Task 1.

- [ ] **Step 1: Write accessibility and behavior tests**

```tsx
// tests/learning-components.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { Faq } from "@/components/learning/faq";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

it("renders FAQ answers through native accessible disclosure", () => {
  render(<Faq items={[{ question: "Why Base62?", answer: "It keeps tokens compact." }]} />);
  expect(screen.getByText("Why Base62?").closest("summary")).toBeTruthy();
});

it("explains a knowledge-check answer after selection", () => {
  render(
    <KnowledgeCheck
      question="Where should click analytics run?"
      options={["Inline", "Asynchronously"]}
      answer={1}
      explanation="Redirect latency stays independent of analytics."
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Asynchronously" }));
  expect(screen.getByText(/redirect latency stays independent/i)).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/learning-components.test.tsx`

Expected: FAIL because component modules do not exist.

- [ ] **Step 3: Implement static-first components**

Use semantic HTML:

- `<aside>` for callouts.
- `<table>` plus mobile overflow for APIs, entities, trade-offs, and failures.
- `<details>`/`<summary>` for FAQ.
- A client component only for `KnowledgeCheck`; include the explanation in the DOM and reveal it after selection.
- Depth sections include visible text labels, not color-only distinctions.

- [ ] **Step 4: Register components for MDX**

Export the teaching components through `useMDXComponents()` so MDX can use names such as `<Callout>`, `<ApiContract>`, and `<KnowledgeCheck>`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- tests/learning-components.test.tsx
npm run typecheck
npm run lint
```

Expected: all checks pass.

```bash
git add components/learning mdx-components.tsx tests/learning-components.test.tsx
git commit -m "feat: add reusable tutorial components"
```

---

### Task 5: Add Transparent Capacity Calculations

**Files:**
- Create: `components/learning/capacity-model.tsx`
- Create: `lib/url-shortener-estimates.ts`
- Create: `tests/url-shortener-estimates.test.ts`
- Modify: `mdx-components.tsx`

**Interfaces:**
- Produces: `CapacityAssumptions`, `CapacityResults`, `calculateUrlShortenerCapacity(assumptions)`, and `CapacityModel`.
- Consumes: Learning-component visual patterns from Task 4.

- [ ] **Step 1: Write deterministic calculation tests**

```ts
// tests/url-shortener-estimates.test.ts
import { calculateUrlShortenerCapacity } from "@/lib/url-shortener-estimates";

it("derives traffic and storage from explicit assumptions", () => {
  const result = calculateUrlShortenerCapacity({
    newLinksPerMonth: 100_000_000,
    readWriteRatio: 100,
    peakMultiplier: 3,
    bytesPerMapping: 500,
    retentionYears: 5,
    cacheCoveragePercent: 20,
  });

  expect(result.averageWriteQps).toBeCloseTo(38.58, 1);
  expect(result.averageReadQps).toBeCloseTo(3858, 0);
  expect(result.peakReadQps).toBeCloseTo(11574, 0);
  expect(result.mappingStorageTB).toBeCloseTo(3, 1);
  expect(result.cacheWorkingSetGB).toBeCloseTo(600, 0);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/url-shortener-estimates.test.ts`

Expected: FAIL because the calculation module does not exist.

- [ ] **Step 3: Implement pure calculations**

Use:

```ts
const secondsPerMonth = 30 * 24 * 60 * 60;
const totalMappings = assumptions.newLinksPerMonth * assumptions.retentionYears * 12;
const mappingStorageBytes = totalMappings * assumptions.bytesPerMapping;
```

Return raw numeric values and keep formatting in the component. Document decimal GB/TB units in the UI.

- [ ] **Step 4: Render assumption-to-consequence cards**

`CapacityModel` must display each assumption, formula, rounded result, and architecture consequence. Keep values static for the pilot; do not add editable controls that could make surrounding prose inconsistent.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- tests/url-shortener-estimates.test.ts
npm run typecheck
```

Expected: all tests pass.

```bash
git add components/learning/capacity-model.tsx lib/url-shortener-estimates.ts tests/url-shortener-estimates.test.ts mdx-components.tsx
git commit -m "feat: add URL shortener capacity model"
```

---

### Task 6: Create Precise Architecture and Flow Diagrams

**Files:**
- Create: `components/diagrams/diagram-frame.tsx`
- Create: `components/diagrams/architecture-diagram.tsx`
- Create: `components/diagrams/request-flow-diagrams.tsx`
- Create: `components/diagrams/scale-evolution.tsx`
- Create: `components/diagrams/diagram-primitives.tsx`
- Create: `tests/diagrams.test.tsx`
- Modify: `mdx-components.tsx`

**Interfaces:**
- Produces: `DiagramFrame`, `ArchitectureDiagram`, `CreateUrlSequence`, `RedirectSequence`, `ScaleEvolution`.
- Consumes: Global design tokens and tutorial content conventions.

- [ ] **Step 1: Write semantic diagram tests**

```tsx
// tests/diagrams.test.tsx
import { render, screen } from "@testing-library/react";
import { ArchitectureDiagram } from "@/components/diagrams/architecture-diagram";

it("exposes the architecture meaning to non-visual readers", () => {
  render(<ArchitectureDiagram />);
  expect(screen.getByRole("img", { name: /url shortener architecture/i })).toBeInTheDocument();
  expect(screen.getByText(/redirect service reads cache first/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/diagrams.test.tsx`

Expected: FAIL because diagram modules do not exist.

- [ ] **Step 3: Implement shared SVG primitives**

Create typed primitives for component boxes, database cylinders, labeled arrows, trust/failure boundaries, and legends. Use SVG markers for arrowheads and distinct patterns:

- Solid accent: synchronous creation path.
- Solid green: synchronous redirect path.
- Dashed violet: asynchronous analytics events.
- Dashed red: invalidation/control messages.

- [ ] **Step 4: Implement the high-level architecture**

The diagram must explicitly show:

```text
Client → DNS/Edge → API Gateway
API Gateway → Write Service → Token Generator → Mapping Store
API Gateway → Redirect Service → Distributed Cache → Mapping Store
Redirect Service ⇢ Event Stream ⇢ Analytics Consumers → Analytics Store
Write Service → Abuse Scanner
All serving components → Observability
```

Show the cache-miss fallback and cache-fill arrow, regional serving boundary, source-of-truth label, and asynchronous event legend.

- [ ] **Step 5: Implement sequence and evolution diagrams**

Create separate precise sequences for:

- Create URL.
- Redirect cache hit.
- Redirect cache miss and fill.
- Async click recording.
- Disabled/expired mapping.

The scale evolution visual must show four stages and the trigger/cost at each stage.

- [ ] **Step 6: Add frame, caption, and full-size viewing**

`DiagramFrame` uses `<figure>`, `<figcaption>`, horizontal overflow on narrow screens, a full-size dialog, an adjacent text explanation, and no dependency on the dialog for comprehension.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck
npm run lint
```

Expected: all checks pass.

```bash
git add components/diagrams tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add URL shortener architecture diagrams"
```

---

### Task 7: Author the Complete URL Shortener Tutorial

**Files:**
- Replace: `content/tutorials/url-shortener.mdx`
- Create: `tests/url-shortener-content.test.ts`

**Interfaces:**
- Produces: Complete pilot tutorial consumed by the static registry.
- Consumes: All learning components, diagrams, and calculations from Tasks 4–6.

- [ ] **Step 1: Write the structural content test**

```ts
// tests/url-shortener-content.test.ts
import { readFileSync } from "node:fs";

const content = readFileSync("content/tutorials/url-shortener.mdx", "utf8");

it("contains every required tutorial section and teaching artifact", () => {
  const requiredIds = [
    "interview-framing", "requirements", "capacity-estimates", "entity-model",
    "api-design", "key-generation", "high-level-architecture", "detailed-flows",
    "storage-partitioning", "caching", "consistency-concurrency",
    "scalability-evolution", "resiliency-failure-modes", "security-abuse",
    "observability", "tradeoffs-alternatives", "interview-summary",
    "knowledge-checks-faq",
  ];
  requiredIds.forEach((id) => expect(content).toContain(`id="${id}"`));
  expect(content.match(/<KnowledgeCheck/g)?.length).toBeGreaterThanOrEqual(6);
  expect(content.match(/question:/g)?.length).toBeGreaterThanOrEqual(12);
});
```

- [ ] **Step 2: Run the test to verify the skeleton is insufficient**

Run: `npm test -- tests/url-shortener-content.test.ts`

Expected: FAIL on knowledge-check and FAQ thresholds.

- [ ] **Step 3: Author sections 1–6**

Write technically consistent material for:

- Interview framing and a 45-minute allocation.
- Functional scope and explicit exclusions.
- NFRs with concrete targets: redirect availability, p99 latency, creation latency, durability, and read/write ratio.
- Capacity model using Task 5 assumptions.
- Entity definitions for `UrlMapping`, `AliasReservation`, and `ClickEvent`.
- Five representative APIs with JSON examples, status codes, authorization, idempotency, validation, and rate limits.
- Comparison of four key-generation strategies, recommending distributed ID + Base62 for the stated design while explaining random-token alternatives.

- [ ] **Step 4: Author sections 7–11**

Embed architecture and sequence diagrams, then explain:

- Responsibilities and boundaries of every component.
- Key-value mapping store selection and alternatives.
- Partitioning by token hash, replication, rebalancing, backup, and hot-key handling.
- Cache-aside reads, TTL, negative cache, request coalescing, invalidation, and cache outage behavior.
- Alias uniqueness, read-after-write, disable/delete propagation, and eventually consistent analytics.

- [ ] **Step 5: Author sections 12–18**

Cover:

- Four-stage scale evolution with complexity triggers.
- Failure matrix with impact, signal, mitigation, and recovery for all eight specified failures.
- Security, malware/phishing scanning, quotas, enumeration, authorization, privacy, and retention.
- SLIs, SLOs, metrics, logs, traces, and alert examples.
- Decision summary with gains, sacrifices, and revisit triggers.
- A concise interview answer and likely follow-up prompts.
- At least six knowledge checks and twelve substantive FAQ entries.

- [ ] **Step 6: Perform numerical and terminology review**

Verify these invariants in prose, tables, and diagrams:

- The stated monthly writes match capacity calculations.
- Redirect traffic is 100× write traffic.
- Analytics never blocks redirect completion.
- `UrlMapping.shortCode` is the source-of-truth lookup key.
- Custom aliases use conditional creation.
- Disable/delete invalidates cache and remains safe under stale replicas.
- `301` versus `302/307` behavior is explained as a product and caching choice.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test -- tests/url-shortener-content.test.ts
npm run typecheck
npm run build
```

Expected: content test passes and MDX compiles in production.

```bash
git add content/tutorials/url-shortener.mdx tests/url-shortener-content.test.ts
git commit -m "content: complete URL shortener tutorial"
```

---

### Task 8: Add End-to-End Accessibility and Responsive Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/pilot.spec.ts`
- Modify: `app/globals.css`
- Modify: any component failing browser verification

**Interfaces:**
- Produces: Browser-level verification for navigation, filtering, themes, tutorial anchors, diagrams, and checks.
- Consumes: Completed application from Tasks 1–7.

- [ ] **Step 1: Write the Playwright pilot flow**

```ts
// e2e/pilot.spec.ts
import { expect, test } from "@playwright/test";

test("learner can discover and complete the pilot path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /start url shortener/i }).click();
  await expect(page.getByRole("heading", { name: /design a url shortener/i })).toBeVisible();
  await page.getByRole("link", { name: /high-level architecture/i }).click();
  await expect(page.locator("#high-level-architecture")).toBeInViewport();
  await expect(page.getByRole("img", { name: /url shortener architecture/i })).toBeVisible();
  await page.getByRole("button", { name: /asynchronously/i }).first().click();
  await expect(page.getByText(/redirect latency/i).first()).toBeVisible();
});

test("curriculum clearly separates available and upcoming content", async ({ page }) => {
  await page.goto("/curriculum");
  await expect(page.getByText("Coming soon")).toHaveCount(24);
  await page.getByLabel(/search problems/i).fill("payment");
  await expect(page.getByRole("heading", { name: "Payment System" })).toBeVisible();
});
```

- [ ] **Step 2: Configure desktop and mobile projects**

Configure Chromium projects at:

- Desktop: `1440 × 1000`.
- Mobile: Pixel 7 emulation.

Use `webServer.command: "npm run dev"` and `reuseExistingServer: true`.

- [ ] **Step 3: Run browser tests and inspect failures**

Run:

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: tests initially identify any inaccessible naming, anchor, overflow, or mobile navigation issues.

- [ ] **Step 4: Correct verified issues**

Fix only observed problems. Confirm:

- No horizontal page overflow at 390 px.
- Diagram canvases scroll inside their frame.
- Sticky navigation does not cover anchored headings.
- Focus is visible on links, buttons, summaries, and dialog controls.
- Dark theme maintains readable diagram labels.
- Reduced motion disables progress and disclosure transitions.

- [ ] **Step 5: Re-run and commit**

Run:

```bash
npm run test:e2e
npm test
npm run typecheck
npm run lint
```

Expected: all checks pass.

```bash
git add playwright.config.ts e2e app/globals.css app components
git commit -m "test: verify responsive pilot learning flow"
```

---

### Task 9: Production Build and Vercel Readiness

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Modify: `package.json`
- Modify: project files only if final checks expose defects

**Interfaces:**
- Produces: Documented, clean, deployable repository.
- Consumes: Entire pilot application.

- [ ] **Step 1: Document local and Vercel workflows**

Include:

```text
npm install
npm run dev
npm test
npm run test:e2e
npm run build
```

Document that Vercel should detect Next.js automatically, no environment variables are required, and new tutorials are added through curriculum metadata, registry metadata, MDX, and diagram assets.

- [ ] **Step 2: Add repository hygiene**

Ignore:

```gitignore
.next/
node_modules/
playwright-report/
test-results/
coverage/
.vercel/
.DS_Store
*.tsbuildinfo
```

- [ ] **Step 3: Run the final verification suite**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected:

- All unit and content tests pass.
- TypeScript and ESLint report zero errors.
- Next.js production build completes.
- Both browser projects pass.
- No whitespace errors.
- Only intentional README or hygiene changes remain uncommitted.

- [ ] **Step 4: Perform final visual review**

Open `/`, `/curriculum`, and `/learn/url-shortener` at desktop and mobile widths. Inspect:

- Above-the-fold hierarchy.
- Long-form measure and typography.
- Table overflow.
- Diagram labels and arrow meanings.
- Light/dark contrast.
- Empty search result.
- 404 state.
- “Coming soon” clarity.

Correct any issue before claiming completion.

- [ ] **Step 5: Commit the deployable pilot**

```bash
git add README.md .gitignore package.json package-lock.json app components content lib public tests e2e
git commit -m "docs: prepare system design pilot for Vercel"
```

- [ ] **Step 6: Record final evidence**

Run:

```bash
git log --oneline --decorate -10
git status --short --branch
```

Expected: clean working tree with the implementation commits visible.
