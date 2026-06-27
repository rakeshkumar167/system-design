# Chat System Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the eighteenth complete curriculum tutorial — an Advanced, real-time-messaging
walkthrough of a **Chat System**: the WebSocket connection layer and gateway fleet, the session
registry / message routing, online-push vs offline-mailbox delivery, delivery guarantees and receipts,
ordering and consistency, group-chat fan-out, and presence/typing — reusing the existing tutorial
infrastructure.

**Architecture:** Static Next.js App Router route + MDX content + typed registry, exactly like the
first seventeen tutorials. New work is a pure capacity module + wrapper, one architecture SVG diagram,
four flow-sequence diagrams, the registry/curriculum wiring, and the MDX content. The distinguishing
themes are the **WebSocket gateway fleet**, the **session registry routing**, **online-push/offline-
mailbox** delivery, **at-least-once + ACK** guarantees, **per-conversation seq ordering**, **group
fan-out**, and **presence**.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript, Tailwind CSS 4, `@next/mdx`, Vitest 4.1.9,
Testing Library, Playwright 1.61.0, Lucide React.

## Global Constraints

- Deploys cleanly to Vercel with no runtime backend; tutorials are static teaching artifacts.
- Reading experience works without client JS; interactive pieces progressively enhance static content.
- Support responsive layout, keyboard nav, visible focus, `prefers-reduced-motion`, light + dark themes.
- Diagrams are custom, precise, accessible SVG — every diagram exposes `role="img"` with an accessible name (via `DiagramFrame`'s `title`) and an adjacent text caption that conveys the meaning without the visual.
- Section `id`s in the MDX must exactly match the registry `sections` ids and the content test's `requiredIds`.
- Adding this tutorial must not alter the seventeen existing tutorials.
- Invariants: real-time delivery needs a **persistent bidirectional connection (WebSocket)** per online user on a **stateful gateway**; a user is on **one** gateway, so a **session registry** (user→gateway) routes each message; **connections are the constraint** — ~**100M** concurrent (20% of 500M DAU), ~**1,000** gateways (~100k conns each), ~**1 TB** connection memory, while message rate (~**231k/sec**, ~**4 TB/day**) is ordinary; delivery is **online push** vs **offline mailbox** (per-user pending queue drained on reconnect), **at-least-once** + client **ACK** + **dedup by client message_id** ⇒ exactly-once *display*, with a **sent → delivered → read** receipt state machine; **ordering** by a **monotonic per-conversation sequence number** (clients order by seq, not wall-clock); **group chat** = fan-out on write to members' mailboxes; **presence/typing** is **ephemeral, heartbeat-driven** and costly in **fan-out**; offline out-of-app push hands off to the **Notification Service**.

---

## Planned File Structure

```text
system-design/
├── app/learn/[slug]/page.tsx                    # MODIFY: register chat-system MDX
├── components/
│   ├── diagrams/
│   │   ├── chat-system-architecture.tsx         # NEW: HLD (clients, WebSocket gateways, message service, message store, session registry, mailbox, presence)
│   │   └── chat-system-flows.tsx                # NEW: send / offline-delivery / receipt / presence sequences
│   └── learning/
│       └── chat-system-capacity.tsx             # NEW: wrapper over CapacityTable
├── content/tutorials/chat-system.mdx            # NEW: full tutorial content
├── lib/
│   ├── chat-system-estimates.ts                 # NEW: pure capacity calc
│   ├── tutorial-registry.ts                      # MODIFY: add chat-system entry (18 sections)
│   └── curriculum.ts                             # MODIFY: flip chat-system to available
├── mdx-components.tsx                            # MODIFY: register new components
├── tests/
│   ├── chat-system-estimates.test.ts            # NEW
│   ├── chat-system-content.test.ts              # NEW
│   ├── diagrams.test.tsx                         # MODIFY: chat diagram assertions
│   ├── tutorial-registry.test.ts                # MODIFY: eighteen tutorials; repoint undefined-slug to object-storage
│   └── curriculum.test.ts                        # MODIFY: eighteen available problems (chat-system inserts at seq 10)
└── e2e/pilot.spec.ts                            # MODIFY: chat flow + coming-soon count 16→15
```

---

### Task 1: Capacity Calculation and Wrapper (Sonnet)

Add the Chat System capacity calculation and a thin wrapper over the shared `CapacityTable`.

**Files:** Create `lib/chat-system-estimates.ts`, `tests/chat-system-estimates.test.ts`, `components/learning/chat-system-capacity.tsx`; Modify `mdx-components.tsx`.

**Step 1: Write the failing calculation test**
```ts
// tests/chat-system-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateChatSystemCapacity } from "@/lib/chat-system-estimates";

describe("calculateChatSystemCapacity", () => {
  const result = calculateChatSystemCapacity({
    dailyActiveUsers: 500_000_000,
    messagesPerUserPerDay: 40,
    peakOnlineFraction: 0.2,
    connectionsPerServer: 100_000,
    avgMessageBytes: 200,
    bytesPerConnection: 10_000,
  });

  it("derives messages per second", () => {
    expect(result.messagesPerSec).toBeCloseTo(231481.48, 1);
  });
  it("derives peak concurrent connections", () => {
    expect(result.concurrentConnections).toBe(100_000_000);
  });
  it("derives the gateway server fleet size", () => {
    expect(result.gatewayServersNeeded).toBe(1000);
  });
  it("derives daily message storage in TB", () => {
    expect(result.dailyStorageTb).toBe(4);
  });
  it("derives total connection memory in TB", () => {
    expect(result.connectionMemoryTb).toBe(1);
  });
});
```

**Step 2: Run to verify it fails** — `npm test -- tests/chat-system-estimates.test.ts`.

**Step 3: Implement** `lib/chat-system-estimates.ts`:
```ts
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface ChatSystemCapacityAssumptions {
  /** Daily active users. */
  dailyActiveUsers: number;
  /** Messages sent per user per day. */
  messagesPerUserPerDay: number;
  /** Fraction of users online (holding a connection) at peak. */
  peakOnlineFraction: number;
  /** Persistent connections one gateway server can hold. */
  connectionsPerServer: number;
  /** Average stored bytes per message. */
  avgMessageBytes: number;
  /** Server-side memory held per open connection (buffers + state). */
  bytesPerConnection: number;
}

export interface ChatSystemCapacityResults {
  messagesPerSec: number;
  concurrentConnections: number;
  gatewayServersNeeded: number;
  dailyStorageTb: number;
  connectionMemoryTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the message rate (~231k/sec, ~4 TB/day) is
 * ordinary, but the signature constraint is holding ~100M persistent WebSocket connections at peak —
 * forcing a fleet of ~1,000 stateful gateway servers (~100k connections each) and ~1 TB of connection
 * memory, plus a session registry to route to the one gateway a user is connected to. Chat scales by
 * holding millions of long-lived stateful connections, not by adding stateless boxes.
 */
export function calculateChatSystemCapacity(
  a: ChatSystemCapacityAssumptions,
): ChatSystemCapacityResults {
  const messagesPerSec = (a.dailyActiveUsers * a.messagesPerUserPerDay) / SECONDS_PER_DAY;
  const concurrentConnections = a.dailyActiveUsers * a.peakOnlineFraction;
  const gatewayServersNeeded = Math.ceil(concurrentConnections / a.connectionsPerServer);
  const dailyStorageTb =
    (a.dailyActiveUsers * a.messagesPerUserPerDay * a.avgMessageBytes) / BYTES_PER_TB;
  const connectionMemoryTb = (concurrentConnections * a.bytesPerConnection) / BYTES_PER_TB;

  return {
    messagesPerSec,
    concurrentConnections,
    gatewayServersNeeded,
    dailyStorageTb,
    connectionMemoryTb,
  };
}
```

**Step 4: Run to verify it passes** (5 tests).

**Step 5: Create the wrapper** `components/learning/chat-system-capacity.tsx`, mirroring
`components/learning/news-feed-capacity.tsx` (same `fmt` helper, `CapacityTable` import):
```tsx
import {
  calculateChatSystemCapacity,
  type ChatSystemCapacityAssumptions,
} from "@/lib/chat-system-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ChatSystemCapacity({
  assumptions,
}: {
  assumptions: ChatSystemCapacityAssumptions;
}) {
  const r = calculateChatSystemCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Messages / user / day", value: fmt(assumptions.messagesPerUserPerDay) },
    { label: "Peak online fraction", value: `${fmt(assumptions.peakOnlineFraction * 100)}%` },
    { label: "Connections / server", value: fmt(assumptions.connectionsPerServer) },
    { label: "Avg message size", value: `${fmt(assumptions.avgMessageBytes)} B` },
    { label: "Memory / connection", value: `${fmt(assumptions.bytesPerConnection / 1000)} KB` },
  ];

  const results: ResultRow[] = [
    { label: "Messages / sec", value: `${fmt(r.messagesPerSec)} /s`, consequence: "The message write rate is ordinary — a routine throughput problem, not the hard part." },
    { label: "Concurrent connections", value: fmt(r.concurrentConnections), consequence: "The signature constraint: millions of long-lived WebSocket connections held open at once — what makes chat unlike a request/response service." },
    { label: "Gateway servers", value: fmt(r.gatewayServersNeeded), consequence: "Sized by concurrent connections ÷ connections-per-server; the gateways are stateful, holding the open sockets." },
    { label: "Daily message storage", value: `${fmt(r.dailyStorageTb)} TB`, consequence: "Durable history accumulates steadily — an ordinary storage growth rate." },
    { label: "Connection memory", value: `${fmt(r.connectionMemoryTb)} TB`, consequence: "Each open connection costs server memory (buffers + state); millions of them add up across the fleet." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

**Step 6: Register** `ChatSystemCapacity` in `mdx-components.tsx` (import + add to `teachingComponents`).

**Step 7: Verify and commit**
```bash
npm test -- tests/chat-system-estimates.test.ts tests/news-feed-estimates.test.ts
npm run typecheck && npm run lint
git add lib/chat-system-estimates.ts tests/chat-system-estimates.test.ts components/learning/chat-system-capacity.tsx mdx-components.tsx
git commit -m "feat: add chat system capacity model and wrapper"
```

---

### Task 2: Architecture and Flow Diagrams (Sonnet)

Two diagram modules built from the existing primitives. Mirror
`components/diagrams/news-feed-architecture.tsx` (HLD) and
`components/diagrams/news-feed-flows.tsx` (sequences) — do not invent new SVG conventions. Copy the
`Sequence`/`StepLabel`/`Actor`/`Step` helpers from `news-feed-flows.tsx` (or `search-autocomplete-flows.tsx`)
verbatim.

**Files:** Create `components/diagrams/chat-system-architecture.tsx`, `components/diagrams/chat-system-flows.tsx`; Modify `tests/diagrams.test.tsx`, `mdx-components.tsx`.

**Step 1: Append failing diagram tests** to `tests/diagrams.test.tsx`:
```tsx
import { ChatArchitecture } from "@/components/diagrams/chat-system-architecture";
import {
  SendMessageSequence,
  OfflineDeliverySequence,
  DeliveryReceiptSequence,
  PresenceUpdateSequence,
} from "@/components/diagrams/chat-system-flows";

describe("ChatArchitecture", () => {
  it("exposes the chat system architecture to non-visual readers", () => {
    render(<ChatArchitecture />);
    expect(
      screen.getByRole("img", { name: /chat system architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/persistent connection/i)).toBeInTheDocument();
  });
});

describe("chat system flow sequences", () => {
  it("renders the send, offline, receipt, and presence sequences", () => {
    render(<SendMessageSequence />);
    expect(screen.getByRole("img", { name: /send/i })).toBeInTheDocument();
    render(<OfflineDeliverySequence />);
    expect(screen.getByRole("img", { name: /offline/i })).toBeInTheDocument();
    render(<DeliveryReceiptSequence />);
    expect(screen.getByRole("img", { name: /receipt/i })).toBeInTheDocument();
    render(<PresenceUpdateSequence />);
    expect(screen.getByRole("img", { name: /presence/i })).toBeInTheDocument();
  });
});
```
NOTE on the known `getByText` gotcha: keep the asserted phrase **"persistent connection"** in the
architecture diagram's `caption` ONLY — not as any single node's full label/sublabel text, and not in
the `DiagramFrame` title. Label the gateway node "WebSocket Gateway" with sublabel "holds connections"
(do NOT make a node's text exactly "persistent connection"). Also: all four flow titles render into one
test DOM, so the four title keywords must be mutually exclusive: **"send" / "offline" / "receipt" /
"presence"**. CRITICAL: verify NO title contains another's keyword. Suggested titles: "Sequence: send a
message to an online recipient" / "Sequence: deliver to an offline recipient" / "Sequence: propagate a
delivery receipt" / "Sequence: broadcast a presence update". (Check: the offline title must not contain
"send"; the receipt title must not contain "send/offline/presence"; etc.)

NAME-COLLISION WARNING: `PresenceSequence` and `ReconnectSyncSequence` already exist (from
`collab-editor-flows.tsx`) and are registered in `mdx-components.tsx`. Your chat flow exports MUST use
the distinct names `SendMessageSequence`, `OfflineDeliverySequence`, `DeliveryReceiptSequence`,
`PresenceUpdateSequence` (NOT `PresenceSequence`/`ReconnectSyncSequence`). Grep `mdx-components.tsx`
before registering to confirm these four names are free; no aliasing should be needed.

**Step 2: Run to verify failure** — `npm test -- tests/diagrams.test.tsx`.

**Step 3: Implement the architecture diagram** `chat-system-architecture.tsx` exporting
`ChatArchitecture`, following the `news-feed-architecture.tsx` pattern (a `const N` node-geometry map,
`DiagramFrame` with `title`/`viewBox`/`caption`, `DiagramDefs`, edges before nodes, a `Legend`). Show
the send-and-route path plus offline + presence:
- `Sender` (external, sublabel "client") → `WebSocket Gateway` (service, sublabel "holds connections") via `ingress` ("send over socket").
- `WebSocket Gateway` → `Message Service` (service, sublabel "route + persist") via `redirect` ("forward message").
- `Message Service` → `Message Store` (store, sublabel "messages + history") via `create` ("persist message").
- `Message Service` → `Session Registry` (cache, sublabel "user → gateway") via `control` ("look up recipient").
- `Message Service` → `WebSocket Gateway` via `async` ("route to gateway") [the push back toward the recipient's gateway].
- `WebSocket Gateway` → `Recipient` (external, sublabel "client") via `redirect` ("push message").
- `Message Service` → `Mailbox` (store, sublabel "offline inbox") via `create` ("queue if offline").
- `WebSocket Gateway` → `Presence` (service, sublabel "online / last-seen") via `muted` ("heartbeat").
- `title` contains "Chat System architecture"; `caption` names the **persistent connection** gateways
  (the phrase "persistent connection" verbatim, caption only), the **session-registry** routing to the
  recipient's gateway, **online push vs offline mailbox**, and **presence** heartbeats, in prose.
- Node kinds: `external` for the sender and recipient; `service` for the gateway, message service, and
  presence; `store` for the message store and mailbox; `cache` for the session registry.
- Suggested geometry (viewBox `0 0 980 540`): sender {24,200} → gateway {220,200} (the gateway is central);
  messageService {430,200}; messageStore {640,90}; sessionRegistry {640,200}; mailbox {640,310};
  recipient {24,360} or {220,360} reached from the gateway's push; presence {430,360}. Adjust to avoid
  overlaps; `w` ≈ 150, `h` ≈ 56 (store/cache `h` ≈ 60). Keep the viewBox ≥ the rightmost/bottom-most
  node. (Exact coordinates are the implementer's discretion as long as edges don't cross nodes and the
  layout reads cleanly; a single gateway node serving both sender and recipient is fine — it represents
  the fleet.)

**Step 4: Implement the flow sequences** `chat-system-flows.tsx`, exporting four components. Each `title`
contains the keyword the test matches; keep the four keywords mutually exclusive ("send" / "offline" /
"receipt" / "presence") and ensure no title contains another's keyword:
- `SendMessageSequence` — title contains "send" (e.g. "Sequence: send a message to an online recipient"); actors Sender, Gateway, Message Service, Session Registry; steps: sender emits over the socket, the gateway forwards to the message service, which persists the message, looks up the recipient's gateway in the session registry, and routes it for a real-time push. Caption: the online path — a message is persisted, the recipient's gateway is found via the session registry, and the message is pushed to their open connection in real time. Use `create` for persist, `control` for the lookup, `redirect`/`async` for forward/route.
- `OfflineDeliverySequence` — title contains "offline" and NOT send/receipt/presence (e.g. "Sequence: deliver to an offline recipient"); actors Message Service, Mailbox, Recipient; steps: the recipient has no live connection, so the message service writes it to the recipient's mailbox; later the recipient reconnects, syncs/pulls pending messages, and the mailbox is drained. Caption: when the recipient is offline, the message is stored in their per-user mailbox and delivered on reconnect, when the client syncs and drains pending messages. Use `create` for the mailbox write, `redirect` for the sync/drain.
- `DeliveryReceiptSequence` — title contains "receipt" and NOT send/offline/presence (e.g. "Sequence: propagate a delivery receipt"); actors Recipient, Gateway, Message Service, Sender; steps: the recipient ACKs delivered (and later read), the gateway forwards the ACK to the message service, which updates status and propagates the receipt back to the sender. Caption: the recipient acknowledges delivered (then read); the ACK flows back through the message service to update the sent → delivered → read state and notify the sender. Use `control` for the ACK, `redirect` for propagation.
- `PresenceUpdateSequence` — title contains "presence" (e.g. "Sequence: broadcast a presence update"); actors Recipient, Gateway, Presence, Sender; steps: a client heartbeat updates presence, the presence service records online/last-seen and fans the change out to subscribers (e.g. the sender viewing the conversation). Caption: heartbeats keep presence fresh; a change in online/last-seen is fanned out to subscribers, which is cheap per event but costly in aggregate fan-out. Use `muted` for heartbeat, `async` for the fan-out.

**Step 5: Register** all five in `mdx-components.tsx` (import + add to `teachingComponents`). Confirm by
grep that `ChatArchitecture`, `SendMessageSequence`, `OfflineDeliverySequence`, `DeliveryReceiptSequence`,
`PresenceUpdateSequence` are NOT already present (they shouldn't be); register under those exact names.

**Step 6: Verify and commit**
```bash
npm test -- tests/diagrams.test.tsx
npm run typecheck && npm run lint
git add components/diagrams/chat-system-architecture.tsx components/diagrams/chat-system-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add chat system architecture and flow diagrams"
```

---

### Task 3: Registry, Curriculum Wiring, Route, and Content Skeleton (Sonnet)

Register the tutorial, flip its curriculum status, wire the route, add a compiling MDX skeleton with all
18 section ids, and update the existing "seventeen tutorials" tests to "eighteen".

**Files:** Modify `lib/tutorial-registry.ts`, `lib/curriculum.ts`, `tests/tutorial-registry.test.ts`, `tests/curriculum.test.ts`, `app/learn/[slug]/page.tsx`; Create `content/tutorials/chat-system.mdx` (skeleton).

IMPORTANT: there are currently SEVENTEEN available tutorials. You add an EIGHTEENTH. `chat-system` is
**sequence 10**, which sits **between `news-feed` (seq 9) and `video-streaming` (seq 11)** in the
curriculum's available-by-sequence ordering — so it **inserts early**. ALSO CRITICAL: `chat-system` was
the slug used by the registry test's "returns undefined for unregistered" case; since it is now
registered, that test must be repointed to a still-`coming-soon` slug — **`object-storage`** (seq 12).
Read each test file BEFORE editing to match its exact phrasing. The curriculum total is 33 — do NOT
change the 33/length assertions in curriculum.test.ts.

**Step 1:** `tests/tutorial-registry.test.ts` — update so all EIGHTEEN tutorials are registered. In the
sorted `Object.keys(tutorials)` array, `"chat-system"` sorts between `"api-gateway"` and `"cloud-drive"`.
The new sorted array is:
`["api-gateway", "chat-system", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "news-feed", "notification-service", "pastebin", "payment-system", "rate-limiter", "search-autocomplete", "ticket-booking", "url-shortener", "video-streaming", "web-crawler"]`.
Add `expect(getTutorial("chat-system")?.sections).toHaveLength(18);` to the section-length test. Update
the two descriptive `it(...)` strings to mention the Chat System. **CHANGE the "returns undefined for
unregistered" test from `getTutorial("chat-system")` to `getTutorial("object-storage")`** (object-storage
is still coming-soon and unregistered).

**Step 2:** `tests/curriculum.test.ts` — available slugs become, in sequence order:
`["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "web-crawler", "search-autocomplete", "news-feed", "chat-system", "video-streaming", "ticket-booking", "payment-system", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler"]`
(chat-system is seq 10 — it goes AFTER news-feed and BEFORE video-streaming). Add
`expect(getProblem("chat-system")?.title).toBe("Chat System");`. Update the descriptive `it(...)` string.
Do NOT touch the 33 count/sequence assertions. **READ the test first** to confirm the exact existing
array (it should currently have seventeen entries ending with news-feed inserted after search-autocomplete).

**Step 3:** Run both to verify they fail.

**Step 4:** `lib/curriculum.ts` — change the `chat-system` entry `status` from `"coming-soon"` to
`"available"`.

**Step 5:** `lib/tutorial-registry.ts` — add (placement within the object doesn't matter for the
sorted-keys test; keep it tidy, e.g. at the end before `};`):
```ts
"chat-system": {
  slug: "chat-system",
  title: "Design a Chat System",
  description:
    "An interview-grade walkthrough of a real-time chat system: WebSocket connection management across a stateful gateway fleet, a session registry that routes each message to the recipient's gateway, online-push vs offline-mailbox delivery, at-least-once delivery with ACKs and dedup, sent/delivered/read receipts, per-conversation ordering, group-chat fan-out, presence and typing indicators, scaling, and failure modes.",
  difficulty: "Advanced",
  readingMinutes: 36,
  concepts: ["WebSockets", "Message ordering", "Presence", "Delivery semantics"],
  sections: [
    { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
    { id: "requirements", label: "Requirements", depth: "interview-ready" },
    { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
    { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
    { id: "api-design", label: "API Design", depth: "interview-ready" },
    { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
    { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
    { id: "connection-layer", label: "WebSockets & Connection Management", depth: "advanced" },
    { id: "message-delivery", label: "Message Delivery & the Mailbox", depth: "advanced" },
    { id: "delivery-guarantees", label: "Delivery Guarantees & Receipts", depth: "advanced" },
    { id: "ordering-consistency", label: "Ordering & Consistency", depth: "advanced" },
    { id: "group-chat-fanout", label: "Group Chat & Fan-out", depth: "advanced" },
    { id: "presence-typing", label: "Presence, Typing & Last-Seen", depth: "advanced" },
    { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
    { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
    { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
    { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
    { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
  ],
},
```

**Step 6:** `app/learn/[slug]/page.tsx` — add
`import ChatSystemContent from "@/content/tutorials/chat-system.mdx";` and
`"chat-system": ChatSystemContent,` to the content map.

**Step 7:** Create `content/tutorials/chat-system.mdx` skeleton with all 18 `<h2 id="...">Label</h2>`
headings IN ORDER (ids and labels exactly as in Step 5), each followed by one placeholder sentence.
Avoid literal `{` / `}` in the placeholder prose (MDX treats them as JSX expressions).

**Step 8: Verify and commit**
```bash
npm test -- tests/tutorial-registry.test.ts tests/curriculum.test.ts
npm run typecheck && npm run build   # must statically generate /learn/chat-system
git add lib/tutorial-registry.ts lib/curriculum.ts tests/tutorial-registry.test.ts tests/curriculum.test.ts "app/learn/[slug]/page.tsx" content/tutorials/chat-system.mdx
git commit -m "feat: register chat system tutorial route and skeleton"
```

---

### Task 4 & 5: Author Content (Opus, orchestrator)

The orchestrator authors the full 18-section MDX to the scratchpad in parallel with Tasks 1–3, then
installs it over the skeleton once Task 3 has created the file and Tasks 1–2 have registered the embedded
components. Per the spec's section notes, embedding:
- `capacity-estimates` — `<ChatSystemCapacity assumptions={{ dailyActiveUsers: 500000000, messagesPerUserPerDay: 40, peakOnlineFraction: 0.2, connectionsPerServer: 100000, avgMessageBytes: 200, bytesPerConnection: 10000 }} />` then read off the connections-are-the-constraint / ordinary-message-rate lessons.
- `entity-model` — `EntityModel name="Message"` (message_id, conversation_id, sender_id, content, seq, created_at, status) + prose on the Conversation (1:1/group + members), the Mailbox (offline pending), the session registry (user→gateway), ordering-by-seq, dedup-by-client-message_id.
- `api-design` — `ApiContract` for `GET /ws` (WebSocket upgrade), `POST /messages`, `GET /conversations/{id}/messages`.
- `high-level-architecture` — `<ChatArchitecture />` + component prose.
- `detailed-flows` — `<SendMessageSequence />`, `<OfflineDeliverySequence />`, `<DeliveryReceiptSequence />`, `<PresenceUpdateSequence />` with prose.
- deep dives `connection-layer`, `message-delivery`, `delivery-guarantees`, `ordering-consistency`, `group-chat-fanout`, `presence-typing` per spec, with a `<KnowledgeCheck>` in connection-layer, message-delivery, delivery-guarantees, ordering-consistency, and group-chat-fanout.
- `scalability-evolution` — `TradeoffTable`; `resiliency-failure-modes` — `FailureMatrix` (≥ 6 rows); `tradeoffs-alternatives` — `DecisionRecord`; `interview-summary` — `Callout variant="interview"` 60-second answer; `knowledge-checks-faq` — remaining `KnowledgeCheck`s + one `<Faq items={[…]} />` with ≥ 12 entries.
- Cross-reference the Notification Service (offline out-of-app push; async fan-out), the News Feed (group fan-out on write), and the Collaborative Document Editor (websocket fan-out / reconnect sync). ≥ 6 `<KnowledgeCheck>` total. The capacity `assumptions={{…}}` must exactly match the estimates test.

Then create `tests/chat-system-content.test.ts` (mirror `tests/news-feed-content.test.ts`):
- `requiredIds` = the 18 ids above.
- assert embeds: `<ChatSystemCapacity`, `<ChatArchitecture`, and the four sequences `<SendMessageSequence`, `<OfflineDeliverySequence`, `<DeliveryReceiptSequence`, `<PresenceUpdateSequence`.
- assert `>= 6` `<KnowledgeCheck` and `>= 12` `question:` entries.

End: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (compiles the MDX with real embeds
and generates `/learn/chat-system`) all green. Commit `content: complete chat system tutorial`.

---

### Task 6: End-to-End Flow and Final Verification (Sonnet)

Extend the Playwright suite, fix the curriculum "Coming soon" count (now 15), and run full verification.

**Files:** Modify `e2e/pilot.spec.ts` (and only a component if browser verification exposes a real defect).

**Step 1:** In `e2e/pilot.spec.ts`, update the curriculum "Coming soon" count from 16 to 15 (eighteen
tutorials now available — verify the current value is 16 first) and add:
```ts
test("learner can open the chat system tutorial", async ({ page }) => {
  await page.goto("/learn/chat-system");
  await expect(
    page.getByRole("heading", { name: /design a chat system/i }),
  ).toBeVisible();
  await page.goto("/learn/chat-system#connection-layer");
  await expect(page.locator("#connection-layer")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /chat system architecture/i }).first(),
  ).toBeVisible();
});
```
(Direct fragment navigation, mirroring the prior tutorials, avoids the numbered/hidden-on-mobile TOC link
issue.) Leave the "showing 1 of 33" assertion unchanged.

**Step 2:** Run `npm run test:e2e`; fix only genuine defects the browser reveals.

**Step 3:** Full verification:
```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git diff --check
```

**Step 4:** Commit `test: verify chat system tutorial flow end-to-end`.

---

## Notes for the Implementer

- **Read `content/tutorials/news-feed.mdx` and `notification-service.mdx` first** for voice, depth, and component usage. Match their altitude.
- **Diagram primitives are fixed vocabulary.** Build from `Node`, `Edge`, `anchors`, `Legend`, `DiagramText`, `DiagramDefs`, `DiagramFrame`. Edge variants: `create` (accent — persist message / queue to mailbox), `redirect` (green — forward / push / sync / propagate receipt), `async` (violet dashed — route to gateway / presence fan-out), `control` (amber dashed — look up recipient / ACK), `muted` (telemetry dotted — heartbeat), `ingress` (plain — send over socket). Node kinds: `external` for sender/recipient clients, `service` for the gateway/message-service/presence, `store` for the message store and mailbox, `cache` for the session registry.
- **Accessibility is tested, not optional.** Every diagram needs `role="img"` + an accessible name (via `DiagramFrame`'s `title`) and a meaningful `caption`. Watch the `getByText` duplicate-match gotcha (keep "persistent connection" in the caption only — not as a node's full text, not in the title; the gateway node is "WebSocket Gateway" / "holds connections"). All four flow titles render into one test DOM — keep the keywords "send"/"offline"/"receipt"/"presence" mutually exclusive across titles.
- **Keep numbers consistent.** The capacity assumptions in the MDX must match `tests/chat-system-estimates.test.ts`.
- **chat-system is seq 10 — it INSERTS early** in the curriculum available-by-sequence ordering (after news-feed seq 9, before video-streaming seq 11). The curriculum total is 33 (unchanged); do not touch the 33 count assertions. **The registry test's "unregistered" slug must move from `chat-system` to `object-storage`.**
- **NAME-COLLISION (important):** `PresenceSequence` and `ReconnectSyncSequence` already exist (collab-editor) and are registered. Use the distinct exports `SendMessageSequence`, `OfflineDeliverySequence`, `DeliveryReceiptSequence`, `PresenceUpdateSequence`, plus `ChatArchitecture`, `ChatSystemCapacity` — all unique. Grep `mdx-components.tsx` to confirm before registering; no aliasing expected.
```
