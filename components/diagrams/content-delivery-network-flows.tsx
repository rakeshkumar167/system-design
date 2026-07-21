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

export function EdgeRequestRoutingSequence() {
  return (
    <Sequence
      title="Sequence: route a request to the nearest edge"
      caption="Anycast, or a GeoDNS resolver, steers each user to the nearest healthy edge, routing around a failed PoP without the user ever noticing. The same IP address (or hostname) resolves to different physical edges depending on where in the world the request originates and which of those edges are currently healthy, so a regional outage simply drops out of the routing pool."
      actors={[
        { id: "user",    label: "User",              kind: "external" },
        { id: "routing", label: "Anycast / GeoDNS",   kind: "infra" },
        { id: "edge",    label: "Edge PoP",           kind: "cache" },
      ]}
      steps={[
        { from: "user",    to: "routing", label: "request content",            variant: "ingress" },
        { from: "routing", to: "routing", label: "pick nearest healthy PoP",   variant: "control" },
        { from: "routing", to: "edge",    label: "route to edge",              variant: "redirect" },
        { from: "edge",    to: "user",    label: "connection established",     variant: "redirect", reply: true },
      ]}
    />
  );
}

export function EdgeCacheLookupSequence() {
  return (
    <Sequence
      title="Sequence: look up an object at the edge cache"
      caption="On a hit the edge serves the object straight out of local cache and the origin never learns the request happened. Only on a miss does the edge reach back for the object, and it stores what it fetched with a TTL so the next nearby request is served locally — the hit ratio, not raw capacity, is what actually offloads the origin."
      actors={[
        { id: "client", label: "Client",     kind: "external" },
        { id: "edge",   label: "Edge Cache", kind: "cache" },
        { id: "origin", label: "Origin",     kind: "store" },
      ]}
      steps={[
        { from: "client", to: "edge",   label: "GET object",                variant: "ingress" },
        { from: "edge",   to: "edge",   label: "cache key lookup",          variant: "control" },
        { from: "edge",   to: "origin", label: "miss → fetch origin",       variant: "control" },
        { from: "origin", to: "edge",  label: "object (200)",              variant: "create", reply: true },
        { from: "edge",   to: "edge",   label: "store with TTL",            variant: "create" },
        { from: "edge",   to: "client", label: "serve (hit next time)",     variant: "redirect", reply: true },
      ]}
    />
  );
}

export function OriginShieldSequence() {
  return (
    <Sequence
      title="Sequence: an origin shield absorbs concurrent edge misses"
      caption="Request coalescing at an origin shield collapses a thundering herd of concurrent misses into one origin fetch. Two different edges miss on the same freshly-expired object at nearly the same instant; the shield recognizes the second miss as a duplicate of the in-flight first, waits for the one origin response, and fans it back out to both waiting edges instead of doubling the origin's load."
      actors={[
        { id: "edgeA",  label: "Edge A",        kind: "cache" },
        { id: "edgeB",  label: "Edge B",        kind: "cache" },
        { id: "shield", label: "Origin Shield", kind: "cache" },
        { id: "origin", label: "Origin",        kind: "store" },
      ]}
      steps={[
        { from: "edgeA",  to: "shield", label: "miss",                  variant: "control" },
        { from: "edgeB",  to: "shield", label: "miss (same key)",       variant: "control" },
        { from: "shield", to: "origin", label: "single fetch",          variant: "control" },
        { from: "origin", to: "shield", label: "object",                variant: "create", reply: true },
        { from: "shield", to: "edgeA",  label: "fill",                  variant: "redirect", reply: true },
        { from: "shield", to: "edgeB",  label: "fill",                  variant: "redirect", reply: true },
      ]}
    />
  );
}

export function CacheInvalidationSequence() {
  return (
    <Sequence
      title="Sequence: invalidate stale content across the edge"
      caption="A purge propagates from the control plane to every edge to invalidate stale content. This push is necessary because a TTL alone can't react to an out-of-band content change; versioned, immutable URLs avoid invalidation entirely, since a new version simply gets a new URL and the old one just ages out."
      actors={[
        { id: "publisher", label: "Publisher",     kind: "external" },
        { id: "control",   label: "Control Plane", kind: "service" },
        { id: "edge",      label: "Edge PoP",      kind: "cache" },
      ]}
      steps={[
        { from: "publisher", to: "control", label: "content changed → purge",  variant: "control" },
        { from: "control",   to: "edge",    label: "propagate purge",          variant: "async" },
        { from: "edge",      to: "edge",    label: "evict stale entry",        variant: "control" },
        { from: "edge",      to: "control", label: "purged",                   variant: "redirect", reply: true },
      ]}
    />
  );
}
