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

export function BolaAttackSequence() {
  return (
    <Sequence
      title="Sequence: a broken object-level authorization (BOLA) attack"
      caption="The attacker is a fully authenticated, legitimate user — the token is valid, so the request passes authentication. The flaw is that the endpoint looks up the requested object by the id in the URL and returns it without ever checking that the object belongs to the caller. So swapping the attacker's own id for a victim's returns the victim's data. The fix is not stronger authentication but a per-object ownership check on every request: confirm the authenticated caller is authorized for this specific record before returning it."
      actors={[
        { id: "attacker", label: "Attacker",  kind: "external" },
        { id: "api",      label: "API",       kind: "service" },
        { id: "db",       label: "Database",  kind: "store" },
      ]}
      steps={[
        { from: "attacker", to: "api", label: "GET /accounts/1001 (own, valid token)", variant: "control" },
        { from: "api",      to: "db",  label: "load record 1001",                      variant: "redirect" },
        { from: "db",       to: "attacker", label: "own account — fine",               variant: "redirect", reply: true },
        { from: "attacker", to: "api", label: "GET /accounts/1002 (not theirs)",       variant: "control" },
        { from: "api",      to: "db",  label: "load record 1002 — no owner check",     variant: "control" },
        { from: "db",       to: "attacker", label: "victim's account leaked",          variant: "create", reply: true },
      ]}
    />
  );
}

export function GatewayEnforcementSequence() {
  return (
    <Sequence
      title="Sequence: layered enforcement at the API gateway"
      caption="A well-secured API splits enforcement into two tiers. At the edge the gateway does the coarse, cheap work that applies to every request: it terminates TLS, verifies the bearer token, checks the rate limit, and confirms the token's scope covers this route — rejecting bad traffic before it costs the backend anything. But the gateway cannot know whether this particular caller owns this particular object, so the request is forwarded to the service, which performs the object-level authorization the gateway can't. Coarse checks at the edge, ownership checks in the service — defense in depth."
      actors={[
        { id: "client",  label: "Client",       kind: "external" },
        { id: "gateway", label: "API Gateway",  kind: "service" },
        { id: "service", label: "Service",      kind: "infra" },
      ]}
      steps={[
        { from: "client",  to: "gateway", label: "request + bearer token",          variant: "control" },
        { from: "gateway", to: "gateway", label: "verify token, rate limit, scope", variant: "control" },
        { from: "gateway", to: "service", label: "forward allowed request",         variant: "redirect" },
        { from: "service", to: "service", label: "object-level ownership check",    variant: "control" },
        { from: "service", to: "client",  label: "authorized response",            variant: "create", reply: true },
      ]}
    />
  );
}
