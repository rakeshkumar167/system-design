# Content Delivery Network Tutorial Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Mirror the
> `ride-hailing` tutorial's files for structure and voice.

**Goal:** Author the **Content Delivery Network** tutorial at `/learn/content-delivery-network` (curriculum
seq 33, **Advanced**), reusing the tutorial pipeline.

## Global Constraints

- Slug `content-delivery-network`, difficulty **Advanced**, **18 sections** (ids in the spec outline).
- Section `id`s match across MDX `<h2 id>`, `tutorial-registry.ts` `sections`, and the content test
  `requiredIds`.
- New export names — **all verified unused**: `CdnCapacity`, `CdnArchitecture`,
  `EdgeRequestRoutingSequence`, `EdgeCacheLookupSequence`, `OriginShieldSequence`,
  `CacheInvalidationSequence`. (Existing `CdnDeliverySequence` / `CacheHitSequence` / `CacheMissSequence` /
  `ReadCache*` are distinct — do NOT reuse those.)
- `getByText` duplicate-match: any phrase a diagram test asserts must be **caption-only** (keep "coalescing"
  / "thundering herd" / "invalidate" out of node labels).
- E2e: direct fragment navigation; assert the diagram `img` and add `scrollIntoViewIfNeeded()` before
  `toBeInViewport()`; run `--workers=1`. **Decrement "coming soon" count (10 → 9)**. Leave "showing 1 of 33"
  untouched.
