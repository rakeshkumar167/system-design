# Ride-Hailing Service Tutorial — Design Spec

**Date:** 2026-07-20
**Status:** Approved for planning
**Problem:** `ride-hailing` (curriculum sequence 14, difficulty **Advanced**)

## Goal

Author the **Ride-Hailing Service** tutorial (`/learn/ride-hailing`) — an Uber/Lyft-class system. The
reframe: it *looks* like "find a nearby driver and connect them," but the hard part is **matching riders
to drivers in real time over a constantly-moving dataset**: a **geospatial index** to find nearby drivers
without scanning, a **location-update firehose** (millions of drivers pinging GPS every few seconds), a
**matching/dispatch** step that assigns the best driver without double-booking, and a **trip state
machine** that drives each ride through its lifecycle with failures at every step. Geospatial querying
overlaps the future [Proximity Service](/learn/proximity-service), but ride-hailing adds real-time
location ingestion, matching under contention, and stateful trips.

Concepts (from curriculum): **Geospatial indexing, Matching, Real-time updates, State machines**.

## Section Outline (18 sections)

Standard spine + 6 deep dives (8–13). `id`s must match the MDX `<h2 id>` and registry.

| # | id | Label | Depth |
|---|----|-------|-------|
| 1 | `interview-framing` | Interview Framing | fundamentals |
| 2 | `requirements` | Requirements | interview-ready |
| 3 | `capacity-estimates` | Capacity Estimates | interview-ready |
| 4 | `entity-model` | Entity Model | interview-ready |
| 5 | `api-design` | API Design | interview-ready |
| 6 | `high-level-architecture` | High-Level Architecture | interview-ready |
| 7 | `detailed-flows` | Detailed Flows | interview-ready |
| 8 | `geospatial-index` | Geospatial Indexing | advanced |
| 9 | `location-updates` | The Location-Update Firehose | advanced |
| 10 | `matching-dispatch` | Matching & Dispatch | advanced |
| 11 | `trip-state-machine` | The Trip State Machine | advanced |
| 12 | `real-time-tracking` | Real-Time Tracking & ETA | advanced |
| 13 | `supply-demand-surge` | Supply, Demand & Surge | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: connecting a rider and driver is easy; the design is real-time matching over a
   moving dataset — a geospatial index fed by a location firehose, matching without double-booking, and a
   trip state machine. `Callout variant="interview"` 45-min plan.
2. **Requirements** — functional: drivers share location, riders request rides, match rider↔driver, track
   the trip live, manage trip lifecycle, fare/payment (ref Payment). Non-func: **low-latency matching**,
   **absorb a massive location-write stream**, **no double-booking** (a driver matched once), real-time
   tracking, geo-scale. `RequirementsTable`.
3. **Capacity** — `RideHailingCapacity`. Lesson: dominated by the **location-update firehose** — 5M
   drivers × ping/4s = **1.25M writes/s (~125 MB/s)**, ~**2160×** the ride-request rate (~579/s), so
   driver location is **in-memory & ephemeral**; matching (geo query + rank ~10 candidates ≈ 5.8k
   evals/s) is comparatively cheap.
4. **Entity Model** — `Trip` (state machine) + `Driver` (location, status) + `Rider`; driver location is
   ephemeral live state in a geo-index, trips are durable stateful records. `EntityModel`.
5. **API Design** — `POST /rides` (request a ride), `GET /rides/{id}` (status + live location), `POST
   /drivers/location` (GPS ping). Three `ApiContract`s.
6. **High-Level Architecture** — `RideHailingArchitecture` HLD: driver → location ingest → in-memory geo
   index; rider → API → matching (queries geo index) → trip service (state machine) → dispatch + live
   track.
7. **Detailed Flows** — four sequences (below).
8. **Geospatial Indexing** — you can't `WHERE distance(...) < r` scan millions of moving drivers. Index
   by **space-filling cells**: **geohash**, **quadtree**, **Google S2**, or **Uber H3** (hex grid) — map
   each driver to a cell, and a "nearby" query reads the rider's cell + neighbors. Trades exactness for
   an O(nearby-cells) lookup. `KnowledgeCheck`.
9. **The Location-Update Firehose** — millions of drivers ping GPS every few seconds — a huge **write**
   stream. Keep only the **latest position per driver** in an **in-memory** geo-store (Redis GEO / an
   in-memory H3 index), **overwriting** not appending — you don't durably persist every ping (that'd be a
   pointless firehose to disk); ephemeral live state. `KnowledgeCheck`.
10. **Matching & Dispatch** — on a request: query the geo index for **nearby available drivers**, **rank**
    (by ETA/road-distance not straight-line, rating, driver acceptance), **offer** to the best, handle
    **accept/decline/timeout**, and — critically — use an **atomic reservation / lock** so one driver is
    never matched to two riders (a contention problem like [Ticket Booking](/learn/ticket-booking)).
    `KnowledgeCheck`. Embed `<MatchRideSequence />`.
11. **The Trip State Machine** — every trip is an explicit **state machine**: `requested → matched →
    driver_en_route → arrived → in_progress → completed` (plus `cancelled`, `no_show`), with only valid
    transitions allowed and each transition an event; handles rider/driver cancellation, timeouts, and
    payment on completion (ref Payment System). `KnowledgeCheck`. Embed `<TripStateSequence />`.
12. **Real-Time Tracking & ETA** — the rider watches the driver approach: the driver's location stream is
    **pushed** to the rider (WebSockets / long-lived connection, the [Chat System](/learn/chat-system)
    delivery pattern), with **ETA** recomputed from road routing (ref [Maps & Navigation](/learn/maps-navigation)).
    `KnowledgeCheck` may live here.
