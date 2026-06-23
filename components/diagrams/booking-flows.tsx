import {
  DiagramDefs,
  edgeColors,
  type EdgeVariant,
  type NodeKind,
} from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

interface Actor {
  id: string;
  label: string;
  kind: NodeKind;
}

interface Step {
  from: string;
  to: string;
  label: string;
  variant: EdgeVariant;
  /** Dashed return / response message. */
  reply?: boolean;
}

const MARGIN = 24;
const ACTOR_W = 150;
const GAP = 46;
const HEAD_Y = 18;
const HEAD_H = 44;
const FIRST_STEP_Y = 96;
const STEP_DY = 46;

const actorColor: Record<NodeKind, { fill: string; stroke: string }> = {
  infra:    { fill: "var(--surface-2)",   stroke: "var(--border-strong)" },
  service:  { fill: "var(--accent-soft)", stroke: "var(--accent)" },
  store:    { fill: "var(--surface)",     stroke: "var(--fundamentals)" },
  cache:    { fill: "var(--surface)",     stroke: "var(--success)" },
  queue:    { fill: "var(--surface)",     stroke: "var(--advanced)" },
  external: { fill: "var(--surface)",     stroke: "var(--warning)" },
};

function Sequence({
  title,
  caption,
  actors,
  steps,
}: {
  title: string;
  caption: string;
  actors: Actor[];
  steps: Step[];
}) {
  const centerX = (i: number) => MARGIN + i * (ACTOR_W + GAP) + ACTOR_W / 2;
  const indexOf = (id: string) => actors.findIndex((a) => a.id === id);
  const width = MARGIN * 2 + actors.length * ACTOR_W + (actors.length - 1) * GAP;
  const lifelineBottom = FIRST_STEP_Y + steps.length * STEP_DY - 12;
  const height = lifelineBottom + 28;

  return (
    <DiagramFrame title={title} caption={caption} viewBox={`0 0 ${width} ${height}`}>
      <DiagramDefs />

      {/* Lifelines + actor headers */}
      {actors.map((a, i) => {
        const cx = centerX(i);
        const c = actorColor[a.kind];
        return (
          <g key={a.id}>
            <line
              x1={cx}
              y1={HEAD_Y + HEAD_H}
              x2={cx}
              y2={lifelineBottom}
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <rect
              x={cx - ACTOR_W / 2}
              y={HEAD_Y}
              width={ACTOR_W}
              height={HEAD_H}
              rx={9}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth={1.5}
              strokeDasharray={a.kind === "external" ? "5 4" : undefined}
            />
            <text
              x={cx}
              y={HEAD_Y + HEAD_H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Messages */}
      {steps.map((s, i) => {
        const y = FIRST_STEP_Y + i * STEP_DY;
        const fi = indexOf(s.from);
        const ti = indexOf(s.to);
        const color = edgeColors[s.variant];

        if (fi === ti) {
          const cx = centerX(fi);
          return (
            <g key={i}>
              <path
                d={`M${cx},${y} h36 v18 h-36`}
                fill="none"
                stroke={color}
                strokeWidth={1.75}
                markerEnd={`url(#arrow-${s.variant})`}
              />
              <StepLabel x={cx + 46} y={y + 2} n={i + 1} text={s.label} color={color} anchor="start" />
            </g>
          );
        }

        const x1 = centerX(fi);
        const x2 = centerX(ti);
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y}
              x2={x2 + (x2 > x1 ? -1 : 1)}
              y2={y}
              stroke={color}
              strokeWidth={1.75}
              strokeDasharray={s.reply ? "5 4" : undefined}
              markerEnd={`url(#arrow-${s.variant})`}
            />
            <StepLabel
              x={(x1 + x2) / 2}
              y={y - 7}
              n={i + 1}
              text={s.label}
              color={color}
              anchor="middle"
            />
            <circle cx={x1} cy={y} r={2.5} fill={color} />
          </g>
        );
      })}
    </DiagramFrame>
  );
}

function StepLabel({
  x,
  y,
  n,
  text,
  color,
  anchor,
}: {
  x: number;
  y: number;
  n: number;
  text: string;
  color: string;
  anchor: "start" | "middle";
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
      <tspan style={{ fill: color, fontSize: 10, fontWeight: 700 }}>{n}. </tspan>
      <tspan style={{ fill: "var(--ink)", fontSize: 11 }}>{text}</tspan>
    </text>
  );
}

export function HoldSeatSequence() {
  return (
    <Sequence
      title="Sequence: hold seat — atomic conditional update"
      caption="A seat hold is a single atomic conditional update: UPDATE seat SET status='held', version=version+1, held_until=now()+TTL WHERE id=? AND status='available'. Exactly one row is affected if the seat was available; zero rows means someone else got there first. The Booking Service returns 201 with the hold and its expiry timestamp. The hold is the reservation — it is never just a read followed by a write."
      actors={[
        { id: "client",  label: "Client",          kind: "infra" },
        { id: "booking", label: "Booking Service", kind: "service" },
        { id: "inv",     label: "Inventory DB",    kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "booking", label: "POST /v1/holds {event_id, seat_id}",                              variant: "create" },
        { from: "booking", to: "inv",     label: "UPDATE seat … WHERE status='available' (atomic conditional)",     variant: "create" },
        { from: "inv",     to: "booking", label: "1 row updated — seat held",                                       variant: "redirect", reply: true },
        { from: "booking", to: "client",  label: "201 Created {hold_id, held_until}",                              variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ContentionSequence() {
  return (
    <Sequence
      title="Sequence: seat contention — one winner, one 409 Conflict"
      caption="When two users target the same seat simultaneously, the Inventory DB serializes their conditional updates. User A's update matches the available row and succeeds; User B's identical update now finds zero matching rows (the seat is no longer available) and returns nothing. The Booking Service translates zero rows updated into a 409 Conflict response. Exactly one buyer wins the seat; the other is rejected instantly with no partial state — the no-oversell invariant is maintained at the database level."
      actors={[
        { id: "userA", label: "User A",       kind: "infra" },
        { id: "userB", label: "User B",       kind: "infra" },
        { id: "inv",   label: "Inventory DB", kind: "store" },
      ]}
      steps={[
        { from: "userA", to: "inv",   label: "conditional UPDATE seat WHERE status='available'", variant: "create" },
        { from: "userB", to: "inv",   label: "conditional UPDATE seat WHERE status='available'", variant: "create" },
        { from: "inv",   to: "userA", label: "1 row updated — A wins the seat",                 variant: "redirect", reply: true },
        { from: "inv",   to: "userB", label: "0 rows updated — seat already held",              variant: "control",  reply: true },
        { from: "userB", to: "userB", label: "return 409 Conflict to User B",                   variant: "control" },
      ]}
    />
  );
}

export function ConfirmPaymentSequence() {
  return (
    <Sequence
      title="Sequence: confirm booking — payment saga"
      caption="Confirming a booking is a three-step saga: charge the payment provider, then flip the seat from held to booked in the Inventory DB, then write the permanent booking record. An idempotency key on POST /v1/bookings makes the entire saga safe to retry — if the client retries after a timeout, the Booking Service detects the duplicate key and returns the original result without re-charging. The saga is committed only after payment succeeds; a payment failure leaves the hold in place (the user may retry) while a confirmed booking is permanent."
      actors={[
        { id: "client",  label: "Client",          kind: "infra" },
        { id: "booking", label: "Booking Service", kind: "service" },
        { id: "payment", label: "Payment",         kind: "external" },
        { id: "inv",     label: "Inventory DB",    kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "booking", label: "POST /v1/bookings {hold_id, idempotency_key}",           variant: "create" },
        { from: "booking", to: "payment", label: "charge card — idempotent payment request",               variant: "create" },
        { from: "payment", to: "booking", label: "payment_id — charge succeeded",                          variant: "redirect", reply: true },
        { from: "booking", to: "inv",     label: "UPDATE seat SET status='booked' WHERE hold_id=? AND status='held'", variant: "create" },
        { from: "inv",     to: "booking", label: "1 row updated — seat confirmed",                         variant: "redirect", reply: true },
        { from: "booking", to: "client",  label: "201 Created {booking_id, payment_id}",                   variant: "redirect", reply: true },
      ]}
    />
  );
}

export function HoldExpirySequence() {
  return (
    <Sequence
      title="Sequence: hold expiry — releasing unpaid holds"
      caption="Unpaid holds must expire and be released, or seats become permanently unsellable. The Hold Expiry Worker runs on a short interval and queries the Inventory DB for held seats whose held_until timestamp has passed. For each expired hold it issues a conditional update reverting status to available. This ensures the seat inventory self-heals: a buyer who abandons checkout does not permanently remove a seat from sale. The release is idempotent — a seat already available (e.g. released by an earlier sweep) is simply skipped."
      actors={[
        { id: "worker", label: "Hold Expiry Worker", kind: "queue" },
        { id: "inv",    label: "Inventory DB",       kind: "store" },
      ]}
      steps={[
        { from: "worker", to: "worker", label: "TTL sweep interval fires",                                   variant: "control" },
        { from: "worker", to: "inv",    label: "SELECT * FROM seats WHERE status='held' AND held_until < now()", variant: "redirect" },
        { from: "inv",    to: "worker", label: "expired hold rows",                                          variant: "redirect", reply: true },
        { from: "worker", to: "inv",    label: "UPDATE seat SET status='available' WHERE hold_id=? AND status='held'", variant: "control" },
        { from: "inv",    to: "worker", label: "rows released — available again",                            variant: "control", reply: true },
      ]}
    />
  );
}