- **`tests/tutorial-registry.test.ts` "returns undefined" slug stays `food-delivery`** (still coming-soon,
  untouched — CDN registration doesn't affect it).
- **`tests/curriculum.test.ts`: append `"content-delivery-network"` at the END of the available list** (seq
  33, last entry).
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push/merge
  unless asked.

---

### Task 1: Capacity model — `CdnCapacity`

**Files:** create `lib/content-delivery-network-estimates.ts`, `tests/content-delivery-network-estimates.test.ts`,
`components/learning/content-delivery-network-capacity.tsx`; modify `mdx-components.tsx`.

**`lib/content-delivery-network-estimates.ts`** (copy-paste):
```ts
const SECONDS_PER_DAY = 86_400;

export interface CdnCapacityAssumptions {
  /** Total requests hitting the CDN edge per day. */
  dailyRequests: number;
  /** Cache-hit ratio as an integer percent (e.g. 95 = 95%). */
  cacheHitPercent: number;
  /** A higher hit ratio to contrast, integer percent (e.g. 99). */
  improvedHitPercent: number;
  /** Average object size in bytes. */
  avgObjectBytes: number;
}

export interface CdnCapacityResults {
  edgeRequestsPerSec: number;
  originRequestsPerSec: number;
  offloadFactor: number;
  originRequestsAtImprovedHitRatio: number;
  originReductionFactor: number;
  edgeEgressGbPerSec: number;
  originEgressGbPerSec: number;
}

/**
 * Pure, deterministic capacity model. The lesson: a CDN's whole point is origin offload, and the
 * cache-hit ratio is the master lever — non-linearly. At 20M edge requests/sec and a 95% hit ratio the
 * origin sees only 1M requests/sec (a 20x reduction) and supplies 100 GB/s instead of the 2000 GB/s the
 * edge serves. Raising the hit ratio 95% -> 99% cuts origin load another 5x (1M -> 200k), because origin
 * traffic scales with the miss ratio (5% -> 1% is a fifth). Every fraction of a percent of hits is worth
 * far more at the origin than it looks, which is why the design obsesses over cache-key hygiene, long
 * TTLs, immutable URLs, and an origin shield.
 */
export function calculateCdnCapacity(a: CdnCapacityAssumptions): CdnCapacityResults {
  const edgeRequestsPerSec = a.dailyRequests / SECONDS_PER_DAY;
  const missPercent = 100 - a.cacheHitPercent;
  const improvedMissPercent = 100 - a.improvedHitPercent;
  const originRequestsPerSec = (edgeRequestsPerSec * missPercent) / 100;
  const offloadFactor = 100 / missPercent;
  const originRequestsAtImprovedHitRatio = (edgeRequestsPerSec * improvedMissPercent) / 100;
  const originReductionFactor = originRequestsPerSec / originRequestsAtImprovedHitRatio;
  const edgeEgressGbPerSec = (edgeRequestsPerSec * a.avgObjectBytes) / 1_000_000_000;
  const originEgressGbPerSec = (originRequestsPerSec * a.avgObjectBytes) / 1_000_000_000;

  return {
    edgeRequestsPerSec,
    originRequestsPerSec,
    offloadFactor,
    originRequestsAtImprovedHitRatio,
    originReductionFactor,
    edgeEgressGbPerSec,
    originEgressGbPerSec,
  };
}
```

**`tests/content-delivery-network-estimates.test.ts`**: with `{ dailyRequests: 1_728_000_000_000,
cacheHitPercent: 95, improvedHitPercent: 99, avgObjectBytes: 100_000 }` assert (all exact integers, no
`toBeCloseTo` needed): `edgeRequestsPerSec` 20_000_000, `originRequestsPerSec` 1_000_000, `offloadFactor`
20, `originRequestsAtImprovedHitRatio` 200_000, `originReductionFactor` 5, `edgeEgressGbPerSec` 2000,
`originEgressGbPerSec` 100.

**`components/learning/content-delivery-network-capacity.tsx`** — mirror `ride-hailing-capacity.tsx`; export
`CdnCapacity`. Assumption rows: Daily requests, Cache-hit ratio (`${cacheHitPercent}%`), Improved hit ratio
(`${improvedHitPercent}%`), Avg object size (`${avgObjectBytes} B`). Result rows (6, fold reduction factor
into a consequence sentence):
- Edge requests / sec — `20,000,000 /s` — "The full firehose the edge fleet absorbs."
- Origin requests / sec — `1,000,000 /s` — "At a 95% hit ratio only the 5% of misses reach the origin."
- Origin offload — `20×` — "A 95% hit ratio means the origin sees 1/20th of the traffic — the whole point of a CDN."
- Origin req/s at 99% hit — `200,000 /s` — "Raising the hit ratio 95%→99% cuts origin load another 5×: origin traffic scales with the *miss* ratio, so the last few percent matter most."
- Edge egress — `2000 GB/s` — "Bandwidth served from the edge, close to users."
- Origin egress — `100 GB/s` — "Bandwidth the origin must supply — 20× less than the edge serves."

Register `CdnCapacity` in `mdx-components.tsx` (import + spread into the components map, mirroring
`RideHailingCapacity`).

- [ ] `npm test -- content-delivery-network-estimates` + `npm run typecheck` green. Commit
  `feat: add Content Delivery Network capacity model and wrapper`.

### Task 2: Diagrams (architecture + flows)

**Files:** create `components/diagrams/content-delivery-network-architecture.tsx` +
`content-delivery-network-flows.tsx`; modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

- [ ] `CdnArchitecture` HLD — mirror `ride-hailing-architecture.tsx`. A left-to-right delivery pipeline:
  **User → Request Routing (Anycast/GeoDNS, `infra`) → Edge PoP (`cache`) → Origin Shield (`cache`,
  mid-tier) → Origin (`store`)**, with a **Control Plane (`service`)** below pushing **config + purge** up
  to the Edge PoP. Edges: User→Routing `ingress` "request"; Routing→Edge `redirect` "nearest healthy PoP";
  Edge→Shield `control` "on miss"; Shield→Origin `control` "coalesced fetch"; Origin→Shield `create`
  "fill"; Shield→Edge `redirect` "serve"; Control Plane→Edge `async` "config / purge". Legend for the
  variants used. Caption (asserted keyword **caption-only**): explain routing to the nearest edge, the
  hit-serves-locally / miss-goes-to-shield-then-origin path, and that the hit ratio offloads the origin.
- [ ] Four flow sequences (copy the `Sequence`/`StepLabel`/`actorColor` helpers verbatim from
  `ride-hailing-flows.tsx`):
  - `EdgeRequestRoutingSequence` — actors: `User` (external), `Routing` "Anycast / GeoDNS" (infra),
    `Edge` "Edge PoP" (cache). Steps: User→Routing "request content" `ingress`; Routing→Routing "pick
    nearest healthy PoP" `control`; Routing→Edge "route to edge" `redirect`; Edge→User "connection
    established" `redirect` reply. Caption keyword-only: "Anycast … or GeoDNS steers each user to the
    nearest healthy edge, routing around a failed PoP."
  - `EdgeCacheLookupSequence` — actors: `Client` (external), `Edge` "Edge Cache" (cache), `Origin`
    (store). Steps: Client→Edge "GET object" `ingress`; Edge→Edge "cache key lookup" `control`; Edge→Origin
    "miss → fetch origin" `control`; Origin→Edge "object (200)" `create` reply; Edge→Edge "store with TTL"
    `create`; Edge→Client "serve (hit next time)" `redirect` reply. Caption keyword-only: on a hit the edge
    serves without contacting the origin; the hit ratio is what offloads the origin.
  - `OriginShieldSequence` — actors: `Edge A` (cache), `Edge B` (cache), `Shield` "Origin Shield"
    (cache), `Origin` (store). Steps: EdgeA→Shield "miss" `control`; EdgeB→Shield "miss (same key)"
    `control`; Shield→Origin "single fetch" `control`; Origin→Shield "object" `create` reply; Shield→EdgeA
    "fill" `redirect` reply; Shield→EdgeB "fill" `redirect` reply. Caption keyword-only: "request coalescing
    at an origin shield collapses a thundering herd of concurrent misses into one origin fetch." (Keep
    "coalescing"/"thundering herd" out of labels.)
  - `CacheInvalidationSequence` — actors: `Publisher` (external), `Control` "Control Plane" (service),
    `Edge` "Edge PoP" (cache). Steps: Publisher→Control "content changed → purge" `control`;
    Control→Edge "propagate purge" `async`; Edge→Edge "evict stale entry" `control`; Edge→Control "purged"
    `redirect` reply. Caption keyword-only: "a purge propagates from the control plane to every edge to
    invalidate stale content; versioned immutable URLs avoid invalidation entirely."
