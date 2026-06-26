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

export function ProxyRequestSequence() {
  return (
    <Sequence
      title="Sequence: proxy a request through the gateway"
      caption="The happy path runs the full filter chain — authenticate the token (served from the local cache), check the rate-limit counter, match the route, then forward to the upstream and relay the response back. The gateway adds only a few milliseconds of overhead; the rest of the latency budget belongs to the backend."
      actors={[
        { id: "client",      label: "Client",       kind: "infra" },
        { id: "gateway",     label: "Gateway",      kind: "service" },
        { id: "authService", label: "Auth Service", kind: "service" },
        { id: "backend",     label: "Backend",      kind: "service" },
      ]}
      steps={[
        { from: "client",      to: "gateway",     label: "send request with bearer token",              variant: "ingress" },
        { from: "gateway",     to: "authService", label: "verify JWT (cache hit)",                      variant: "create" },
        { from: "authService", to: "gateway",     label: "token valid",                                 variant: "redirect", reply: true },
        { from: "gateway",     to: "gateway",     label: "check rate limit — under quota",              variant: "control" },
        { from: "gateway",     to: "gateway",     label: "match route to upstream",                     variant: "redirect" },
        { from: "gateway",     to: "backend",     label: "forward request to upstream",                 variant: "redirect" },
        { from: "backend",     to: "gateway",     label: "upstream response",                           variant: "redirect", reply: true },
        { from: "gateway",     to: "client",      label: "relay response to caller",                    variant: "redirect", reply: true },
      ]}
    />
  );
}

export function AuthRejectSequence() {
  return (
    <Sequence
      title="Sequence: reject an unauthorized request at the edge"
      caption="Invalid or over-limit requests are rejected at the edge before any backend is touched — the gateway protects upstreams by failing early. A missing or expired token returns 401; an exceeded quota returns 429. In both cases the filter chain short-circuits immediately, keeping backend load isolated from abuse or credential failures."
      actors={[
        { id: "client",      label: "Client",       kind: "infra" },
        { id: "gateway",     label: "Gateway",      kind: "service" },
        { id: "authService", label: "Auth Service", kind: "service" },
      ]}
      steps={[
        { from: "client",      to: "gateway",     label: "send request with missing / invalid token",   variant: "ingress" },
        { from: "gateway",     to: "authService", label: "validate bearer token",                       variant: "create" },
        { from: "authService", to: "gateway",     label: "token invalid or not found",                  variant: "control", reply: true },
        { from: "gateway",     to: "client",      label: "401 Unauthorized — short-circuit, no backend reached", variant: "control", reply: true },
      ]}
    />
  );
}

export function ConfigPushSequence() {
  return (
    <Sequence
      title="Sequence: push new config to the data plane"
      caption="The control plane validates, versions, and pushes config to the stateless data plane, which hot-reloads it — routing and policy change without redeploying the proxies. The config store holds the versioned history so any gateway instance can re-sync after a restart or a missed push."
      actors={[
        { id: "operator",     label: "Operator",      kind: "infra" },
        { id: "controlPlane", label: "Control Plane", kind: "service" },
        { id: "configStore",  label: "Config Store",  kind: "store" },
        { id: "gateway",      label: "Gateway",       kind: "service" },
      ]}
      steps={[
        { from: "operator",     to: "controlPlane", label: "submit route / policy change",              variant: "ingress" },
        { from: "controlPlane", to: "controlPlane", label: "validate and version the config",           variant: "create" },
        { from: "controlPlane", to: "configStore",  label: "persist new versioned config",              variant: "create" },
        { from: "configStore",  to: "controlPlane", label: "write acknowledged",                        variant: "redirect", reply: true },
        { from: "controlPlane", to: "gateway",      label: "push versioned config delta",               variant: "async" },
        { from: "gateway",      to: "gateway",      label: "hot-reload config without dropping connections", variant: "redirect" },
      ]}
    />
  );
}

export function CircuitBreakSequence() {
  return (
    <Sequence
      title="Sequence: trip the circuit breaker on a failing upstream"
      caption="When an upstream is unhealthy the circuit breaker opens so the gateway fails fast instead of piling onto a sick backend, protecting it from cascading load. After a cooldown the gateway sends a single probe request; a healthy response closes the circuit and normal traffic resumes."
      actors={[
        { id: "client",  label: "Client",  kind: "infra" },
        { id: "gateway", label: "Gateway", kind: "service" },
        { id: "backend", label: "Backend", kind: "service" },
      ]}
      steps={[
        { from: "client",  to: "gateway", label: "send request to upstream",                          variant: "ingress" },
        { from: "gateway", to: "backend", label: "forward request",                                   variant: "redirect" },
        { from: "backend", to: "gateway", label: "timeout / 5xx error",                               variant: "control", reply: true },
        { from: "gateway", to: "gateway", label: "increment failure counter — threshold crossed, open circuit", variant: "control" },
        { from: "client",  to: "gateway", label: "subsequent request arrives",                        variant: "ingress" },
        { from: "gateway", to: "client",  label: "fail fast — circuit open, no backend call made",    variant: "control", reply: true },
        { from: "gateway", to: "backend", label: "probe trial request after cooldown",                variant: "redirect" },
        { from: "backend", to: "gateway", label: "healthy response",                                  variant: "redirect", reply: true },
        { from: "gateway", to: "gateway", label: "close circuit — backend healthy again",             variant: "redirect" },
      ]}
    />
  );
}
