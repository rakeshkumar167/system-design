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

export function CacheHitSequence() {
  return (
    <Sequence
      title="Sequence: cache hit — value served directly from the owning shard"
      caption="A cache hit is one hop: the router hashes the key to the owning shard, the node returns the value from memory in sub-millisecond time. No backing store contact is made. A high hit ratio is the cache's entire reason to exist — it shields the slow store from the bulk of reads."
      actors={[
        { id: "client",      label: "Client",       kind: "infra" },
        { id: "cacheRouter", label: "Cache Router",  kind: "service" },
        { id: "cacheNode",   label: "Cache Node",    kind: "cache" },
      ]}
      steps={[
        { from: "client",      to: "cacheRouter", label: "GET key",                                    variant: "ingress" },
        { from: "cacheRouter", to: "cacheNode",   label: "route to owning shard (ring lookup)",        variant: "redirect" },
        { from: "cacheNode",   to: "cacheNode",   label: "key found in memory (TTL still valid)",      variant: "redirect" },
        { from: "cacheNode",   to: "cacheRouter", label: "value returned (sub-ms)",                    variant: "redirect", reply: true },
        { from: "cacheRouter", to: "client",      label: "value forwarded to caller",                  variant: "redirect", reply: true },
      ]}
    />
  );
}

export function CacheMissSequence() {
  return (
    <Sequence
      title="Sequence: cache miss — read-through to backing store, then populate"
      caption="On a cache miss the owning node fetches the value from the durable backing store (read-through), stores it with a TTL, and returns it to the caller. The next read for that key will find it in memory. TTL jitter prevents a wave of simultaneous expirations causing a thundering herd."
      actors={[
        { id: "client",       label: "Client",        kind: "infra" },
        { id: "cacheNode",    label: "Cache Node",     kind: "cache" },
        { id: "backingStore", label: "Backing Store",  kind: "store" },
      ]}
      steps={[
        { from: "client",       to: "cacheNode",    label: "GET key",                                   variant: "ingress" },
        { from: "cacheNode",    to: "cacheNode",    label: "key absent — record miss",                  variant: "control" },
        { from: "cacheNode",    to: "backingStore", label: "read from backing store",                   variant: "redirect" },
        { from: "backingStore", to: "cacheNode",    label: "value returned",                            variant: "redirect", reply: true },
        { from: "cacheNode",    to: "cacheNode",    label: "populate cache entry with TTL",             variant: "create" },
        { from: "cacheNode",    to: "client",       label: "value returned to caller",                  variant: "redirect", reply: true },
      ]}
    />
  );
}

export function NodeRebalanceSequence() {
  return (
    <Sequence
      title="Sequence: node rebalance — ring reassigns only the failed node's key arc"
      caption="Consistent hashing means a node failure moves only that node's slice of the key ring to the successor node — the rest of the keyspace is undisturbed. Keys in the reassigned arc reload from the backing store on their next access (lazy warm-up). Virtual nodes spread the load evenly across the ring so no single successor is overwhelmed."
      actors={[
        { id: "membership",  label: "Membership",    kind: "service" },
        { id: "cacheRouter", label: "Cache Router",  kind: "service" },
        { id: "cacheNodes",  label: "Cache Nodes",   kind: "cache" },
      ]}
      steps={[
        { from: "cacheNodes",  to: "membership",  label: "heartbeat timeout detected — node failure",       variant: "control" },
        { from: "membership",  to: "membership",  label: "remove failed node from ring membership",         variant: "control" },
        { from: "membership",  to: "cacheRouter", label: "ring update: reassign arc to successor node",     variant: "control" },
        { from: "cacheRouter", to: "cacheRouter", label: "update local routing table",                     variant: "create" },
        { from: "cacheRouter", to: "cacheNodes",  label: "subsequent requests for arc keys route to successor", variant: "redirect" },
        { from: "cacheNodes",  to: "cacheNodes",  label: "arc keys reload from backing store on next access (lazy)", variant: "create" },
      ]}
    />
  );
}

export function StampedeSequence() {
  return (
    <Sequence
      title="Sequence: stampede protection — request coalescing collapses concurrent GETs"
      caption="Request coalescing (single-flight) collapses a thundering herd into one backing-store load: when a hot key expires and many concurrent GETs arrive simultaneously, the cache node issues only one read to the store and holds the other requests in a wait queue. When the single load completes, all waiters receive the result. TTL jitter spreads expiry times across the keyspace to prevent coordinated expiration waves."
      actors={[
        { id: "clients",      label: "Clients (many)", kind: "infra" },
        { id: "cacheNode",    label: "Cache Node",     kind: "cache" },
        { id: "backingStore", label: "Backing Store",  kind: "store" },
      ]}
      steps={[
        { from: "clients",      to: "cacheNode",    label: "many concurrent GETs — hot key just expired",   variant: "ingress" },
        { from: "cacheNode",    to: "cacheNode",    label: "coalesce: queue waiters, issue single-flight",   variant: "control" },
        { from: "cacheNode",    to: "backingStore", label: "one backing-store load (not N loads)",           variant: "redirect" },
        { from: "backingStore", to: "cacheNode",    label: "value returned",                                 variant: "redirect", reply: true },
        { from: "cacheNode",    to: "cacheNode",    label: "populate cache with TTL + jitter",               variant: "create" },
        { from: "cacheNode",    to: "clients",      label: "all waiters receive result (fan-out)",           variant: "async", reply: true },
      ]}
    />
  );
}
