# System Design Tutorial App — Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, responsive Next.js learning app deployable to Vercel that presents a 25-problem system-design curriculum (24 "coming soon") and one complete, technically rigorous **URL Shortener** tutorial with precise vector diagrams.

**Architecture:** Statically generated Next.js (App Router) + TypeScript + Tailwind CSS v4. Curriculum metadata lives in a typed module. Each tutorial is an MDX file with frontmatter, rendered through `next-mdx-remote/rsc` with a shared map of structured content components and hand-authored SVG diagram components. A reusable `TutorialLayout` provides the table of contents, reading progress, and section navigation, so adding a future tutorial is mostly authoring one MDX file plus metadata and diagrams.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript 5, Tailwind CSS v4, `next-mdx-remote` (RSC), `gray-matter`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`, `next-themes`, `lucide-react` (icons), Vitest (unit tests for pure logic).

## Global Constraints

- Working directory: `/Users/zaks/Projects/system-design` (git repo already initialized; default branch `master`).
- Runtime floor: Node ≥ 20. Package manager: `npm`.
- Framework: Next.js 15 App Router with React Server Components; **no `pages/` directory**.
- All app source under `src/`. Path alias `@/*` → `src/*`.
- Language: TypeScript everywhere; `strict: true`. No `any` in committed code except narrowly typed MDX component props where unavoidable.
- Styling: Tailwind CSS v4 utility classes + a small set of CSS custom properties for theme tokens. No CSS-in-JS libraries.
- Theme: light + dark via `next-themes` using the `class` strategy; respect `prefers-reduced-motion`.
- Diagrams: hand-authored SVG React components only — **no raster/AI-generated images for architecture or sequence diagrams.** Consistent shapes, colors, arrow styles, and a legend. Every diagram has an `aria-label`/`<title>` and an adjacent textual explanation.
- Accessibility: semantic HTML, keyboard-navigable, visible focus rings, WCAG AA contrast in both themes.
- The 25 curriculum problems are fixed (see Task 4). Only **URL Shortener** is `available`; all others are `coming-soon`. Coming-soon entries must never link to an unbuilt tutorial.
- Each task ends with `npm run typecheck`, `npm run lint`, and `npm run build` passing before commit.
- Deployable to Vercel with zero extra config (default Next.js build).

---

## File Structure

```
src/
  app/
    layout.tsx                 # Root layout: html/body, ThemeProvider, Header, Footer
    page.tsx                   # Home
    globals.css                # Tailwind import + theme tokens + base typography
    curriculum/page.tsx        # Curriculum index (all 25)
    tutorials/[slug]/page.tsx  # Dynamic tutorial route (static params)
    not-found.tsx              # 404
  components/
    shell/Header.tsx
    shell/Footer.tsx
    shell/ThemeToggle.tsx
    shell/ThemeProvider.tsx
    curriculum/CurriculumGrid.tsx
    curriculum/ProblemCard.tsx
    tutorial/TutorialLayout.tsx
    tutorial/TableOfContents.tsx
    tutorial/ReadingProgress.tsx
    tutorial/SectionNav.tsx
    tutorial/DepthBadge.tsx
    mdx/MdxComponents.tsx       # the components map passed to MDXRemote
    mdx/RequirementsTable.tsx
    mdx/CapacityEstimate.tsx
    mdx/EntityTable.tsx
    mdx/ApiSpec.tsx
    mdx/DecisionRecord.tsx
    mdx/TradeoffTable.tsx
    mdx/Callout.tsx             # info / interview / warning variants
    mdx/FailureMatrix.tsx
    mdx/KnowledgeCheck.tsx
    mdx/Faq.tsx
    mdx/Figure.tsx              # wraps a diagram + caption + full-screen
    diagrams/primitives.tsx     # Node, Lane, Arrow, Legend SVG building blocks + tokens
    diagrams/DiagramFrame.tsx   # responsive viewBox wrapper + zoom/fullscreen
    diagrams/url-shortener/ArchitectureDiagram.tsx
    diagrams/url-shortener/CreateFlow.tsx
    diagrams/url-shortener/RedirectCacheHitFlow.tsx
    diagrams/url-shortener/RedirectCacheMissFlow.tsx
    diagrams/url-shortener/AnalyticsFlow.tsx
    diagrams/url-shortener/ScalingStages.tsx
  lib/
    curriculum.ts              # typed 25-problem metadata + helpers
    tutorials.ts               # load + parse MDX content files
    base62.ts                  # pure encoder used by Key Generation section demo
    types.ts                   # shared TS types
content/
  tutorials/url-shortener.mdx
tests/
  curriculum.test.ts
  base62.test.ts
```

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: a buildable Next.js App Router app; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`.
- Produces: path alias `@/*` → `src/*`.

- [ ] **Step 1: Scaffold with the official template (non-interactive)**

```bash
cd /Users/zaks/Projects/system-design
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
```

If `create-next-app` refuses because the directory is non-empty (it contains `.git`/`docs`), scaffold in a temp dir and copy in:

```bash
npx create-next-app@latest /tmp/sd-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
cp -R /tmp/sd-scaffold/. /Users/zaks/Projects/system-design/
rm -rf /Users/zaks/Projects/system-design/.git-tmp 2>/dev/null; true
# Do NOT overwrite existing docs/ or .git/
rm -rf /tmp/sd-scaffold
```

- [ ] **Step 2: Add the remaining dependencies**

```bash
cd /Users/zaks/Projects/system-design
npm install next-mdx-remote gray-matter remark-gfm rehype-slug rehype-autolink-headings next-themes lucide-react
npm install -D vitest @types/node
```

- [ ] **Step 3: Add `typecheck` and `test` scripts to `package.json`**

In `package.json` `"scripts"`, ensure these exist (keep the generated `dev`/`build`/`start`/`lint`):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 5: Create shared types `src/lib/types.ts`**

```ts
export type Difficulty = "introductory" | "intermediate" | "advanced";
export type Availability = "available" | "coming-soon";
export type Depth = "fundamentals" | "interview-ready" | "advanced";

export interface ProblemMeta {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  concepts: string[];
  availability: Availability;
}

export interface TutorialFrontmatter {
  title: string;
  difficulty: Difficulty;
  readingMinutes: number;
  concepts: string[];
  summary: string;
}
```

- [ ] **Step 6: Replace `src/app/page.tsx` with a temporary placeholder**

```tsx
export default function Home() {
  return <main className="p-10 text-2xl font-semibold">System Design Tutorials</main>;
}
```

- [ ] **Step 7: Verify build, typecheck, lint**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed; build output lists the `/` route.

- [ ] **Step 8: Commit**

```bash
cd /Users/zaks/Projects/system-design
git add -A
git commit -m "chore: scaffold Next.js app with MDX and tooling deps"
```

---

### Task 2: Design system — theme tokens, typography, theme toggle

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/shell/ThemeProvider.tsx`, `src/components/shell/ThemeToggle.tsx`

**Interfaces:**
- Produces: CSS custom properties for the palette consumed by all components: `--bg`, `--bg-elevated`, `--fg`, `--fg-muted`, `--border`, `--accent` (technical blue), `--decision` (green), `--risk` (amber/red), `--advanced` (violet), `--grid-line`.
- Produces: `<ThemeProvider>` (wraps `next-themes`) and `<ThemeToggle/>` exporting default React components.

- [ ] **Step 1: Define tokens + base typography in `globals.css`**

Use Tailwind v4 `@import "tailwindcss";` then a `:root` / `.dark` token block. Calm, content-first, neutral palette with one technical accent. Long-form reading: comfortable measure (`max-w-[72ch]` for prose), strong heading hierarchy, subtle graph-paper background using `--grid-line` on the home hero only. Include `@media (prefers-reduced-motion: reduce)` to disable transitions.

```css
@import "tailwindcss";

:root {
  --bg: #fbfbfa; --bg-elevated: #ffffff; --fg: #1c1d22; --fg-muted: #5c5f6b;
  --border: #e5e5e2; --accent: #2563eb; --decision: #15803d; --risk: #b45309;
  --advanced: #7c3aed; --grid-line: #ecebe7;
}
.dark {
  --bg: #0e0f12; --bg-elevated: #16181d; --fg: #e8e9ec; --fg-muted: #9aa0ad;
  --border: #262932; --accent: #6098ff; --decision: #4ade80; --risk: #fbbf24;
  --advanced: #a78bfa; --grid-line: #1b1d23;
}
body { background: var(--bg); color: var(--fg); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

- [ ] **Step 2: Create `ThemeProvider.tsx`** (client component wrapping `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`).

- [ ] **Step 3: Create `ThemeToggle.tsx`** (client component; toggles theme, renders `Sun`/`Moon` from `lucide-react`, `aria-label`, mounted-guard to avoid hydration mismatch).

- [ ] **Step 4: Wire `ThemeProvider` into `src/app/layout.tsx`** with `<html lang="en" suppressHydrationWarning>` and set `metadata` (title/description).

- [ ] **Step 5: Verify** `npm run typecheck && npm run lint && npm run build`. Expected: pass.

- [ ] **Step 6: Commit** `git commit -am "feat: design tokens, typography, and theme switching"`

---

### Task 3: App shell — Header and Footer

**Files:**
- Create: `src/components/shell/Header.tsx`, `src/components/shell/Footer.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `ThemeToggle`.
- Produces: `<Header/>` (sticky top nav: wordmark linking `/`, links to `/` and `/curriculum`, `ThemeToggle`), `<Footer/>` — both default-exported React components rendered in the root layout around `{children}`.

- [ ] **Step 1: Implement `Header.tsx`** — semantic `<header>` with `<nav>`, accessible links, sticky with bottom border using `--border`, responsive (links collapse to a simple row on mobile).
- [ ] **Step 2: Implement `Footer.tsx`** — small print, link to curriculum, note that content is for interview preparation.
- [ ] **Step 3: Render `<Header/>` and `<Footer/>` in `layout.tsx`** wrapping a `<div className="min-h-dvh flex flex-col">` with `<main className="flex-1">`.
- [ ] **Step 4: Verify** `npm run typecheck && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** `git commit -am "feat: app shell header and footer"`

---

### Task 4: Curriculum data + Home + Curriculum pages

**Files:**
- Create: `src/lib/curriculum.ts`
- Create: `src/components/curriculum/ProblemCard.tsx`, `src/components/curriculum/CurriculumGrid.tsx`
- Create: `tests/curriculum.test.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/curriculum/page.tsx`

**Interfaces:**
- Produces: `export const problems: ProblemMeta[]` (25 entries) and `export function getProblem(slug: string): ProblemMeta | undefined`.
- Produces: `<CurriculumGrid problems={...} />`, `<ProblemCard problem={...} />`.

- [ ] **Step 1: Write failing test `tests/curriculum.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { problems, getProblem } from "@/lib/curriculum";

describe("curriculum", () => {
  it("has exactly 25 problems", () => {
    expect(problems).toHaveLength(25);
  });
  it("has unique slugs", () => {
    const slugs = problems.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(25);
  });
  it("marks only url-shortener as available", () => {
    const available = problems.filter((p) => p.availability === "available");
    expect(available.map((p) => p.slug)).toEqual(["url-shortener"]);
  });
  it("every problem has a non-empty summary and at least one concept", () => {
    for (const p of problems) {
      expect(p.summary.length).toBeGreaterThan(0);
      expect(p.concepts.length).toBeGreaterThan(0);
    }
  });
  it("getProblem resolves a known slug and rejects unknown", () => {
    expect(getProblem("url-shortener")?.title).toBe("URL Shortener");
    expect(getProblem("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/curriculum`.

- [ ] **Step 3: Implement `src/lib/curriculum.ts`**

Create the 25 entries in the fixed order from the spec. `url-shortener` is `available`; all others `coming-soon`. Give each a one-sentence `summary`, a `difficulty`, and 2–4 `concepts`. Example head of the array (continue for all 25 — slugs are kebab-case of the title):

```ts
import type { ProblemMeta } from "./types";

export const problems: ProblemMeta[] = [
  { slug: "url-shortener", title: "URL Shortener", summary: "Map billions of long URLs to short, collision-free keys with sub-50ms redirects.", difficulty: "introductory", concepts: ["Key generation", "Caching", "Read-heavy scaling"], availability: "available" },
  { slug: "rate-limiter", title: "Rate Limiter", summary: "Throttle requests fairly across a distributed fleet without a single bottleneck.", difficulty: "introductory", concepts: ["Token bucket", "Distributed counters", "Sliding window"], availability: "coming-soon" },
  { slug: "pastebin", title: "Pastebin", summary: "Store and serve large text blobs with expiry, privacy, and CDN delivery.", difficulty: "introductory", concepts: ["Blob storage", "TTL", "CDN"], availability: "coming-soon" },
  { slug: "notification-service", title: "Notification Service", summary: "Fan out push, SMS, and email reliably with retries and user preferences.", difficulty: "intermediate", concepts: ["Fan-out", "Queues", "Idempotency"], availability: "coming-soon" },
  { slug: "distributed-cache", title: "Distributed Cache", summary: "Build a sharded, replicated in-memory cache with eviction and consistency controls.", difficulty: "intermediate", concepts: ["Consistent hashing", "Eviction", "Replication"], availability: "coming-soon" },
  { slug: "api-gateway", title: "API Gateway", summary: "Route, authenticate, rate-limit, and observe traffic to many backend services.", difficulty: "intermediate", concepts: ["Routing", "AuthN/Z", "Observability"], availability: "coming-soon" },
  { slug: "web-crawler", title: "Web Crawler", summary: "Crawl the web at scale with politeness, dedup, and freshness scheduling.", difficulty: "advanced", concepts: ["Frontier queue", "Dedup", "Politeness"], availability: "coming-soon" },
  { slug: "search-autocomplete", title: "Search Autocomplete", summary: "Serve top-k prefix suggestions in milliseconds from a trie/ranking pipeline.", difficulty: "intermediate", concepts: ["Trie", "Top-k", "Latency"], availability: "coming-soon" },
  { slug: "news-feed", title: "News Feed", summary: "Generate personalized feeds balancing fan-out-on-write vs read aggregation.", difficulty: "advanced", concepts: ["Fan-out", "Ranking", "Hot users"], availability: "coming-soon" },
  { slug: "chat-system", title: "Chat System", summary: "Deliver real-time 1:1 and group messages with presence and ordering guarantees.", difficulty: "advanced", concepts: ["WebSockets", "Ordering", "Presence"], availability: "coming-soon" },
  { slug: "video-streaming", title: "Video Streaming Platform", summary: "Ingest, transcode, and stream adaptive-bitrate video globally via CDN.", difficulty: "advanced", concepts: ["Transcoding", "ABR", "CDN"], availability: "coming-soon" },
  { slug: "file-storage-sync", title: "File Storage and Sync", summary: "Sync files across devices with chunking, dedup, and conflict resolution.", difficulty: "advanced", concepts: ["Chunking", "Sync", "Conflict resolution"], availability: "coming-soon" },
  { slug: "photo-sharing", title: "Photo Sharing Platform", summary: "Upload, process, and serve images and feeds at social-network scale.", difficulty: "advanced", concepts: ["Object storage", "Image pipeline", "Feed"], availability: "coming-soon" },
  { slug: "ride-hailing", title: "Ride-Hailing Service", summary: "Match riders to nearby drivers in real time using geospatial indexing.", difficulty: "advanced", concepts: ["Geo-indexing", "Matching", "Real-time"], availability: "coming-soon" },
  { slug: "food-delivery", title: "Food Delivery Platform", summary: "Coordinate orders, restaurants, and couriers with live tracking and ETAs.", difficulty: "advanced", concepts: ["Order workflow", "Dispatch", "ETA"], availability: "coming-soon" },
  { slug: "ticket-booking", title: "Ticket Booking System", summary: "Sell limited inventory under contention without overselling seats.", difficulty: "advanced", concepts: ["Locking", "Inventory", "Consistency"], availability: "coming-soon" },
  { slug: "ecommerce-platform", title: "E-commerce Platform", summary: "Run catalog, cart, checkout, and inventory across many services.", difficulty: "advanced", concepts: ["Catalog", "Cart", "Inventory"], availability: "coming-soon" },
  { slug: "payment-system", title: "Payment System", summary: "Process payments exactly once with ledgers, idempotency, and reconciliation.", difficulty: "advanced", concepts: ["Ledger", "Idempotency", "Consistency"], availability: "coming-soon" },
  { slug: "metrics-monitoring", title: "Metrics and Monitoring System", summary: "Ingest, store, and query high-cardinality time-series at scale.", difficulty: "advanced", concepts: ["Time-series", "Aggregation", "Alerting"], availability: "coming-soon" },
  { slug: "distributed-logging", title: "Distributed Logging Platform", summary: "Collect, index, and search logs from thousands of services.", difficulty: "advanced", concepts: ["Ingestion", "Indexing", "Retention"], availability: "coming-soon" },
  { slug: "message-queue", title: "Message Queue", summary: "Build a durable, ordered, at-least-once broker with consumer groups.", difficulty: "advanced", concepts: ["Durability", "Ordering", "Delivery semantics"], availability: "coming-soon" },
  { slug: "collaborative-doc-editor", title: "Collaborative Document Editor", summary: "Enable real-time multi-user editing with OT or CRDT convergence.", difficulty: "advanced", concepts: ["CRDT/OT", "Real-time", "Conflict-free"], availability: "coming-soon" },
  { slug: "cloud-drive", title: "Cloud Drive", summary: "Provide durable, shareable file storage with versioning and permissions.", difficulty: "advanced", concepts: ["Object storage", "Versioning", "Sharing"], availability: "coming-soon" },
  { slug: "maps-navigation", title: "Maps and Navigation", summary: "Compute shortest paths and live ETAs over a continental road graph.", difficulty: "advanced", concepts: ["Graph routing", "Geo-indexing", "Traffic"], availability: "coming-soon" },
  { slug: "ad-serving", title: "Ad Serving Platform", summary: "Select and serve targeted ads under tight latency and budget constraints.", difficulty: "advanced", concepts: ["Targeting", "Budget pacing", "Low latency"], availability: "coming-soon" },
];

export function getProblem(slug: string): ProblemMeta | undefined {
  return problems.find((p) => p.slug === slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement `ProblemCard.tsx` and `CurriculumGrid.tsx`**

`ProblemCard`: shows number, title, summary, difficulty pill, concept tags. If `available`, the whole card is a `<Link href={/tutorials/${slug}}>` with a hover lift; if `coming-soon`, render a non-interactive card with a muted "Coming soon" badge and `aria-disabled`. `CurriculumGrid`: responsive grid (1/2/3 columns), grouped or labeled by difficulty; no generic glassy cards — use a calm bordered "index card" look with the graph-paper accent restrained.

- [ ] **Step 6: Build Home `src/app/page.tsx`** — hero explaining the three-depth learning model (Fundamentals / Interview-ready / Advanced), a primary CTA "Start: URL Shortener" linking to the tutorial, and a secondary link to the full curriculum. Below the hero, feature the available tutorial.

- [ ] **Step 7: Build `src/app/curriculum/page.tsx`** — heading + intro, then `<CurriculumGrid problems={problems} />`. Static page.

- [ ] **Step 8: Verify** `npm run typecheck && npm run lint && npm run build && npm test`. Expected: pass; build lists `/` and `/curriculum`.

- [ ] **Step 9: Commit** `git commit -am "feat: curriculum data model, home, and curriculum pages"`

---

### Task 5: MDX pipeline + tutorial route + TutorialLayout scaffolding

**Files:**
- Create: `src/lib/tutorials.ts`
- Create: `src/app/tutorials/[slug]/page.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/components/tutorial/TutorialLayout.tsx`, `TableOfContents.tsx`, `ReadingProgress.tsx`, `SectionNav.tsx`, `DepthBadge.tsx`
- Create: `src/components/mdx/MdxComponents.tsx` (initial: headings, prose, code, links only)
- Create: `content/tutorials/url-shortener.mdx` (temporary stub with frontmatter + 2 headings)

**Interfaces:**
- Consumes: `getProblem`, `problems` from `@/lib/curriculum`; `TutorialFrontmatter` from `@/lib/types`.
- Produces: `export function getTutorialSlugs(): string[]`, `export function loadTutorial(slug): { frontmatter: TutorialFrontmatter; content: string } | null`.
- Produces: `<TutorialLayout frontmatter slug>{mdx}</TutorialLayout>` rendering header (title, difficulty, reading time, concepts), a sticky desktop `TableOfContents`, top `ReadingProgress` bar, the article, and `SectionNav` (prev/next problem by curriculum order).
- Produces: `mdxComponents` object (default export) consumed by `MDXRemote`.

- [ ] **Step 1: Implement `src/lib/tutorials.ts`** — read `content/tutorials/${slug}.mdx` from disk with `fs`, parse with `gray-matter`, return frontmatter (typed) + raw content. `getTutorialSlugs` lists `.mdx` files. (Runs at build time in RSC — fine for static export.)

- [ ] **Step 2: Create the stub `content/tutorials/url-shortener.mdx`**

```mdx
---
title: URL Shortener
difficulty: introductory
readingMinutes: 35
summary: Map billions of long URLs to short, collision-free keys with sub-50ms redirects.
concepts: [Key generation, Caching, Read-heavy scaling]
---

## Interview Framing

Placeholder.

## Requirements

Placeholder.
```

- [ ] **Step 3: Implement `MdxComponents.tsx`** — map `h2`/`h3` (with anchor styling; ids added by `rehype-slug`), `p`, `ul`/`ol`/`li`, `a` (Next `Link` for internal), `pre`/`code`, `table` to themed elements. Default-export the map object.

- [ ] **Step 4: Implement `TableOfContents.tsx`** — client component that reads `h2[id]`/`h3[id]` from the rendered article (via a passed `headings` array extracted at build time, or `IntersectionObserver` for active state). Build-time extraction: in `tutorials.ts` add `extractHeadings(content): {id,text,level}[]` using a regex over markdown headings, and pass to the layout. Active-section highlight uses `IntersectionObserver`. Degrades to a plain anchor list without JS.

- [ ] **Step 5: Implement `ReadingProgress.tsx`** (client; scroll-linked top bar, `prefers-reduced-motion` aware) and `SectionNav.tsx` (prev/next within `problems` order, skipping `coming-soon` for links but still showing labels) and `DepthBadge.tsx` (small labeled pill: Fundamentals/Interview-ready/Advanced using `--accent`/`--advanced` tokens).

- [ ] **Step 6: Implement `TutorialLayout.tsx`** — composes header + `ReadingProgress` + a two-column grid (article + sticky `TableOfContents` on `lg+`, collapsible on mobile) + `SectionNav`.

- [ ] **Step 7: Implement `src/app/tutorials/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { loadTutorial, getTutorialSlugs, extractHeadings } from "@/lib/tutorials";
import mdxComponents from "@/components/mdx/MdxComponents";
import TutorialLayout from "@/components/tutorial/TutorialLayout";

export function generateStaticParams() {
  return getTutorialSlugs().map((slug) => ({ slug }));
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = loadTutorial(slug);
  if (!doc) notFound();
  const headings = extractHeadings(doc.content);
  return (
    <TutorialLayout frontmatter={doc.frontmatter} slug={slug} headings={headings}>
      <MDXRemote
        source={doc.content}
        components={mdxComponents}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]] } }}
      />
    </TutorialLayout>
  );
}
```

- [ ] **Step 8: Implement `src/app/not-found.tsx`** — friendly 404 linking back to curriculum.

- [ ] **Step 9: Verify** `npm run typecheck && npm run lint && npm run build`. Expected: `/tutorials/url-shortener` is statically generated; stub renders.

- [ ] **Step 10: Commit** `git commit -am "feat: MDX rendering pipeline and tutorial layout"`

---

### Task 6: Structured MDX content components

**Files:**
- Create: `src/components/mdx/RequirementsTable.tsx`, `CapacityEstimate.tsx`, `EntityTable.tsx`, `ApiSpec.tsx`, `DecisionRecord.tsx`, `TradeoffTable.tsx`, `Callout.tsx`, `FailureMatrix.tsx`, `KnowledgeCheck.tsx`, `Faq.tsx`, `Figure.tsx`
- Create: `src/lib/base62.ts`, `tests/base62.test.ts`
- Modify: `src/components/mdx/MdxComponents.tsx` (register all components)

**Interfaces (props each component exposes to MDX authors — keep stable):**
- `RequirementsTable({ functional: string[]; nonFunctional: {goal:string; target:string}[] })`
- `CapacityEstimate({ assumptions: {label:string; value:string}[]; results: {label:string; value:string; why:string}[] })`
- `EntityTable({ name:string; description?:string; fields: {name:string; type:string; notes?:string}[]; keys?:string })`
- `ApiSpec({ method:string; path:string; summary:string; request?:string; response?:string; statusCodes?:{code:string; meaning:string}[]; notes?:string })`
- `DecisionRecord({ title:string; choice:string; rationale:string; alternatives?:string; revisitWhen?:string })`
- `TradeoffTable({ columns:string[]; rows: (string)[][] })`
- `Callout({ variant?: "info"|"interview"|"warning"|"advanced"; title?:string; children })`
- `FailureMatrix({ rows: {failure:string; impact:string; detection:string; mitigation:string; recovery:string}[] })`
- `KnowledgeCheck({ question:string; options:string[]; answerIndex:number; explanation:string })` — client component; reveals correctness + explanation; degrades to readable Q&A.
- `Faq({ items: {q:string; a:string}[] })` — accessible `<details>`/`<summary>` disclosure.
- `Figure({ caption:string; children })` — wraps a diagram, renders caption, offers full-screen via `DiagramFrame` (added Task 7).

- [ ] **Step 1: Write failing test `tests/base62.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toBase62, fromBase62 } from "@/lib/base62";

describe("base62", () => {
  it("encodes 0 as '0'", () => { expect(toBase62(0)).toBe("0"); });
  it("round-trips arbitrary ids", () => {
    for (const n of [1, 61, 62, 12345, 9_007_199_254_740_99]) {
      expect(fromBase62(toBase62(n))).toBe(n);
    }
  });
  it("produces 7 chars for a ~3.5e12 id", () => {
    expect(toBase62(3_500_000_000_000).length).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/base62.ts`** — `toBase62(n:number):string` and `fromBase62(s:string):number` using alphabet `0-9A-Za-z`. Used to power the Key Generation worked example.

- [ ] **Step 4: Run test to verify it passes** — `npm test` → PASS.

- [ ] **Step 5: Implement the presentational components** listed above. All are server components except `KnowledgeCheck` (client, `"use client"`). Use theme tokens: decisions use `--decision`, risks/warnings use `--risk`, advanced callouts use `--advanced`, interview callouts use `--accent`. Tables scroll horizontally on mobile (`overflow-x-auto`). `Faq` uses native disclosure for keyboard accessibility.

- [ ] **Step 6: Register all components in `MdxComponents.tsx`** so MDX can use them by name (e.g. `<RequirementsTable .../>`).

- [ ] **Step 7: Verify** `npm run typecheck && npm run lint && npm run build && npm test`. Expected: pass.

- [ ] **Step 8: Commit** `git commit -am "feat: structured MDX content components + base62 util"`

---

### Task 7: SVG diagram system + URL Shortener diagrams

**Files:**
- Create: `src/components/diagrams/primitives.tsx`, `DiagramFrame.tsx`
- Create: `src/components/diagrams/url-shortener/ArchitectureDiagram.tsx`, `CreateFlow.tsx`, `RedirectCacheHitFlow.tsx`, `RedirectCacheMissFlow.tsx`, `AnalyticsFlow.tsx`, `ScalingStages.tsx`
- Modify: `src/components/mdx/MdxComponents.tsx` (register diagrams + `Figure`/`DiagramFrame`)

**Interfaces:**
- Produces `primitives.tsx`: `DIAGRAM` token object (colors keyed to CSS vars, font sizes, node radius), and components `Node({x,y,w,h,label,sublabel,kind})` where `kind ∈ "client"|"edge"|"service"|"store"|"cache"|"queue"|"external"`, `Lane({...})` for sequence actors, `Arrow({from,to,label,dashed?})` (dashed = async), `Legend({items})`.
- Produces `DiagramFrame({title, viewBox, children})`: responsive SVG wrapper with `role="img"`, `<title>`, `<desc>`, and a full-screen toggle button (client) that opens the SVG in an overlay; pan/zoom not required but the SVG must scale to container width and remain legible.
- Produces each diagram as a default-exported component taking no required props.

- [ ] **Step 1: Implement `primitives.tsx`** — consistent shapes per `kind` (e.g., stores as cylinders, queues as open-ended rectangles, services as rounded rects, client/edge distinct), consistent stroke widths, colors from tokens (so diagrams adapt to dark mode via `currentColor`/CSS vars), arrowhead marker defs, solid = synchronous, dashed = asynchronous. Include a reusable `Legend`.

- [ ] **Step 2: Implement `DiagramFrame.tsx`** — wraps children SVG content in a `<svg viewBox=...>` sized to container, adds title/desc for a11y, and a "View full screen" button (client) rendering an accessible modal overlay (Esc to close, focus trap minimal). Respect `prefers-reduced-motion`.

- [ ] **Step 3: Implement `ArchitectureDiagram.tsx`** — the precise high-level architecture from spec §7: DNS + edge/CDN, LB/API gateway, **distinct creation path and redirect path** (visually separated lanes/columns with different accent), write service, redirect service, distributed cache, durable mapping store, ID/token allocation, event stream, analytics consumers + analytical store, abuse detection, observability. Arrows labeled with protocol/data meaning; async paths dashed; a legend explains shapes, solid vs dashed, and trust boundary. This is the centerpiece — invest in clarity and correctness.

- [ ] **Step 4: Implement the four sequence diagrams** (`CreateFlow`, `RedirectCacheHitFlow`, `RedirectCacheMissFlow`, `AnalyticsFlow`) using `Lane` actors with numbered ordered messages, matching spec §8. Cache-miss flow shows store read + cache populate; analytics flow shows async event emission and consumer write (dashed).

- [ ] **Step 5: Implement `ScalingStages.tsx`** — the four evolution stages from spec §12 as a compact left-to-right progression, each labeled with its trigger and added cost.

- [ ] **Step 6: Register diagrams, `Figure`, and `DiagramFrame` in `MdxComponents.tsx`.**

- [ ] **Step 7: Verify** `npm run typecheck && npm run lint && npm run build`. Expected: pass.

- [ ] **Step 8: Visual check** — run `npm run dev`, open `/tutorials/url-shortener` (still stub), temporarily drop a diagram into the MDX to confirm it renders legibly in light and dark and at mobile width. Revert the temporary insertion.

- [ ] **Step 9: Commit** `git commit -am "feat: SVG diagram system and URL Shortener diagrams"`

---

### Task 8: Author the URL Shortener tutorial content

**Files:**
- Modify: `content/tutorials/url-shortener.mdx` (replace stub with full content)

**Interfaces:**
- Consumes: every component registered in `MdxComponents.tsx` (structured components + diagrams) and the curriculum frontmatter.

Author all 18 sections from spec §"URL Shortener Tutorial Scope", each opening with an `## ` heading (so it appears in the TOC) and using the appropriate components. Map sections → components:

- [ ] **Step 1: §1 Interview Framing** — prose + a `<Callout variant="interview">` with the questions to ask and a suggested time allocation; explicit in/out-of-scope list.
- [ ] **Step 2: §2 Requirements** — `<RequirementsTable functional={...} nonFunctional={...} />` covering create/redirect/custom alias/expiration/analytics and availability/latency/durability/consistency/abuse goals.
- [ ] **Step 3: §3 Capacity Estimates** — `<CapacityEstimate .../>` with transparent assumptions and results (read/write QPS, peak, stored links, storage growth, cache working set, redirect bandwidth), each result with a `why`.
- [ ] **Step 4: §4 Entity Model** — `<EntityTable />` for URL mapping, alias reservation, and click event; distinguish source-of-truth vs async analytics in prose.
- [ ] **Step 5: §5 API Design** — one `<ApiSpec />` per endpoint (create, resolve/redirect, get details, get analytics, disable/delete) with request/response, status codes, idempotency, validation, auth, rate-limit notes.
- [ ] **Step 6: §6 Key Generation** — `<TradeoffTable />` comparing hash-and-truncate / DB numeric id + Base62 / distributed id + Base62 / random token across collision handling, predictability, coordination cost, key-space utilization, security; a `<DecisionRecord />` with the recommended default; reference the Base62 worked example (lengths from `lib/base62`).
- [ ] **Step 7: §7 High-Level Architecture** — `<Figure caption="..."><ArchitectureDiagram /></Figure>` + textual walkthrough of each component and the two paths.
- [ ] **Step 8: §8 Detailed Flows** — four `<Figure>`-wrapped sequence diagrams with short narration each; plus prose for the disabled/expired link case.
- [ ] **Step 9: §9 Storage and Partitioning** — `<TradeoffTable />` (relational vs KV vs wide-column), a `<DecisionRecord />`, prose on PK/partition key/replication/rebalancing/hot partitions/secondary lookups/backup.
- [ ] **Step 10: §10 Caching** — prose + a `<Callout variant="warning">` on stampede/unavailability; cache-aside, TTLs, negative caching, invalidation, hot-key replication.
- [ ] **Step 11: §11 Consistency & Concurrency** — prose covering read-after-write, alias uniqueness, concurrent claims, stale cache, disable/delete propagation, analytics consistency; a `<KnowledgeCheck />` on alias uniqueness.
- [ ] **Step 12: §12 Scalability & Evolution** — `<Figure><ScalingStages /></Figure>` + prose stating each stage's trigger and operational cost.
- [ ] **Step 13: §13 Resiliency & Failure Modes** — `<FailureMatrix rows={...} />` covering cache loss, store degradation, regional failure, event-stream lag, analytics failure, ID-generator failure, replication lag, abusive traffic.
- [ ] **Step 14: §14 Security & Abuse** — prose + `<Callout variant="warning">`: malicious destinations, scanning, enumeration, unsafe redirects, rate limiting, quotas, alias squatting, deletion authz, privacy, retention.
- [ ] **Step 15: §15 Observability** — `<RequirementsTable>`-style or list of SLIs/signals (redirect latency, success rate, cache hit rate, creation error rate, store latency, replication lag, queue lag, abuse blocks, availability by region).
- [ ] **Step 16: §16 Trade-offs & Alternatives** — summary `<TradeoffTable />` + `<DecisionRecord />` callouts; each states what is gained/sacrificed and when to revisit.
- [ ] **Step 17: §17 Interview Summary** — concise end-to-end narrative in a `<Callout variant="interview">` + common follow-up questions.
- [ ] **Step 18: §18 Knowledge Checks & FAQ** — a couple more `<KnowledgeCheck />` and a final `<Faq items={...} />` addressing misconceptions; answers explain reasoning, not just name tech. Verify all numbers are consistent with §3 and §5.
- [ ] **Step 19: Verify** `npm run typecheck && npm run lint && npm run build`. Expected: pass; no MDX/runtime errors.
- [ ] **Step 20: Commit** `git commit -am "content: complete URL Shortener tutorial"`

---

### Task 9: Polish, accessibility, and final verification

**Files:**
- Modify: as needed across components (spacing, focus states, responsive tweaks)
- Create: `README.md` (run/deploy instructions)

- [ ] **Step 1: Run the full gate** — `npm run typecheck && npm run lint && npm run build && npm test`. All pass.
- [ ] **Step 2: Visual review at mobile (375px), tablet (768px), desktop (1280px)** via `npm run dev` for: home, curriculum, and the full URL Shortener tutorial. Confirm TOC, reading progress, section nav, diagrams (incl. full-screen), tables (horizontal scroll), knowledge checks, and FAQ all work.
- [ ] **Step 3: Theme + a11y pass** — toggle light/dark on every page; tab through interactive elements confirming visible focus; confirm `prefers-reduced-motion` disables transitions; confirm diagrams have accessible titles and adjacent text.
- [ ] **Step 4: Content consistency pass** — cross-check requirements ↔ estimates ↔ APIs ↔ architecture for contradictions or mismatched numbers; fix inline.
- [ ] **Step 5: Coming-soon integrity** — confirm no `coming-soon` card links to a tutorial route and that visiting an unknown slug renders `not-found`.
- [ ] **Step 6: Write `README.md`** — `npm install`, `npm run dev`, `npm run build`, and "Deploy to Vercel" (import repo, framework auto-detected as Next.js, no env vars).
- [ ] **Step 7: Commit** `git commit -am "polish: accessibility, responsive review, README, final verification"`

---

## Self-Review

**Spec coverage:** Home/curriculum/tutorial IA → Tasks 3–5. Three-depth model & DepthBadge → Tasks 5–6, used in content Task 8. All 18 tutorial sections → Task 8 steps 1–18 map 1:1 to spec sections. Diagram standards (vector SVG, legend, sync/async, trust boundary, a11y, full-screen) → Task 7. Visual direction (calm, tokens, light/dark, restrained grid) → Task 2. Component boundaries (shell/curriculum/tutorial/diagram/structured/knowledge-check/theme separated) → file structure. Error handling (not-found, degradable knowledge checks/diagrams) → Tasks 5–6. Testing/verification → Task 9. Out-of-scope items (accounts, payments, CMS, other 24 tutorials) → respected; only URL Shortener authored.

**Placeholder scan:** Content prose for Task 8 is specified by section + required component (the spec enumerates the substance); component code, data shapes, and diagrams are fully specified in Tasks 5–7. No "TBD"/"handle edge cases" left as instructions.

**Type consistency:** `ProblemMeta`, `TutorialFrontmatter`, `Difficulty`, `Depth` defined in Task 1 `types.ts`; `getProblem`/`problems` (Task 4), `loadTutorial`/`getTutorialSlugs`/`extractHeadings` (Task 5), `toBase62`/`fromBase62` (Task 6) referenced consistently where consumed. Component prop signatures fixed in Task 6/7 interface blocks match their MDX usage in Task 8.
