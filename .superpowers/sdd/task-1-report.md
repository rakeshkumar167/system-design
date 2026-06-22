# Task 1 Report: Scaffold the Tested Next.js Application Shell

## Implementation summary

Implemented the Task 1 foundation for the tutorial app:

- scaffolded a Next.js 16 / React 19 / TypeScript / Tailwind v4 / Vitest project shell
- added MDX-ready Next config, PostCSS, ESLint, Vitest, and TypeScript alias setup
- created the root application layout, homepage shell, header, footer, theme toggle, and favicon
- added global light/dark design tokens, reduced-motion handling, and the graph-paper background treatment
- wrote and passed the required `tests/site-shell.test.tsx` test

## Files changed

- `.gitignore`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `components/shell/site-footer.tsx`
- `components/shell/site-header.tsx`
- `components/shell/theme-toggle.tsx`
- `eslint.config.mjs`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `public/favicon.svg`
- `tests/site-shell.test.tsx`
- `tsconfig.json`
- `vitest.config.ts`
- `vitest.setup.ts`
- `.superpowers/sdd/task-1-report.md`

## RED/GREEN TDD evidence

### RED

Command:

```bash
npm test -- tests/site-shell.test.tsx
```

Relevant output:

```text
FAIL  tests/site-shell.test.tsx [ tests/site-shell.test.tsx ]
Error: Failed to resolve import "@/app/page" from "tests/site-shell.test.tsx". Does the file exist?
```

This was the expected failure before the shell implementation existed.

### GREEN

Command:

```bash
npm test -- tests/site-shell.test.tsx
```

Relevant output:

```text
Test Files  1 passed (1)
     Tests  1 passed (1)
```

### Focused typecheck

Command:

```bash
npm run typecheck
```

Relevant final output:

```text
> system-design-tutorials@0.1.0 typecheck
> tsc --noEmit
```

During setup, TypeScript 6 surfaced two configuration issues:

- `baseUrl` required `ignoreDeprecations: "6.0"`
- test globals required `vitest/globals` in `tsconfig.json`

Both were fixed before the final passing typecheck run.

## Full-suite evidence

Commands run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Relevant output:

```text
npm test
Test Files  1 passed (1)
     Tests  1 passed (1)

npm run lint
> system-design-tutorials@0.1.0 lint
> eslint .

npm run typecheck
> system-design-tutorials@0.1.0 typecheck
> tsc --noEmit

npm run build
✓ Compiled successfully
✓ Generating static pages using 4 workers (3/3)
○  (Static)  prerendered as static content
```

Note: an earlier parallel `next build` attempt hit Next’s “Another next build process is already running” guard; a clean serial rerun passed. The application code did not require changes for that.

## Self-review

- The homepage remains content-first and restrained while satisfying the exact pilot CTA requirement.
- The root shell includes the required skip link, header, main landmark, and footer.
- Theme tokens exist for canvas, surface, ink, muted ink, border, accent, fundamentals, interview, advanced, success, warning, and danger in both light and dark themes.
- Motion is reduced under `prefers-reduced-motion`.
- The setup is ready for later MDX and App Router tasks without adding runtime backend assumptions.

## Concerns

- Unrelated untracked Task 2 artifacts already present in the working tree were left untouched: `lib/` and `tests/curriculum.test.ts`.
