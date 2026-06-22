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
  infra: { fill: "var(--surface-2)", stroke: "var(--border-strong)" },
  service: { fill: "var(--accent-soft)", stroke: "var(--accent)" },
  store: { fill: "var(--surface)", stroke: "var(--fundamentals)" },
  cache: { fill: "var(--surface)", stroke: "var(--success)" },
  queue: { fill: "var(--surface)", stroke: "var(--advanced)" },
  external: { fill: "var(--surface)", stroke: "var(--warning)" },
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
          // Self-call loop
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

export function CreateUrlSequence() {
  return (
    <Sequence
      title="Sequence: creating a short URL"
      caption="The write service validates the URL, reserves a unique Base62 key from the ID generator, persists the mapping, and returns the short URL. Abuse scanning runs asynchronously and does not block the response."
      actors={[
        { id: "client", label: "Client", kind: "infra" },
        { id: "write", label: "Write Service", kind: "service" },
        { id: "id", label: "ID Generator", kind: "service" },
        { id: "store", label: "Mapping Store", kind: "store" },
      ]}
      steps={[
        { from: "client", to: "write", label: "POST /urls {longUrl}", variant: "create" },
        { from: "write", to: "id", label: "reserve next id", variant: "create" },
        { from: "id", to: "write", label: "id → Base62 code", variant: "create", reply: true },
        { from: "write", to: "store", label: "put(code, longUrl)", variant: "create" },
        { from: "store", to: "write", label: "ok", variant: "create", reply: true },
        { from: "write", to: "client", label: "201 {shortUrl}", variant: "create", reply: true },
      ]}
    />
  );
}

export function RedirectCacheHitSequence() {
  return (
    <Sequence
      title="Sequence: redirect on a cache hit"
      caption="The common case. The redirect service finds the mapping in cache and returns a 301/302 immediately. A click event is emitted asynchronously, so analytics never adds latency to the redirect."
      actors={[
        { id: "client", label: "Client", kind: "infra" },
        { id: "redirect", label: "Redirect Service", kind: "service" },
        { id: "cache", label: "Cache", kind: "cache" },
        { id: "stream", label: "Event Stream", kind: "queue" },
      ]}
      steps={[
        { from: "client", to: "redirect", label: "GET /{code}", variant: "redirect" },
        { from: "redirect", to: "cache", label: "get(code)", variant: "redirect" },
        { from: "cache", to: "redirect", label: "hit → longUrl", variant: "redirect", reply: true },
        { from: "redirect", to: "client", label: "301/302 Location", variant: "redirect", reply: true },
        { from: "redirect", to: "stream", label: "emit click (async)", variant: "async" },
      ]}
    />
  );
}

export function RedirectCacheMissSequence() {
  return (
    <Sequence
      title="Sequence: redirect on a cache miss"
      caption="On a miss the redirect service reads the mapping store, backfills the cache with a TTL, and then responds. A negative cache entry for unknown codes prevents repeated misses from stampeding the store."
      actors={[
        { id: "client", label: "Client", kind: "infra" },
        { id: "redirect", label: "Redirect Service", kind: "service" },
        { id: "cache", label: "Cache", kind: "cache" },
        { id: "store", label: "Mapping Store", kind: "store" },
      ]}
      steps={[
        { from: "client", to: "redirect", label: "GET /{code}", variant: "redirect" },
        { from: "redirect", to: "cache", label: "get(code)", variant: "redirect" },
        { from: "cache", to: "redirect", label: "miss", variant: "control", reply: true },
        { from: "redirect", to: "store", label: "get(code)", variant: "redirect" },
        { from: "store", to: "redirect", label: "longUrl", variant: "redirect", reply: true },
        { from: "redirect", to: "cache", label: "set(code, ttl)", variant: "redirect" },
        { from: "redirect", to: "client", label: "301/302 Location", variant: "redirect", reply: true },
      ]}
    />
  );
}

export function AnalyticsSequence() {
  return (
    <Sequence
      title="Sequence: recording click analytics asynchronously"
      caption="Click events are buffered on the event stream and consumed by an analytics worker that aggregates and writes to the analytics store. This path is fully decoupled: if it lags or fails, redirects are unaffected and events are replayed when it recovers."
      actors={[
        { id: "redirect", label: "Redirect Service", kind: "service" },
        { id: "stream", label: "Event Stream", kind: "queue" },
        { id: "worker", label: "Analytics Worker", kind: "service" },
        { id: "olap", label: "Analytics Store", kind: "store" },
      ]}
      steps={[
        { from: "redirect", to: "stream", label: "append click event", variant: "async" },
        { from: "stream", to: "worker", label: "consume batch", variant: "async" },
        { from: "worker", to: "worker", label: "aggregate by code", variant: "async" },
        { from: "worker", to: "olap", label: "upsert counts", variant: "async" },
        { from: "worker", to: "stream", label: "commit offset", variant: "async", reply: true },
      ]}
    />
  );
}
