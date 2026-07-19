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

export function IngestSampleSequence() {
  return (
    <Sequence
      title="Sequence: ingest a batch of samples"
      caption="The write path receives a batch of samples, appends them to a write-ahead log for durability, and writes them into the per-series in-memory head block; periodically the head is flushed to an immutable, compressed block on disk. The write-ahead log means a crash loses nothing, and the in-memory head absorbs the stream so the path must sustain millions of samples per second while never blocking the producers that emit them."
      actors={[
        { id: "target", label: "Target",           kind: "external" },
        { id: "ingest", label: "Ingestion Service", kind: "service" },
        { id: "wal",    label: "Write-Ahead Log",   kind: "queue" },
        { id: "tsdb",   label: "Time-Series DB",     kind: "store" },
      ]}
      steps={[
        { from: "target", to: "ingest", label: "scrape / push samples",       variant: "ingress" },
        { from: "ingest", to: "wal",    label: "append to WAL (durable)",     variant: "create" },
        { from: "ingest", to: "tsdb",   label: "write to in-memory head",     variant: "create" },
        { from: "tsdb",   to: "tsdb",   label: "flush compressed block",      variant: "async" },
        { from: "ingest", to: "target", label: "202 accepted",                variant: "redirect", reply: true },
      ]}
    />
  );
}

export function RangeQuerySequence() {
  return (
    <Sequence
      title="Sequence: serve a range query"
      caption="A dashboard sends a query selecting series by their labels over a time range and applying a function such as a per-second rate. The query engine resolves the matching series from the index, range-scans the relevant blocks, applies the aggregation, and returns the result. Because dashboards almost always ask about recent time, reads touch only recent, contiguous blocks — and recording rules can precompute heavy aggregations so expensive dashboards stay cheap."
      actors={[
        { id: "dash",  label: "Dashboard",     kind: "external" },
        { id: "query", label: "Query Engine",  kind: "service" },
        { id: "index", label: "Series Index",  kind: "store" },
        { id: "tsdb",  label: "Time-Series DB", kind: "store" },
      ]}
      steps={[
        { from: "dash",  to: "query", label: "query: rate(...)[5m] by label", variant: "ingress" },
        { from: "query", to: "index", label: "select series by labels",       variant: "control" },
        { from: "index", to: "query", label: "matching series ids",           variant: "redirect", reply: true },
        { from: "query", to: "tsdb",  label: "range-scan recent blocks",      variant: "redirect" },
        { from: "tsdb",  to: "query", label: "sample ranges",                 variant: "redirect", reply: true },
        { from: "query", to: "dash",  label: "aggregated series",             variant: "redirect", reply: true },
      ]}
    />
  );
}

export function AlertEvaluationSequence() {
  return (
    <Sequence
      title="Sequence: evaluate an alert rule and fire"
      caption="The alerting engine runs each rule on a fixed interval, querying the recent window and testing the condition. A condition that is momentarily true does nothing; only when it stays true for the rule's for-duration does the alert fire — so the for-duration requirement suppresses flapping and a brief blip never pages anyone. Firing alerts are deduplicated, grouped, and routed before being handed to the notification channel."
      actors={[
        { id: "alert",  label: "Alerting Engine", kind: "service" },
        { id: "tsdb",   label: "Time-Series DB",   kind: "store" },
        { id: "notify", label: "Notification",     kind: "external" },
      ]}
      steps={[
        { from: "alert",  to: "tsdb",   label: "evaluate rule over window",  variant: "control" },
        { from: "tsdb",   to: "alert",  label: "condition true",             variant: "redirect", reply: true },
        { from: "alert",  to: "alert",  label: "hold for the for-duration",  variant: "control" },
        { from: "alert",  to: "alert",  label: "dedup, group, route",        variant: "control" },
        { from: "alert",  to: "notify", label: "fire notification",          variant: "create" },
      ]}
    />
  );
}

export function DownsampleRetentionSequence() {
  return (
    <Sequence
      title="Sequence: downsample and expire old data"
      caption="A background job scans blocks older than the raw-retention boundary, computes lower-resolution rollups (for example one-minute points averaged into five-minute and then hourly points), writes the downsampled blocks, and drops the raw ones. Because dashboards over long ranges only need coarse resolution, this bounds long-term storage without losing the shape of history — recent data stays high-resolution, old data shrinks."
      actors={[
        { id: "down",  label: "Downsampler",     kind: "service" },
        { id: "tsdb",  label: "Time-Series DB",   kind: "store" },
        { id: "cold",  label: "Long-Term Store",  kind: "store" },
      ]}
      steps={[
        { from: "down", to: "tsdb", label: "read blocks past retention",  variant: "control" },
        { from: "tsdb", to: "down", label: "raw high-res samples",        variant: "redirect", reply: true },
        { from: "down", to: "down", label: "roll up 1m → 5m → 1h",        variant: "control" },
        { from: "down", to: "cold", label: "write rollups",              variant: "create" },
        { from: "down", to: "tsdb", label: "drop expired raw blocks",     variant: "control" },
      ]}
    />
  );
}
