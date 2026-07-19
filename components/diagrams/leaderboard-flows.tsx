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

export function SubmitScoreSequence() {
  return (
    <Sequence
      title="Sequence: submit a score update"
      caption="A score submission updates the in-memory sorted set synchronously with an O(log N) ZINCRBY, then records the change durably by emitting an event to the stream that a consumer writes to the score database — the client gets a fast acknowledgement while durability happens off the hot path. Writing the index in memory and the source of truth asynchronously is what keeps updates cheap at high volume."
      actors={[
        { id: "client",  label: "Game Client",       kind: "external" },
        { id: "service", label: "Leaderboard Svc",    kind: "service" },
        { id: "zset",    label: "Sorted Set",         kind: "store" },
        { id: "stream",  label: "Score Stream",       kind: "queue" },
        { id: "db",      label: "Score DB",           kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "service", label: "submit score (+delta)",     variant: "ingress" },
        { from: "service", to: "zset",    label: "ZINCRBY player, delta",     variant: "create" },
        { from: "zset",    to: "service", label: "new score — O(log N)",      variant: "redirect", reply: true },
        { from: "service", to: "stream",  label: "emit score event",          variant: "async" },
        { from: "stream",  to: "db",      label: "persist durably",           variant: "create" },
        { from: "service", to: "client",  label: "202 accepted",              variant: "redirect", reply: true },
      ]}
    />
  );
}

export function TopKQuerySequence() {
  return (
    <Sequence
      title="Sequence: read the top-K leaderboard"
      caption="The most popular and most shared query — the global top ten — is served from a cache in front of the service; on a miss it is a single ZREVRANGE over the sorted set, an O(log N + K) range read from the highest scores. Because everyone sees the same top-K, caching it briefly absorbs the bulk of read traffic without touching the sorted set on most requests."
      actors={[
        { id: "client",  label: "Game Client",    kind: "external" },
        { id: "service", label: "Leaderboard Svc", kind: "service" },
        { id: "cache",   label: "Top-K Cache",    kind: "cache" },
        { id: "zset",    label: "Sorted Set",     kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "service", label: "GET top 10",             variant: "ingress" },
        { from: "service", to: "cache",   label: "check top-K cache",      variant: "control" },
        { from: "cache",   to: "service", label: "cache miss",             variant: "control", reply: true },
        { from: "service", to: "zset",    label: "ZREVRANGE 0 9",          variant: "redirect" },
        { from: "zset",    to: "service", label: "top 10 by score",        variant: "redirect", reply: true },
        { from: "service", to: "cache",   label: "populate cache",         variant: "create" },
        { from: "service", to: "client",  label: "ranked top 10",          variant: "redirect", reply: true },
      ]}
    />
  );
}

export function PlayerRankSequence() {
  return (
    <Sequence
      title="Sequence: look up a player's rank and neighbors"
      caption="Unlike a SQL COUNT that would scan to find how many players outrank you, a sorted set answers an arbitrary member's exact rank directly with ZREVRANK in O(log N), then a small range read around that position returns the neighbors shown beside you. Direct rank lookup for any player, not just the leaders, is the capability a plain ORDER BY cannot provide cheaply."
      actors={[
        { id: "client",  label: "Game Client",    kind: "external" },
        { id: "service", label: "Leaderboard Svc", kind: "service" },
        { id: "zset",    label: "Sorted Set",     kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "service", label: "GET rank for player",        variant: "ingress" },
        { from: "service", to: "zset",    label: "ZREVRANK player",            variant: "redirect" },
        { from: "zset",    to: "service", label: "exact rank e.g. #4,271,908", variant: "redirect", reply: true },
        { from: "service", to: "zset",    label: "ZREVRANGE around rank",      variant: "redirect" },
        { from: "zset",    to: "service", label: "neighbor players",           variant: "redirect", reply: true },
        { from: "service", to: "client",  label: "your rank + neighbors",      variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ShardedRankSequence() {
  return (
    <Sequence
      title="Sequence: compute a global rank across shards"
      caption="When the board is sharded across nodes, top-K just merges each shard's local top list, but an exact global rank needs to know how many players outscore you everywhere. The coordinator fans out a count of entries above the player's score to every shard and sums them; because doing this precisely on every request is expensive, production systems approximate the rank from precomputed score-bucket histograms instead."
      actors={[
        { id: "client", label: "Game Client",      kind: "external" },
        { id: "coord",  label: "Rank Coordinator",  kind: "service" },
        { id: "shardA", label: "Shard A",           kind: "store" },
        { id: "shardB", label: "Shard B",           kind: "store" },
      ]}
      steps={[
        { from: "client", to: "coord",  label: "rank(player, score=S)",   variant: "ingress" },
        { from: "coord",  to: "shardA", label: "ZCOUNT (S, +inf)",        variant: "control" },
        { from: "shardA", to: "coord",  label: "count above S on A",      variant: "redirect", reply: true },
        { from: "coord",  to: "shardB", label: "ZCOUNT (S, +inf)",        variant: "control" },
        { from: "shardB", to: "coord",  label: "count above S on B",      variant: "redirect", reply: true },
        { from: "coord",  to: "client", label: "global rank ≈ Σ + 1",     variant: "create", reply: true },
      ]}
    />
  );
}