- [ ] Append render assertions to `tests/diagrams.test.tsx` (architecture + 4 flows) — mirror the
  ride-hailing block; assert each `getByRole("img")` name and one caption keyword via `getByText(/…/)`
  (choose a caption-only phrase per diagram).
- [ ] Register all 5 exports in `mdx-components.tsx`.
- [ ] `npm test -- diagrams` + `npm run typecheck` green. Commit
  `feat: add Content Delivery Network architecture and flow diagrams`.

### Task 3: Registry / route / skeleton

**Files:** modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `app/learn/[slug]/page.tsx`,
`tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`; create
`content/tutorials/content-delivery-network.mdx` (skeleton).

- [ ] `tutorial-registry.ts`: add a `"content-delivery-network"` `TutorialMeta` (title "Design a Content
  Delivery Network", difficulty "Advanced", readingMinutes ~33, concepts `["Edge caching", "Cache
  invalidation", "Origin shield", "Geo-routing"]`, description one-liner, **18 sections** exactly per the
  spec outline ids/labels/depths).
- [ ] `curriculum.ts`: flip `content-delivery-network` `status` → `available`.
- [ ] `app/learn/[slug]/page.tsx`: `import ContentDeliveryNetworkContent from
  "@/content/tutorials/content-delivery-network.mdx";` and add `"content-delivery-network":
  ContentDeliveryNetworkContent,` to the map.
