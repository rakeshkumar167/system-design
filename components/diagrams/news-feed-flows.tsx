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

export function PublishFanoutSequence() {
  return (
    <Sequence
      title="Sequence: publish a post and fan it out"
      caption="The write path: a post is stored once in the post store, then the Fan-out Service asynchronously enqueues per-follower jobs; Fan-out Workers look up the author's followers and push the post ID into each follower's precomputed feed in the Feed Cache. Fan-out jobs are idempotent so workers can safely retry on failure."
      actors={[
        { id: "client",       label: "Client",           kind: "external" },
        { id: "postService",  label: "Post Service",     kind: "service" },
        { id: "fanoutWorker", label: "Fan-out Worker",   kind: "service" },
        { id: "feedCache",    label: "Feed Cache",       kind: "cache" },
      ]}
      steps={[
        { from: "client",       to: "postService",  label: "create post",                          variant: "ingress" },
        { from: "postService",  to: "postService",  label: "store post content in post store",     variant: "create" },
        { from: "postService",  to: "fanoutWorker", label: "enqueue fan-out job (async)",          variant: "async" },
        { from: "fanoutWorker", to: "fanoutWorker", label: "look up author's followers",           variant: "control" },
        { from: "fanoutWorker", to: "feedCache",    label: "push post ID to each follower's feed", variant: "create" },
      ]}
    />
  );
}

export function ReadFeedSequence() {
  return (
    <Sequence
      title="Sequence: read a precomputed feed"
      caption="The read path: the Feed Service reads the precomputed list of post IDs from the Feed Cache in a single lookup (O(1) — the payoff for fan-out-on-write precomputation), hydrates full post content from the Post Store, and returns a ranked page to the client."
      actors={[
        { id: "client",      label: "Client",       kind: "external" },
        { id: "feedService", label: "Feed Service", kind: "service" },
        { id: "feedCache",   label: "Feed Cache",   kind: "cache" },
        { id: "postStore",   label: "Post Store",   kind: "store" },
      ]}
      steps={[
        { from: "client",      to: "feedService", label: "request feed page",              variant: "ingress" },
        { from: "feedService", to: "feedCache",   label: "read precomputed post IDs",      variant: "redirect" },
        { from: "feedCache",   to: "feedService", label: "return post ID list",             variant: "redirect", reply: true },
        { from: "feedService", to: "postStore",   label: "fetch post content (hydrate)",   variant: "redirect" },
        { from: "postStore",   to: "feedService", label: "return post objects",             variant: "redirect", reply: true },
        { from: "feedService", to: "client",      label: "return ranked feed page",        variant: "redirect", reply: true },
      ]}
    />
  );
}

export function HybridMergeSequence() {
  return (
    <Sequence
      title="Sequence: merge a hybrid feed for a hot-user follow"
      caption="For a follower of a high-fan-out (celebrity) account, pure fan-out-on-write would generate millions of writes per post. The hybrid model keeps hot accounts out of the push pipeline: at read time the Feed Service pulls their recent posts from the Post Store and merges them with the precomputed pushed feed before ranking — keeping write amplification bounded while still delivering a complete feed."
      actors={[
        { id: "feedService", label: "Feed Service", kind: "service" },
        { id: "feedCache",   label: "Feed Cache",   kind: "cache" },
        { id: "postStore",   label: "Post Store",   kind: "store" },
      ]}
      steps={[
        { from: "feedService", to: "feedCache",   label: "read pushed precomputed feed",             variant: "redirect" },
        { from: "feedCache",   to: "feedService", label: "return precomputed post IDs",              variant: "redirect", reply: true },
        { from: "feedService", to: "postStore",   label: "pull hot account's recent posts",          variant: "control" },
        { from: "postStore",   to: "feedService", label: "return recent posts of hot account",       variant: "redirect", reply: true },
        { from: "feedService", to: "feedService", label: "merge + rank pushed and pulled results",   variant: "control" },
      ]}
    />
  );
}

export function FeedRankingSequence() {
  return (
    <Sequence
      title="Sequence: feed ranking by relevance"
      caption="Candidate posts are scored by relevance signals — affinity (how closely the viewer follows the author), recency (age of the post), and predicted engagement (like/share probability) — then ordered so the highest-scoring posts surface at the top, producing a ranked rather than purely chronological feed."
      actors={[
        { id: "feedService", label: "Feed Service", kind: "service" },
        { id: "postStore",   label: "Post Store",   kind: "store" },
      ]}
      steps={[
        { from: "feedService", to: "postStore",   label: "fetch candidate posts",                              variant: "redirect" },
        { from: "postStore",   to: "feedService", label: "return candidate posts",                             variant: "redirect", reply: true },
        { from: "feedService", to: "feedService", label: "score by affinity + recency + engagement",          variant: "control" },
        { from: "feedService", to: "feedService", label: "order by relevance score, return top-N",            variant: "control" },
      ]}
    />
  );
}
