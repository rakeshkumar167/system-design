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

export function GenerateIdSequence() {
  return (
    <Sequence
      title="Sequence: generate an id"
      caption="A node mints an id entirely on its own: it reads the current time, bumps the per-millisecond counter, and packs time, machine id, and counter into 64 bits — no coordination with any other node is needed on this path."
      actors={[
        { id: "client", label: "Client",  kind: "external" },
        { id: "node",   label: "ID Node", kind: "service" },
      ]}
      steps={[
        { from: "client", to: "node",   label: "get id",                                variant: "ingress" },
        { from: "node",   to: "node",   label: "read current ms",                        variant: "control" },
        { from: "node",   to: "node",   label: "same ms? seq++ : seq=0",                  variant: "control" },
        { from: "node",   to: "node",   label: "compose time | machine | seq (64-bit)",   variant: "create" },
        { from: "node",   to: "client", label: "id (as string)",                          variant: "redirect", reply: true },
      ]}
    />
  );
}

export function WorkerIdAssignmentSequence() {
  return (
    <Sequence
      title="Sequence: assign a worker/machine id at startup"
      caption="At startup a node claims a unique machine id from the coordinator so no two nodes ever share the machine-id bits; once assigned, the id is cached locally and the node never needs to ask again."
      actors={[
        { id: "node",  label: "ID Node",         kind: "service" },
        { id: "coord", label: "ZooKeeper / etcd", kind: "store" },
      ]}
      steps={[
        { from: "node",  to: "coord", label: "register (startup)",                variant: "ingress" },
        { from: "coord", to: "coord", label: "claim next free id (ephemeral seq)", variant: "control" },
        { from: "coord", to: "node",  label: "machine id = 7",                     variant: "create", reply: true },
        { from: "node",  to: "node",  label: "begin minting locally",              variant: "redirect" },
      ]}
    />
  );
}

export function ClockSkewSequence() {
  return (
    <Sequence
      title="Sequence: handle clock skew during id generation"
      caption="If the clock moves backwards the node waits rather than re-minting a used timestamp, so it never produces a duplicate id even after an NTP correction pushes the wall clock backwards."
      actors={[
        { id: "client", label: "Client",  kind: "external" },
        { id: "node",   label: "ID Node", kind: "service" },
      ]}
      steps={[
        { from: "client", to: "node",   label: "get id",                              variant: "ingress" },
        { from: "node",   to: "node",   label: "current ms < last ms (clock went back)", variant: "control" },
        { from: "node",   to: "node",   label: "wait until clock catches up",           variant: "control" },
        { from: "node",   to: "client", label: "id (never a reused timestamp)",         variant: "redirect", reply: true },
      ]}
    />
  );
}

export function SequenceOverflowSequence() {
  return (
    <Sequence
      title="Sequence: handle per-millisecond sequence overflow"
      caption="When the per-millisecond counter overflows the node waits for the next millisecond tick and resets the counter, which caps per-node throughput but keeps every id it produces unique."
      actors={[
        { id: "client", label: "Client",  kind: "external" },
        { id: "node",   label: "ID Node", kind: "service" },
      ]}
      steps={[
        { from: "client", to: "node",   label: "get id (4,096th this ms)",       variant: "ingress" },
        { from: "node",   to: "node",   label: "sequence exhausted for this ms", variant: "control" },
        { from: "node",   to: "node",   label: "wait for next ms tick; reset seq=0", variant: "control" },
        { from: "node",   to: "client", label: "id (next ms)",                   variant: "redirect", reply: true },
      ]}
    />
  );
}