- [ ] `content/tutorials/content-delivery-network.mdx`: skeleton — the 18 `<h2 id="…">` headings in order
  with one placeholder line each.
- [ ] `tests/tutorial-registry.test.ts`: add
  `expect(getTutorial("content-delivery-network")?.sections).toHaveLength(18);` next to the other length
  assertions. **Do NOT change the `returns undefined` slug — it stays `food-delivery`.**
- [ ] `tests/curriculum.test.ts`: **append `"content-delivery-network"` at the end** of the available-slugs
  `toEqual([...])` array.
- [ ] `npm test -- tutorial-registry curriculum` + `npm run typecheck` + `npm run build` green. Commit
  `feat: register Content Delivery Network tutorial route and skeleton`.

### Task 4 + 5: Content (Opus orchestrator)

**Files:** rewrite `content/tutorials/content-delivery-network.mdx` (18 sections); create
`tests/content-delivery-network-content.test.ts`.

- [ ] Author all 18 sections per spec — match `ride-hailing.mdx` voice/density; cross-ref
  [Pastebin](/learn/pastebin) & [Photo Sharing](/learn/photo-sharing) (immutable URLs), [Video
  Streaming](/learn/video-streaming) & [Maps & Navigation](/learn/maps-navigation) (CDN-served delivery,
  hit ratio), [Distributed Cache](/learn/distributed-cache) (eviction/hot-key/stampede), [Rate
  Limiter](/learn/rate-limiter) (edge rate limiting). Embed `<CdnCapacity assumptions={{…}} />` (exact =
  test), `<CdnArchitecture />` (sec 6), the four flows (routing + cache-lookup in sec 7; routing also in
  sec 8; `<OriginShieldSequence />` in sec 10; `<CacheInvalidationSequence />` in sec 11), `RequirementsTable`
  (2), `EntityModel` (4), three `ApiContract` (5), `TradeoffTable` (14), `FailureMatrix` (15),
  `DecisionRecord` (16), two `Callout variant="interview"` (1 + 17), ≥6 `<KnowledgeCheck>`, `<Faq>` ≥12.
- [ ] `tests/content-delivery-network-content.test.ts` (mirror ride-hailing): 18 ids; embeds present
  (`<CdnCapacity`, `<CdnArchitecture`, `<EdgeRequestRoutingSequence`, `<EdgeCacheLookupSequence`,
  `<OriginShieldSequence`, `<CacheInvalidationSequence`); assumptions match (`dailyRequests: 1728000000000`,
  `cacheHitPercent: 95`, `improvedHitPercent: 99`, `avgObjectBytes: 100000`); ≥6 KnowledgeCheck; ≥12
  `question:`.
- [ ] **Run the content test right after writing the MDX** (Ride-Hailing gotcha: a Write silently dropped
  sections — the content test catches missing ids/embeds). Then `npm test`, `npm run lint`, `npm run
  typecheck`, `npm run build` green (confirm `/learn/content-delivery-network` generates). Commit
  `content: complete Content Delivery Network tutorial`.

### Task 6: E2e + final verification

**Files:** modify `e2e/pilot.spec.ts`.

- [ ] Add a `/learn/content-delivery-network` test: open, assert the `h1`, navigate to
  `#high-level-architecture`, assert the architecture diagram `img`, `scrollIntoViewIfNeeded()`, then
  in-viewport. **Decrement coming-soon 10 → 9.** Leave "showing 1 of 33".
- [ ] Full suite: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run test:e2e -- --workers=1`, `git diff --check`. Commit
  `test: verify Content Delivery Network tutorial flow end-to-end`.

## Self-Review
- Every spec section maps to a task. ✅
- Capacity numbers fixed in spec + Task 1 (all integer, deterministic). ✅
- Export-clash check done (6 names clean) + coming-soon decrement (10→9) + `returns undefined` stays
  `food-delivery` + curriculum append-at-end noted. ✅
