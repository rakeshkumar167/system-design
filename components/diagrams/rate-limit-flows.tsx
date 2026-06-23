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
  infra:    { fill: "var(--surface-2)",    stroke: "var(--border-strong)" },
  service:  { fill: "var(--accent-soft)",  stroke: "var(--accent)" },
  store:    { fill: "var(--surface)",      stroke: "var(--fundamentals)" },
  cache:    { fill: "var(--surface)",      stroke: "var(--success)" },
  queue:    { fill: "var(--surface)",      stroke: "var(--advanced)" },
  external: { fill: "var(--surface)",      stroke: "var(--warning)" },
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

export function AllowSequence() {
  return (
    <Sequence
      title="Sequence: allow — request under rate limit"
      caption="The gateway forwards the request to the limiter, which issues an atomic INCR on the counter store. Because the returned count is under the configured limit, the limiter sets the X-RateLimit-Remaining header and forwards the request to the backend, which returns 200 OK."
      actors={[
        { id: "client",  label: "Client",          kind: "infra" },
        { id: "limiter", label: "Limiter",          kind: "service" },
        { id: "store",   label: "Counter Store",    kind: "store" },
        { id: "backend", label: "Backend Service",  kind: "service" },
      ]}
      steps={[
        { from: "client",  to: "limiter",  label: "request",                      variant: "ingress" },
        { from: "limiter", to: "store",    label: "INCR key",                     variant: "create" },
        { from: "store",   to: "limiter",  label: "count ≤ limit",                variant: "redirect", reply: true },
        { from: "limiter", to: "backend",  label: "forward + X-RateLimit-Remaining", variant: "redirect" },
        { from: "backend", to: "client",   label: "200 OK",                       variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ThrottleSequence() {
  return (
    <Sequence
      title="Sequence: throttle — 429 Too Many Requests"
      caption="The limiter issues INCR and the counter store returns a count that exceeds the configured limit. The limiter short-circuits and returns 429 Too Many Requests with a Retry-After header indicating when the window resets. The backend service is never contacted."
      actors={[
        { id: "client",  label: "Client",       kind: "infra" },
        { id: "limiter", label: "Limiter",       kind: "service" },
        { id: "store",   label: "Counter Store", kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "limiter", label: "request",            variant: "ingress" },
        { from: "limiter", to: "store",   label: "INCR key",           variant: "create" },
        { from: "store",   to: "limiter", label: "count > limit",      variant: "control", reply: true },
        { from: "limiter", to: "client",  label: "429 Too Many Requests + Retry-After", variant: "control", reply: true },
      ]}
    />
  );
}

export function FailOpenSequence() {
  return (
    <Sequence
      title="Sequence: fail open — counter store timeout"
      caption="When the counter store is unreachable (timeout or connection error), the limiter fails open: it allows the request to proceed rather than blocking traffic during a dependency outage. Simultaneously it emits an alert to the observability layer so operators are notified immediately. This is the fail open behaviour — availability is preferred over strict enforcement when the enforcer itself is unavailable."
      actors={[
        { id: "client",  label: "Client",        kind: "infra" },
        { id: "limiter", label: "Limiter",        kind: "service" },
        { id: "store",   label: "Counter Store",  kind: "store" },
        { id: "backend", label: "Backend Service", kind: "service" },
        { id: "obs",     label: "Observability",  kind: "external" },
      ]}
      steps={[
        { from: "client",  to: "limiter",  label: "request",                      variant: "ingress" },
        { from: "limiter", to: "store",    label: "INCR key",                     variant: "create" },
        { from: "store",   to: "limiter",  label: "timeout / error",              variant: "control", reply: true },
        { from: "limiter", to: "backend",  label: "allow (fail open)",            variant: "control" },
        { from: "backend", to: "client",   label: "200 OK",                       variant: "redirect", reply: true },
        { from: "limiter", to: "obs",      label: "alert: store unreachable",     variant: "muted" },
      ]}
    />
  );
}