13. **Supply, Demand & Surge** — matching efficiency depends on **supply/demand balance** per area; **hot
    zones** (events, rush hour) create shortages, and **surge pricing** is the balancing mechanism (raise
    price to curb demand and attract supply). `Callout`. Also dispatch optimization (batching, pooling).
14. **Scalability & Evolution** — staged `TradeoffTable` (single region DB scan → in-memory geo-index +
    matching service → geo-sharded by region → global multi-region with per-city isolation).
15. **Resiliency & Failure Modes** — `FailureMatrix` (location-ingest overload, geo-index node loss,
    driver goes offline mid-trip, double-match race, matching timeout / no drivers, trip-service crash,
    stale locations).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (geo-index type; ephemeral vs durable
    locations; straight-line vs road-distance ranking; push vs poll tracking).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `LocationUpdateSequence` — driver → location service → geo index: a GPS ping arrives, the service maps
  it to a cell and upserts the driver's latest position in the in-memory index. Caption: only the latest
  position is kept, not a durable history of every ping.
- `MatchRideSequence` — rider → API → matching → geo index → trip: a request queries nearby available
  drivers, ranks them, atomically reserves the best one, and creates a trip. Caption: an atomic
  reservation ensures one driver is never matched to two riders.
- `TripStateSequence` — trip service state transitions: matched → en route → arrived → in progress →
  completed, with a cancellation branch. Caption: every trip is an explicit state machine that rejects
  invalid transitions.
- `LiveTrackingSequence` — driver location → push → rider: the rider subscribes to the assigned driver's
  location stream and receives live position + ETA updates over a pushed connection. Caption: the rider
  subscribes to the assigned driver's live location stream, so the map updates in real time.

## Capacity Model (exact)

`lib/ride-hailing-estimates.ts`, pure & deterministic. `SECONDS_PER_DAY = 86_400`.

Assumptions (MDX embed and test):
```ts
{
  activeDrivers: 5_000_000,
  pingIntervalSec: 4,
  locationBytes: 100,
  ridesPerDay: 50_000_000,
  candidatesPerMatch: 10,
}
```

Results:
- `locationUpdatesPerSec` = 5,000,000 / 4 = **1,250,000**
- `locationWriteMbPerSec` = 1,250,000 × 100 / 1e6 = **125**
- `ridesPerSec` = 50,000,000 / 86,400 ≈ **578.70**
- `writeToRequestRatio` = 1,250,000 / 578.70 = **2160**
- `candidateEvaluationsPerSec` = 578.70 × 10 ≈ **5787.04**

Lesson: ride-hailing is dominated by a **location-update firehose**. Five million drivers pinging every
4 s is **1.25M writes/sec** (~125 MB/s), about **2160×** the actual ride-request rate (~579/s). So driver
location must be **in-memory and ephemeral** — you keep only each driver's *latest* position in a
geospatial index and overwrite it, never durably persisting every ping. **Matching** is comparatively
cheap: each request is a geo query plus ranking ~10 candidates (~5.8k evaluations/sec). The design is to
cheaply absorb an enormous location write stream into a live geo-index against which relatively rare
matching queries run.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/ride-hailing-estimates.ts` + test; `components/learning/ride-hailing-capacity.tsx`
(`RideHailingCapacity`); `components/diagrams/ride-hailing-architecture.tsx` (`RideHailingArchitecture`);
`components/diagrams/ride-hailing-flows.tsx` (`LocationUpdateSequence`, `MatchRideSequence`,
`TripStateSequence`, `LiveTrackingSequence`). Register all in `mdx-components.tsx`.

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `ride-hailing` → `available`;
`app/learn/[slug]/page.tsx` import + map; `content/tutorials/ride-hailing.mdx`;
`tests/tutorial-registry.test.ts` (add to sorted keys after `rate-limiter`, before `search-autocomplete`;
+ 18-section assertion; **repoint "returns undefined" from `ride-hailing` to `food-delivery`**);
`tests/curriculum.test.ts` (insert `ride-hailing` into the available list **after `photo-sharing`, before
`ticket-booking`** — seq 14); `tests/ride-hailing-content.test.ts`; extend `e2e/pilot.spec.ts` (with
`scrollIntoViewIfNeeded` before the viewport check) and **decrement the "coming soon" count by one
(11 → 10)**.

## Invariants

- Ride-hailing = **real-time matching over a moving dataset**: geo-index + location firehose + matching
  (no double-book) + trip state machine.
- Geo index: **cell-based** (geohash / quadtree / **S2** / **H3**); a nearby query reads the rider's cell
  + neighbors (O(nearby cells), not a full scan).
- Location: **ephemeral, in-memory, latest-only** (overwrite per driver); never durably persist every
  ping. Firehose ~**2160×** ride requests.
- Matching: query nearby available drivers → **rank by ETA/road distance** → **atomic reservation** so a
  driver isn't matched twice (contention like Ticket Booking).
- Trip = **explicit state machine** (requested→matched→en_route→arrived→in_progress→completed, +cancel);
  reject invalid transitions.
- Tracking: **push** driver location to the rider (WebSockets, Chat-System pattern); ETA via road routing
  (Maps & Navigation).
- Surge pricing balances **supply/demand** in hot zones.
- Capacity: 1.25M location writes/s (~125 MB/s) vs ~579 rides/s; matching ~5.8k candidate evals/s.

## Commit sequence

1. `docs: design spec and plan for Ride-Hailing tutorial`
2. `feat: add Ride-Hailing capacity model and wrapper`
3. `feat: add Ride-Hailing architecture and flow diagrams`
4. `feat: register Ride-Hailing tutorial route and skeleton`
5. `content: complete Ride-Hailing tutorial`
6. `test: verify Ride-Hailing tutorial flow end-to-end`
