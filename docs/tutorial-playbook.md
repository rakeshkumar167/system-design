# Tutorial Build Playbook

The repeatable process for authoring one curriculum tutorial end to end. Five
tutorials were built this way (URL Shortener, Rate Limiter, Pastebin, Notification
Service, Ticket Booking System). **Follow this exactly** when asked to build the next
one — a one-liner like "build the next tutorial" should trigger this whole pipeline.

## Trigger & defaults (no questions unless ambiguous)

- **Which problem:** the user may name one; otherwise pick the next `coming-soon` by
  `sequence` in `lib/curriculum.ts`. (The user jumps around — e.g. they did seq 16
  before seq 5 — so a named problem always wins.)
- **Model policy:** the **Opus orchestrator** writes the spec, the plan, and the full
  MDX content. **Sonnet subagents** do the mechanical tasks (capacity module, diagrams,
  registry/route/skeleton, e2e). Do not author content with Sonnet.
- **Don't ask questions; go with recommendations.**
- **Branch:** `tutorial-<slug>` off the current tip (cumulative — each builds on the
  last). Commit each task; **do not push or merge** unless the user asks.

## Step 0 — Orient (read before writing)

Read, for voice/altitude and exact conventions:
- the most recent `content/tutorials/*.mdx` (match its voice, depth, density),
- its spec in `docs/superpowers/specs/` and plan in `docs/superpowers/plans/`,
- `mdx-components.tsx` (registered components), `lib/<prev>-estimates.ts`,
  `components/learning/<prev>-capacity.tsx`, `components/diagrams/*-architecture.tsx`
  and `*-flows.tsx` (the diagram you'll mirror), `components/diagrams/diagram-primitives.tsx`.

## Step 1 — Spec (Opus)

Write `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-tutorial-design.md` mirroring the prior
spec's structure: goal, framing/scope (in & out), the **18-section outline table**
(id / label / depth), per-section content notes, components (reused + new), the exact
**capacity model** (assumptions + deterministic results with the numbers worked out),
numerical/terminology invariants, out-of-scope.

## Step 2 — Plan (Opus)

Write `docs/superpowers/plans/<YYYY-MM-DD>-<slug>-tutorial.md` as a **6-task** plan with
copy-pasteable code (mirror the prior plan). Tasks:
1. **Capacity** — `lib/<slug>-estimates.ts` (pure fn) + `tests/<slug>-estimates.test.ts`
   (deterministic) + `components/learning/<slug>-capacity.tsx` (wraps `CapacityTable`) +
   register in `mdx-components.tsx`.
2. **Diagrams** — `components/diagrams/<slug>-architecture.tsx` (one HLD) +
   `components/diagrams/<slug>-flows.tsx` (four sequences) + assertions appended to
   `tests/diagrams.test.tsx` + register in `mdx-components.tsx`.
3. **Registry/route/skeleton** — `lib/tutorial-registry.ts` entry (18 sections),
   `lib/curriculum.ts` flip to `available`, `app/learn/[slug]/page.tsx` import+map,
   `content/tutorials/<slug>.mdx` skeleton (18 `<h2 id>` headings + placeholder lines),
   update `tests/tutorial-registry.test.ts` and `tests/curriculum.test.ts`.
4. **Content sec 1–9** (Opus) and **5. Content sec 10–18 + `tests/<slug>-content.test.ts`**
   (Opus).
6. **E2e + final verification** — extend `e2e/pilot.spec.ts`, decrement the "Coming
   soon" count by one, full verification suite.

Commit: `docs: design spec and plan for <name> tutorial`.

## Step 3 — Execute (orchestration that maximizes parallelism)

1. Commit spec+plan.
2. **Dispatch Task 1 (capacity, Sonnet) and Task 3 (registry/skeleton, Sonnet) in
   parallel** — disjoint files. (Task 3 also runs `npm run build`; fine.)
3. **While they run, the orchestrator (Opus) authors the full 18-section MDX** to the
   scratchpad. This is the long pole; do it in parallel with the agents.
4. When **Task 1** is done, **dispatch Task 2 (diagrams, Sonnet)** — it shares
   `mdx-components.tsx` with Task 1, so it must run *after* Task 1, not alongside.
5. When **Task 3** is done, the skeleton file exists: `cp` the authored MDX over it,
   write `tests/<slug>-content.test.ts`, run that test (should pass).
6. When **Task 2** is done (all components registered): `npm run build` (compiles the
   MDX with real embeds and generates `/learn/<slug>`), then `npm test` + `npm run
   typecheck` + `npm run lint`. Commit `content: complete <name> tutorial`.
7. **Dispatch Task 6 (e2e + final verify, Sonnet).**
8. When it's done, independently re-confirm (`npm test`, build artifact exists,
   e2e covers the slug) before declaring done. Update the `curriculum-progress` memory.

