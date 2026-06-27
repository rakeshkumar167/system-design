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

export function SendMessageSequence() {
  return (
    <Sequence
      title="Sequence: send a message to an online recipient"
      caption="The online path: the message is persisted to the message store, the session registry is consulted to find the recipient's gateway, and the message is routed there for a real-time push to the recipient's open connection. The entire round trip from socket send to push delivery is sub-100ms for co-located gateways."
      actors={[
        { id: "sender",          label: "Sender",           kind: "external" },
        { id: "gateway",         label: "Gateway",          kind: "service" },
        { id: "messageService",  label: "Message Service",  kind: "service" },
        { id: "sessionRegistry", label: "Session Registry", kind: "cache" },
      ]}
      steps={[
        { from: "sender",         to: "gateway",         label: "send message over socket",          variant: "ingress" },
        { from: "gateway",        to: "messageService",  label: "forward message",                   variant: "redirect" },
        { from: "messageService", to: "messageService",  label: "persist to message store",          variant: "create" },
        { from: "messageService", to: "sessionRegistry", label: "look up recipient gateway",         variant: "control" },
        { from: "messageService", to: "gateway",         label: "route — push to recipient",         variant: "async" },
      ]}
    />
  );
}

export function OfflineDeliverySequence() {
  return (
    <Sequence
      title="Sequence: deliver to an offline recipient"
      caption="When the recipient is offline, the message service writes the message to the recipient's per-user mailbox instead of routing to a gateway. On reconnect the client syncs and drains all pending messages from the mailbox in order, then ACKs delivery so the mailbox entries can be cleared."
      actors={[
        { id: "messageService", label: "Message Service", kind: "service" },
        { id: "mailbox",        label: "Mailbox",         kind: "store" },
        { id: "recipient",      label: "Recipient",       kind: "external" },
      ]}
      steps={[
        { from: "messageService", to: "mailbox",        label: "queue message to mailbox",          variant: "create" },
        { from: "recipient",      to: "mailbox",        label: "reconnect and sync — pull pending", variant: "redirect" },
        { from: "mailbox",        to: "recipient",      label: "drain pending messages",             variant: "redirect", reply: true },
        { from: "recipient",      to: "messageService", label: "ACK delivery",                      variant: "control" },
      ]}
    />
  );
}

export function DeliveryReceiptSequence() {
  return (
    <Sequence
      title="Sequence: propagate a delivery receipt"
      caption="The recipient acknowledges delivered (and later read); the ACK flows back through the message service, which updates the sent → delivered → read state machine and propagates the receipt to the sender so their UI can show the correct tick status."
      actors={[
        { id: "recipient",      label: "Recipient",       kind: "external" },
        { id: "gateway",        label: "Gateway",         kind: "service" },
        { id: "messageService", label: "Message Service", kind: "service" },
        { id: "sender",         label: "Sender",          kind: "external" },
      ]}
      steps={[
        { from: "recipient",      to: "gateway",        label: "ACK delivered",                     variant: "control" },
        { from: "gateway",        to: "messageService", label: "forward ACK",                       variant: "redirect" },
        { from: "messageService", to: "messageService", label: "update status: sent → delivered",   variant: "control" },
        { from: "messageService", to: "gateway",        label: "propagate receipt",                 variant: "redirect" },
        { from: "gateway",        to: "sender",         label: "receipt notification",              variant: "redirect", reply: true },
      ]}
    />
  );
}

export function PresenceUpdateSequence() {
  return (
    <Sequence
      title="Sequence: broadcast a presence update"
      caption="Heartbeats keep presence fresh: each connected client periodically sends a heartbeat to its gateway, which updates the presence service. A change in online/last-seen is fanned out asynchronously to the user's subscribers (e.g. conversation partners viewing the thread). Per-event cost is low; aggregate fan-out across millions of users is the expensive part."
      actors={[
        { id: "recipient", label: "Recipient", kind: "external" },
        { id: "gateway",   label: "Gateway",   kind: "service" },
        { id: "presence",  label: "Presence",  kind: "service" },
        { id: "sender",    label: "Sender",    kind: "external" },
      ]}
      steps={[
        { from: "recipient", to: "gateway",  label: "heartbeat",                        variant: "muted" },
        { from: "gateway",   to: "presence", label: "update online / last-seen",        variant: "muted" },
        { from: "presence",  to: "presence", label: "fan out to subscribers",           variant: "async" },
        { from: "presence",  to: "gateway",  label: "push presence delta",              variant: "async" },
        { from: "gateway",   to: "sender",   label: "deliver presence update",          variant: "redirect", reply: true },
      ]}
    />
  );
}
