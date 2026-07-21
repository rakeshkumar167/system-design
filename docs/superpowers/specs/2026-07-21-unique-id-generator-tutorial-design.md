# Unique ID Generator Tutorial — Design Spec

**Date:** 2026-07-21
**Status:** Approved for planning
**Problem:** `unique-id-generator` (curriculum sequence 27, difficulty **Intermediate**)

## Goal

Author the **Unique ID Generator** tutorial (`/learn/unique-id-generator`) — a Twitter-Snowflake-class
system. The reframe: it *looks* trivial ("just use a UUID, or a database auto-increment"), but the hard
part is generating **globally unique, roughly time-ordered IDs at massive scale with no coordination on the
hot path** — and every easy answer fails one of those axes. A UUIDv4 is unique but **random** (not
sortable, and 128 bits bloats every index); a database `AUTO_INCREMENT` is sortable but a **coordination
bottleneck and single point of failure**; a central "ticket server" is a SPOF too. **Snowflake's** insight
is to pack **time + machine id + a per-machine counter** into a single **64-bit integer** so every node
mints IDs **locally, with zero coordination**, yet the IDs are globally unique and roughly time-sortable.
The real difficulty then moves to the details that make that safe: **assigning each node a distinct machine
id**, surviving **clock skew and clocks moving backwards**, defining what **monotonicity/ordering** you can
actually guarantee, and spending a fixed **64-bit budget** across lifespan, node count, and throughput.

Concepts (from curriculum): **Snowflake IDs, Clock skew, Monotonicity, Partitioning**.

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
| 8 | `id-approaches` | The Design Space | advanced |
| 9 | `snowflake-anatomy` | Anatomy of a 64-bit ID | advanced |
| 10 | `worker-id-assignment` | Assigning Machine IDs | advanced |
| 11 | `clock-skew` | Clock Skew & Going Backwards | advanced |
| 12 | `monotonicity-ordering` | Monotonicity & Ordering | advanced |
| 13 | `throughput-scaling` | Throughput, Overflow & Partitioning | advanced |
| 14 | `scalability-evolution` | Scalability & Evolution | advanced |
| 15 | `resiliency-failure-modes` | Resiliency & Failure Modes | advanced |
| 16 | `tradeoffs-alternatives` | Trade-offs & Alternatives | advanced |
| 17 | `interview-summary` | Interview Summary | interview-ready |
| 18 | `knowledge-checks-faq` | Knowledge Checks & FAQ | fundamentals |

### Key content beats

