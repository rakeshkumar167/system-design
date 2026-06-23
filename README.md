# System Design Tutorials

A content-first web app for learning system design interviews the way a senior
architect would approach them — requirements, capacity math, APIs, data models,
precise architecture diagrams, trade-offs, and resiliency. Built with Next.js
and deployable to Vercel.

The first release ships a complete **URL Shortener** tutorial and the full
25-problem curriculum, with the remaining tutorials marked “coming soon.”

## Tech stack

- **Next.js 16** (App Router, React Server Components) + **TypeScript**
- **Tailwind CSS v4** with CSS-variable design tokens (light + dark)
- **MDX** tutorial content (`@next/mdx`) rendered through reusable teaching components
- Hand-authored **SVG** architecture and sequence diagrams (no raster images)
- **Vitest** unit tests + **Playwright** end-to-end tests

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

## Scripts

```bash
npm run dev          # start the dev server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest unit/component tests
npm run test:e2e     # playwright end-to-end tests (builds + serves on :3100)
```

The e2e suite needs the Playwright browser once: `npx playwright install chromium`.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it in Vercel — the framework is auto-detected as **Next.js**.
3. No environment variables are required. Deploy.

## Project structure

```
app/                     # routes: home, /curriculum, /learn/[slug]
components/
  shell/                 # header, footer, theme toggle
  curriculum/            # problem cards + searchable browser
  tutorial/              # tutorial layout, TOC, reading progress, section nav
  learning/              # MDX teaching components (callouts, tables, FAQ, …)
  diagrams/              # SVG primitives + URL Shortener diagrams
content/tutorials/       # MDX tutorial content
lib/                     # curriculum data, tutorial registry, capacity model
mdx-components.tsx       # maps component names available inside MDX
tests/                   # vitest unit/component tests
e2e/                     # playwright tests
```

## Adding a new tutorial

A new tutorial is mostly content, not code:

1. Flip the problem’s `status` to `"available"` in `lib/curriculum.ts`.
2. Add its metadata and 18 section ids to `lib/tutorial-registry.ts`.
3. Write `content/tutorials/<slug>.mdx`, using the registered teaching
   components and any new diagrams.
4. Register the MDX content component for the slug in `app/learn/[slug]/page.tsx`.

The shell, navigation, theme, and layout are shared, so no global code changes
are needed.