Subagents commit their own task. Each Sonnet task prompt: point it at the plan, name the
exact task, list files it owns, list files NOT to touch (avoid `mdx-components.tsx` /
`tests/diagrams.test.tsx` collisions), and require typecheck+lint+commit.

## Content requirements (the MDX)

- Exactly **18 `<h2 id="...">` sections**; ids match the registry `sections` and the
  content test's `requiredIds`.
- Standard spine: `interview-framing`, `requirements`, `capacity-estimates`,
  `entity-model`, `api-design`, `high-level-architecture`, `detailed-flows`, then
  **3–6 problem-specific deep dives** (the differentiators), then
  `scalability-evolution`, `resiliency-failure-modes`, optionally `security-abuse` and/or
  `observability`, `tradeoffs-alternatives`, `interview-summary`, `knowledge-checks-faq`.
- **≥ 6 `<KnowledgeCheck>`** (distribute some into deep-dive sections) and one
  `<Faq items={[…]} />` with **≥ 12** entries.
- Embed every new component: `<{Slug}Capacity>`, `<{Slug}Architecture>`, the four flow
  sequences. The capacity `assumptions={{…}}` must **exactly match** the estimates test.
- Use the existing components: `Callout` (variant `interview`|`info`|`warning`),
  `RequirementsTable`, `EntityModel`, `ApiContract`, `TradeoffTable`, `DecisionRecord`,
  `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (via the wrapper).
- Include a `Callout variant="interview"` with a 45-min allocation (framing) and a
  60-second spoken answer (summary). Cross-reference related tutorials by name.
- Differentiate from prior tutorials: lead the framing with the reframe ("looks like X,
  but the hard part is Y").

## Capacity module convention

`lib/<slug>-estimates.ts` is a pure, deterministic function with typed
`...Assumptions` / `...Results`; decimal storage units; a `SECONDS_PER_*` constant when
rate-based. Pick assumption numbers that yield clean, test-assertable results that *teach*
the dominant constraint. The wrapper formats rows for `CapacityTable` with a `consequence`
sentence each.

## Diagram convention

Build only from `diagram-primitives.tsx` vocabulary (`Node`, `Edge`, `anchors`, `Legend`,
`DiagramText`, `DiagramDefs`, `DiagramFrame`). Edge variants: `create` (accent / write),
`redirect` (green / read·success), `async` (violet dashed / queue·event), `control`
(amber dashed / failure·retry·reject·expiry), `muted` (telemetry), `ingress` (plain).
Node kinds: `service`, `store`, `cache`, `queue`, `external`, `infra`. Mirror the most
recent `*-architecture.tsx` and `*-flows.tsx` (copy the `Sequence`/`StepLabel` helpers).
Every diagram: `DiagramFrame` `title` (becomes the `role="img"` accessible name) + a
meaningful `caption` that conveys the meaning without the visual.

## Known gotchas (these have bitten us)

- **`getByText` duplicate match:** a phrase a diagram test asserts via
  `screen.getByText(/…/)` must appear in the **caption only**, never also as a node label
  (two matches → test fails). Put the asserted keyword in the caption; give nodes distinct
  labels (e.g. node `"DLQ"`, caption says "dead-letter queue").
- **E2e TOC links:** the sidebar TOC renders a number prefix (`"09 Label"`) and is
  `hidden lg:block` (absent on mobile). Don't click TOC links in e2e — use **direct
  fragment navigation** `page.goto("/learn/<slug>#<anchor>")` then assert the heading and
  the architecture `img`.
- **`mdx-components.tsx` collisions:** Tasks 1 and 2 both edit it → serialize them.
- **"Coming soon" count:** Task 6 decrements the curriculum count assertion in
  `e2e/pilot.spec.ts` by exactly one (verify the current value first).

## Verification gates (must be green)

Before the content commit and at the very end:
`npm test` · `npm run typecheck` · `npm run lint` · `npm run build` (confirm
`/learn/<slug>` generates) · `npm run test:e2e` (desktop+mobile, all pass) ·
`git diff --check`.

## Commit sequence (one per task)

1. `docs: design spec and plan for <name> tutorial`
2. `feat: add <name> capacity model and wrapper`
3. `feat: add <name> architecture and flow diagrams`
4. `feat: register <name> tutorial route and skeleton`
5. `content: complete <name> tutorial`
6. `test: verify <name> tutorial flow end-to-end`

End commit bodies with the `Co-Authored-By` trailer. After completion, report the commit
table and the green verification summary, and remind the user the branch is unmerged.