1. **Framing** — reframe: generating an ID is trivial; generating **unique, roughly time-sortable IDs at
   scale without coordination** is the problem, and each naive answer (UUIDv4, auto-increment, ticket
   server) fails uniqueness, sortability, or coordination-free scale. Snowflake packs time+machine+counter
   into 64 bits so each node mints locally. `Callout variant="interview"` 45-min plan. Note IDs like these
   underpin many systems (the [URL Shortener](/learn/url-shortener)'s keys, shard keys, idempotency keys).
2. **Requirements** — functional: generate a unique ID on demand; IDs roughly time-ordered; fit a 64-bit
   integer; (optionally) batch and decode. Non-func: **absolute uniqueness** (never collide), **huge
   throughput**, **low latency** (local, no network round-trip), **rough sortability (k-ordered)**, **no
   SPOF / no coordination on the hot path**, **compact** (indexes cheaply). `RequirementsTable`.
3. **Capacity** — `SnowflakeCapacity`. Lesson: **throughput is a non-problem; the budget is bits.** One
   node mints **4,096,000 IDs/sec** locally (12 sequence bits × 1000 ms) with no network call — already
   covering a demanding 1M/sec workload on a **single machine**. The fixed **64 bits** split into **41
   time** (≈**69.7-year** lifespan), **10 machine** (**1,024** nodes), **12 sequence** (**4,096** IDs/ms/
   node); fill the fleet and it's ~**4.19 billion** IDs/sec. The constraint is how you *spend the bits* and
   get clocks/coordination right — not servers.
4. **Entity Model** — the **ID itself** is the entity: a 64-bit integer decomposing into
   timestamp/machine/sequence (self-describing — it carries its own creation time), plus the **generator
   node's mutable state** (assigned machine id, last timestamp, sequence counter). `EntityModel`.
5. **API Design** — `GET /id` (mint one — the hot path; **return the 64-bit value as a string** to dodge
   JSON's 53-bit float limit), `GET /ids?count=N` (batch allocate a block), `GET /id/{value}` (decode into
   timestamp/machine/sequence — IDs are self-describing). Three `ApiContract`s.
6. **High-Level Architecture** — `SnowflakeArchitecture` HLD: several independent **ID-generator nodes**,
   each with its own machine id, minting locally on the hot path with **no shared component**; a
   **coordination service** (ZooKeeper/etcd) consulted **once at startup** to hand out a distinct machine
   id; the wall clock (NTP) as an input. The point: the hot path touches nothing shared.
7. **Detailed Flows** — four sequences (below); show generate + worker-id assignment here, clock-skew and
   overflow in their deep dives.
8. **The Design Space** — walk the alternatives and why each falls short. **UUIDv4**: 128-bit random —
   unique and coordination-free but **not sortable** (random ⇒ terrible index locality) and **twice the
   width**. **DB auto-increment**: sortable and simple but a **central bottleneck/SPOF**, and cross-shard
   it breaks. **Ticket/segment server** (Flickr-style): one DB hands out ranges — better, but still central
   and a SPOF. **UUIDv7/ULID**: time-ordered 128-bit — good, but wide. **Snowflake**: decentralized 64-bit
   time+machine+sequence — unique, sortable, coordination-free, compact. `KnowledgeCheck`.
9. **Anatomy of a 64-bit ID** — the Snowflake layout: **1 sign bit** (unused, keep it positive) + **41
   timestamp bits** (ms since a **custom epoch**, ~69.7 years) + **10 machine-id bits** (1,024 nodes) +
   **12 sequence bits** (0–4,095 per ms per node). Generation: read current ms; if same ms as last,
   increment the sequence; if a new ms, reset the sequence to 0; compose by bit-shifting. The **bit budget
   is a design knob** — steal machine bits for more sequence (more throughput/node, fewer nodes), or more
   time bits for a longer lifespan. Embed `<GenerateIdSequence />`. `KnowledgeCheck`.
10. **Assigning Machine IDs** — the 10 machine bits must be **unique per node or you mint duplicate IDs**.
    Options: **static config** (simple, error-prone at scale), **ZooKeeper/etcd ephemeral-sequential
    nodes** (a node claims the next free id at startup and holds it via its session — the
    [Distributed Job Scheduler](/learn/distributed-job-scheduler)'s coordination primitive), or **derive
    from host** (IP/hostname hash — risky collisions). Only **1,024** ids exist, so reclaiming ids from
    dead nodes matters. Embed `<WorkerIdAssignmentSequence />`. `KnowledgeCheck`.
11. **Clock Skew & Going Backwards** — time-based IDs trust the wall clock, and wall clocks **move
    backwards** (NTP corrections, leap seconds, VM pauses). If the clock rewinds, the node could re-mint a
    timestamp it already used ⇒ **duplicate or out-of-order IDs**. Handling: **detect** (is current ms <
    last ms?), then either **wait/refuse** until the clock catches up (Twitter's choice — reject rather
    than risk a duplicate), or use a **monotonic clock** source that never goes backwards. Small forward
    jumps just leave gaps (harmless). Embed `<ClockSkewSequence />`. `KnowledgeCheck`.
12. **Monotonicity & Ordering** — what ordering can you actually promise? **Within a node**, IDs are
    **strictly increasing**. **Across nodes**, they're **k-sorted / roughly time-ordered** — ordered by
    time to millisecond granularity, but two nodes minting in the same ms can interleave. Strict *global*
    monotonicity is **impossible without coordination** (which is the whole thing we're avoiding), and
    "roughly sorted" is enough for index locality and time-range scans. This is the deliberate trade:
    give up strict global order to keep local, coordination-free generation. `KnowledgeCheck`.
13. **Throughput, Overflow & Partitioning** — per-node throughput is capped at **4,096 IDs/ms** (the
    sequence space); exceed it in one ms and the node **waits for the next millisecond tick**, then resets
    the counter — a natural, correct backpressure. Scale is **embarrassingly parallel**: the machine-id
    bits **partition** the ID space, so adding a node adds an independent 4.096M/sec stream with no
    coordination. The system is a partitioned space where each partition (machine id) generates
    independently. Embed `<SequenceOverflowSequence />`.
14. **Scalability & Evolution** — staged `TradeoffTable` (single DB auto-increment → ticket/segment server
    → Snowflake decentralized nodes → tuned bit-budget / multi-datacenter with datacenter bits).
15. **Resiliency & Failure Modes** — `FailureMatrix` (clock moves backwards, machine-id collision,
    coordination service down at startup, sequence overflow in a ms, epoch/time-bit exhaustion, node
    clock drift, JSON 53-bit truncation).
16. **Trade-offs & Alternatives** — `DecisionRecord` + axes (64-bit Snowflake vs 128-bit UUIDv7/ULID;
    decentralized vs centralized ticket server; strict vs rough ordering; bit allocation).
17. **Interview Summary** — `Callout variant="interview"` 60-second answer.
18. **Knowledge Checks & FAQ** — ≥ 6 `<KnowledgeCheck>`; `<Faq>` **≥ 12**.

## Detailed Flows (4 sequences)

- `GenerateIdSequence` — client → node → id: the node reads the current millisecond, increments the
  sequence within the same ms (or resets it on a new ms), composes timestamp | machine id | sequence into a
  64-bit integer, and returns it. Caption: each node mints an ID locally with no coordination by packing
  time, a machine id, and a per-millisecond counter into 64 bits.
- `WorkerIdAssignmentSequence` — node → coordinator → node: at startup the node registers with the
  coordination service, which assigns it a distinct machine id (an ephemeral-sequential node), after which
  it mints independently. Caption: at startup a node claims a unique machine id from the coordinator so no
  two nodes ever share the machine-id bits.
- `ClockSkewSequence` — node detecting a backwards clock: the node compares the current millisecond to the
  last one it used; when the clock has moved backwards it waits (or rejects the request) until the clock
  catches up rather than emit a timestamp it already used. Caption: if the clock moves backwards the node
  waits rather than re-minting a used timestamp, so it never produces a duplicate ID.
- `SequenceOverflowSequence` — node exhausting the per-ms counter: within one millisecond the requests use
  up all 4,096 sequence values, so the node blocks until the next millisecond tick and resets the counter.
  Caption: when the per-millisecond counter overflows the node waits for the next millisecond, capping
  per-node throughput and keeping every ID unique.

## Capacity Model (exact)

`lib/unique-id-generator-estimates.ts`, pure & deterministic. All powers of two via `Math.pow`; `lifespanYears`
uses a 365-day year.

Assumptions (MDX embed and test):
```ts
{
  timeBits: 41,
  machineBits: 10,
  sequenceBits: 12,
  peakIdsPerSec: 1_000_000,
}
```

Results:
- `totalBits` = 1 + 41 + 10 + 12 = **64**
- `idsPerMsPerNode` = 2^12 = **4096**
- `idsPerSecPerNode` = 4096 × 1000 = **4,096,000**
- `maxNodes` = 2^10 = **1024**
- `maxIdsPerSec` = 4,096,000 × 1024 = **4,194,304,000**
- `lifespanYears` = 2^41 / (365 × 86400 × 1000) ≈ **69.73** (assert `toBeCloseTo(69.73, 2)`)
- `nodesForPeakDemand` = ceil(1,000,000 / 4,096,000) = **1**

Lesson: for a unique-ID generator, **throughput is a non-problem and the real budget is bits.** A single
node mints **4,096,000 IDs/sec** — 12 sequence bits give 4,096 IDs per millisecond, ×1000 ms — entirely
locally, with **no network call and no coordination**, so even a demanding **1,000,000 IDs/sec** workload
needs exactly **one** machine (`nodesForPeakDemand = 1`). The design's actual constraint is the fixed
**64-bit** budget and how you spend it: **41 time bits** buy a ≈**69.7-year** lifespan from a custom epoch,
**10 machine bits** allow **1,024** independent nodes, and **12 sequence bits** allow **4,096** IDs/ms/node
— and if you filled all 1,024 nodes you'd have ~**4.19 billion** IDs/sec, astronomically beyond any real
need. So you don't scale a Snowflake generator by adding capacity for throughput; you budget bits for
lifespan, node count, and per-node rate, and spend your engineering on clock and machine-id correctness.

## Components

Reused: `Callout` (`interview`/`info`/`warning`), `RequirementsTable`, `EntityModel`, `ApiContract`,
`TradeoffTable`, `DecisionRecord`, `FailureMatrix`, `KnowledgeCheck`, `Faq`, `CapacityTable` (wrapper),
diagram primitives, `TutorialLayout`.

New: `lib/unique-id-generator-estimates.ts` + test; `components/learning/unique-id-generator-capacity.tsx`
(`SnowflakeCapacity`); `components/diagrams/unique-id-generator-architecture.tsx` (`SnowflakeArchitecture`);
`components/diagrams/unique-id-generator-flows.tsx` (`GenerateIdSequence`, `WorkerIdAssignmentSequence`,
`ClockSkewSequence`, `SequenceOverflowSequence`). Register all in `mdx-components.tsx`. **Collision check
done — all six new export names are unused.**

Wiring: `tutorial-registry.ts` entry (18 sections); `curriculum.ts` flip `unique-id-generator` →
`available`; `app/learn/[slug]/page.tsx` import + map (`UniqueIdGeneratorContent`);
`content/tutorials/unique-id-generator.mdx`; `tests/tutorial-registry.test.ts` (add the 18-section
assertion **and** add `"unique-id-generator"` to the `Object.keys(tutorials).sort()` list; the "returns
undefined" slug stays `food-delivery`, untouched); `tests/curriculum.test.ts` (**insert
`"unique-id-generator"` after `"maps-navigation"`, before `"distributed-job-scheduler"`** — seq 27 in
definition order); `tests/unique-id-generator-content.test.ts`; extend `e2e/pilot.spec.ts` (with
`scrollIntoViewIfNeeded` before the viewport check) and **decrement the "coming soon" count by one
(9 → 8)**. Leave "showing 1 of 33" untouched.

## Invariants

- Unique ID Generator = **unique, roughly time-sortable IDs at scale with no coordination on the hot path**;
  each naive answer fails uniqueness, sortability, or coordination-free scale.
- Snowflake 64-bit layout: **1 sign + 41 time + 10 machine + 12 sequence**; each node mints locally by
  bit-packing time | machine | sequence.
- Machine id must be **unique per node** (else duplicate IDs); assign via **ZooKeeper/etcd
  ephemeral-sequential** (or static config); only **1,024** ids exist.
- Clock going **backwards** ⇒ **wait/refuse** (never re-mint a used timestamp); forward jumps just leave
  harmless gaps.
- Ordering: **strictly increasing within a node**, **k-sorted / roughly time-ordered across nodes**; strict
  global monotonicity is impossible without coordination and isn't needed.
- Throughput: **4,096 IDs/ms/node** cap; overflow ⇒ **wait for next ms**. Scale by adding nodes — the
  **machine-id bits partition** the space; embarrassingly parallel.
- Return the 64-bit id **as a string** in JSON (JSON numbers are 53-bit floats).
- Capacity: 4.096M IDs/sec/node, 1,024 nodes ⇒ ~4.19B/sec; ≈69.7-year lifespan; even 1M/sec needs 1 node.

## Commit sequence

1. `docs: design spec and plan for Unique ID Generator tutorial`
2. `feat: add Unique ID Generator capacity model and wrapper`
3. `feat: add Unique ID Generator architecture and flow diagrams`
4. `feat: register Unique ID Generator tutorial route and skeleton`
5. `content: complete Unique ID Generator tutorial`
6. `test: verify Unique ID Generator tutorial flow end-to-end`
