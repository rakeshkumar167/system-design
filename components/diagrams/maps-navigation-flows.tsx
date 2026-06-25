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

export function RouteQuerySequence() {
  return (
    <Sequence
      title="Sequence: answer a route query"
      caption="A route is answered by a bidirectional upward search over the precomputed hierarchy held in memory — settling only a few hundred nodes versus millions for plain Dijkstra. The map matcher first snaps the origin and destination coordinates to the nearest graph nodes, then the route engine reads the precomputed shortcut edges and runs the search, returning a path and ETA in milliseconds."
      actors={[
        { id: "client",     label: "Client",      kind: "infra" },
        { id: "mapMatcher", label: "Map Matcher",  kind: "service" },
        { id: "routeEngine",label: "Route Engine", kind: "service" },
        { id: "graphStore", label: "Graph Store",  kind: "store" },
      ]}
      steps={[
        { from: "client",      to: "mapMatcher",  label: "request route between two coordinates",       variant: "ingress" },
        { from: "mapMatcher",  to: "mapMatcher",  label: "snap origin + dest to nearest graph nodes",   variant: "create" },
        { from: "mapMatcher",  to: "routeEngine", label: "query path on CH hierarchy",                  variant: "create" },
        { from: "routeEngine", to: "graphStore",  label: "read precomputed shortcut edges",             variant: "redirect" },
        { from: "graphStore",  to: "routeEngine", label: "shortcut edges returned",                     variant: "redirect", reply: true },
        { from: "routeEngine", to: "routeEngine", label: "bidirectional upward CH search (~400 nodes)", variant: "redirect" },
        { from: "routeEngine", to: "mapMatcher",  label: "path + ETA",                                  variant: "redirect", reply: true },
        { from: "mapMatcher",  to: "client",      label: "route response",                              variant: "redirect", reply: true },
      ]}
    />
  );
}

export function MapMatchSequence() {
  return (
    <Sequence
      title="Sequence: map-match a GPS trace"
      caption="Map matching snaps jittery GPS points onto the most likely road path using a hidden Markov model, balancing GPS proximity against route plausibility — a GPS point close to a minor road is still mapped to the nearby highway if the transition probability favours it. Candidate segments are fetched from the graph store via a spatial index around each GPS point."
      actors={[
        { id: "device",     label: "Device",      kind: "infra" },
        { id: "mapMatcher", label: "Map Matcher",  kind: "service" },
        { id: "graphStore", label: "Graph Store",  kind: "store" },
      ]}
      steps={[
        { from: "device",     to: "mapMatcher", label: "send noisy GPS trace",                          variant: "ingress" },
        { from: "mapMatcher", to: "graphStore", label: "fetch candidate road segments nearby",          variant: "redirect" },
        { from: "graphStore", to: "mapMatcher", label: "candidate segments returned",                   variant: "redirect", reply: true },
        { from: "mapMatcher", to: "mapMatcher", label: "HMM: balance GPS proximity vs. plausibility",  variant: "create" },
        { from: "mapMatcher", to: "device",     label: "snapped road path returned",                   variant: "redirect", reply: true },
      ]}
    />
  );
}

export function TrafficUpdateSequence() {
  return (
    <Sequence
      title="Sequence: ingest traffic and re-weight"
      caption="A firehose of GPS probe pings is aggregated by the traffic pipeline into live per-segment edge times and fused with historical patterns. CRP metric customization then applies the new weights to the precomputed hierarchy without requiring a full rebuild — the metric-independent preprocessing is reused, making re-weighting cheap enough to run continuously."
      actors={[
        { id: "probes",          label: "GPS Probes",       kind: "external" },
        { id: "trafficPipeline", label: "Traffic Pipeline", kind: "queue" },
        { id: "liveWeights",     label: "Live Weights",     kind: "store" },
        { id: "routeEngine",     label: "Route Engine",     kind: "service" },
      ]}
      steps={[
        { from: "probes",          to: "trafficPipeline", label: "stream GPS pings continuously",                variant: "async" },
        { from: "trafficPipeline", to: "trafficPipeline", label: "aggregate per segment + fuse with history",    variant: "create" },
        { from: "trafficPipeline", to: "liveWeights",     label: "write updated live edge times",               variant: "create" },
        { from: "liveWeights",     to: "routeEngine",     label: "push re-customize trigger",                   variant: "control" },
        { from: "routeEngine",     to: "routeEngine",     label: "CRP metric customization with new weights",   variant: "control" },
      ]}
    />
  );
}

export function TileFetchSequence() {
  return (
    <Sequence
      title="Sequence: fetch a map tile"
      caption="Map tiles are a static z/x/y pyramid served from the CDN edge; only cache misses reach the origin tile service, so tiles scale as a caching problem. Cache hit rates are very high because tiles are immutable — the same z/x/y tile is identical for every user — making tiles the highest-volume yet cheapest-to-serve part of the system."
      actors={[
        { id: "client",      label: "Client",       kind: "infra" },
        { id: "cdn",         label: "CDN",          kind: "external" },
        { id: "tileService", label: "Tile Service",  kind: "service" },
      ]}
      steps={[
        { from: "client", to: "cdn",         label: "GET tile z/x/y",                       variant: "ingress" },
        { from: "cdn",    to: "cdn",         label: "cache hit: return tile immediately",    variant: "redirect" },
        { from: "cdn",    to: "tileService", label: "cache miss: fetch from origin",         variant: "control" },
        { from: "tileService", to: "cdn",    label: "rendered tile returned",                variant: "redirect", reply: true },
        { from: "cdn",    to: "cdn",         label: "cache tile at edge",                    variant: "create" },
        { from: "cdn",    to: "client",      label: "tile served from CDN",                  variant: "redirect", reply: true },
      ]}
    />
  );
}
