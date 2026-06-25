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

export function LogIngestSequence() {
  return (
    <Sequence
      title="Sequence: log ingest — batch, ship, buffer"
      caption="Agents batch log events and ship them to the Ingest Collector, which validates and enriches each entry before appending it to the durable buffer. The buffer decouples producers from the slow processing path so a traffic spike never backpressures the apps. Delivery is at-least-once: the agent retries if the collector does not acknowledge."
      actors={[
        { id: "service",   label: "Service + Agent",   kind: "infra" },
        { id: "collector", label: "Ingest Collector",  kind: "service" },
        { id: "buffer",    label: "Log Buffer",         kind: "queue" },
      ]}
      steps={[
        { from: "service",   to: "service",   label: "app emits log event",                         variant: "ingress" },
        { from: "service",   to: "collector", label: "agent batches and ships",                      variant: "ingress" },
        { from: "collector", to: "collector", label: "validate and enrich fields",                   variant: "create" },
        { from: "collector", to: "buffer",    label: "append to durable buffer",                     variant: "create" },
        { from: "buffer",    to: "collector", label: "ack offset committed",                         variant: "redirect", reply: true },
        { from: "collector", to: "service",   label: "ack to agent",                                 variant: "redirect", reply: true },
      ]}
    />
  );
}

export function IndexBuildSequence() {
  return (
    <Sequence
      title="Sequence: index build — consume, parse, write to hot store"
      caption="The indexer consumes log batches from the durable buffer at its own pace, parses structured fields, builds an inverted index over the entries, and writes the result to the hot store. The consumer offset is committed only after a durable write, guaranteeing at-least-once processing — if the indexer crashes mid-batch it will re-consume and re-index."
      actors={[
        { id: "buffer",   label: "Log Buffer",  kind: "queue" },
        { id: "indexer",  label: "Indexer",     kind: "service" },
        { id: "hotStore", label: "Hot Store",   kind: "store" },
      ]}
      steps={[
        { from: "indexer",  to: "buffer",   label: "consume a batch from the buffer",              variant: "redirect" },
        { from: "buffer",   to: "indexer",  label: "batch delivered",                              variant: "redirect", reply: true },
        { from: "indexer",  to: "indexer",  label: "parse fields and structured data",             variant: "create" },
        { from: "indexer",  to: "indexer",  label: "build inverted index over batch",              variant: "create" },
        { from: "indexer",  to: "hotStore", label: "write index and raw entries",                  variant: "create" },
        { from: "hotStore", to: "indexer",  label: "write confirmed",                              variant: "create", reply: true },
        { from: "indexer",  to: "buffer",   label: "commit consumer offset",                       variant: "control" },
      ]}
    />
  );
}

export function SearchQuerySequence() {
  return (
    <Sequence
      title="Sequence: search — time-bounded scatter-gather"
      caption="Queries are time-bounded: the query service prunes the request to relevant time segments, scatters to hot-tier shards for recent ranges, gathers and merges the shard results, and falls back to cold object storage only for older ranges outside the hot window. Because most queries target recent data, the cold fallback is rare and slow reads do not affect the common case."
      actors={[
        { id: "client",       label: "User / Caller",   kind: "infra" },
        { id: "queryService", label: "Query Service",   kind: "service" },
        { id: "hotStore",     label: "Hot Store",       kind: "store" },
        { id: "coldStore",    label: "Cold Store",      kind: "store" },
      ]}
      steps={[
        { from: "client",       to: "queryService", label: "query with time range",                            variant: "ingress" },
        { from: "queryService", to: "queryService", label: "prune to relevant time segments",                  variant: "redirect" },
        { from: "queryService", to: "hotStore",     label: "scatter to hot shards (recent range)",             variant: "redirect" },
        { from: "hotStore",     to: "queryService", label: "shard results",                                    variant: "redirect", reply: true },
        { from: "queryService", to: "queryService", label: "gather and merge shard results",                   variant: "redirect" },
        { from: "queryService", to: "coldStore",    label: "fall back to cold store for old ranges",           variant: "muted" },
        { from: "coldStore",    to: "queryService", label: "archived data returned (slow)",                    variant: "muted", reply: true },
        { from: "queryService", to: "client",       label: "merged results returned",                          variant: "redirect", reply: true },
      ]}
    />
  );
}

export function RetentionTierSequence() {
  return (
    <Sequence
      title="Sequence: retention — age hot data down to cold"
      caption="A lifecycle policy runs on a schedule to age data from the indexed hot tier to compressed cold object storage and finally delete it past the retention limit. Tiering is what makes cost sustainable at petabyte scale: only recent, frequently accessed data stays on expensive indexed SSD storage; everything else moves to cheap object storage and eventually expires."
      actors={[
        { id: "hotStore",  label: "Hot Store",  kind: "store" },
        { id: "lifecycle", label: "Lifecycle",  kind: "service" },
        { id: "coldStore", label: "Cold Store", kind: "store" },
      ]}
      steps={[
        { from: "lifecycle", to: "hotStore",  label: "detect data past the hot window",              variant: "redirect" },
        { from: "hotStore",  to: "lifecycle", label: "segments ready for tiering",                   variant: "redirect", reply: true },
        { from: "lifecycle", to: "lifecycle", label: "compress segments",                             variant: "create" },
        { from: "lifecycle", to: "coldStore", label: "copy compressed segments to cold storage",      variant: "async" },
        { from: "coldStore", to: "lifecycle", label: "copy confirmed",                                variant: "async", reply: true },
        { from: "lifecycle", to: "hotStore",  label: "drop index and delete from hot tier",           variant: "control" },
        { from: "lifecycle", to: "coldStore", label: "expire and delete past retention limit",        variant: "control" },
      ]}
    />
  );
}
