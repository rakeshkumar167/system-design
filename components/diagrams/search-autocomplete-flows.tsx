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

export function AutocompleteQuerySequence() {
  return (
    <Sequence
      title="Sequence: serve an autocomplete query"
      caption="The hot read path: the client sends a prefix with each keystroke; the Autocomplete Service checks the Suggestion Cache (cache hit returns immediately); on a miss, it walks the Trie Index to the prefix node and reads the precomputed top-k ranked completions — O(prefix length), never a subtree scan; the result is cached for subsequent identical prefixes before being returned to the client."
      actors={[
        { id: "client",       label: "Client",               kind: "external" },
        { id: "autocomplete", label: "Autocomplete Service", kind: "service" },
        { id: "cache",        label: "Suggestion Cache",     kind: "cache" },
        { id: "trieIndex",    label: "Trie Index",           kind: "store" },
      ]}
      steps={[
        { from: "client",       to: "autocomplete", label: "send prefix (user types)",         variant: "ingress" },
        { from: "autocomplete", to: "cache",        label: "check cache for prefix",           variant: "control" },
        { from: "cache",        to: "autocomplete", label: "cache miss — not found",            variant: "control", reply: true },
        { from: "autocomplete", to: "trieIndex",    label: "walk trie to prefix node",         variant: "redirect" },
        { from: "trieIndex",    to: "autocomplete", label: "return precomputed top-k",         variant: "redirect", reply: true },
        { from: "autocomplete", to: "cache",        label: "populate cache with top-k",        variant: "create" },
        { from: "autocomplete", to: "client",       label: "return ranked suggestions",        variant: "redirect", reply: true },
      ]}
    />
  );
}

export function IndexBuildSequence() {
  return (
    <Sequence
      title="Sequence: build the index from search logs"
      caption="The batch pipeline aggregates logged search events into popularity scores, builds the trie with top-k at every node, and publishes a new immutable index the serving tier loads atomically — enabling lock-free reads on the serving side while the builder prepares the next version."
      actors={[
        { id: "queryLog",   label: "Query Log",    kind: "queue" },
        { id: "aggregator", label: "Aggregator",   kind: "service" },
        { id: "builder",    label: "Index Builder", kind: "service" },
        { id: "trieIndex",  label: "Trie Index",   kind: "store" },
      ]}
      steps={[
        { from: "queryLog",   to: "aggregator", label: "stream batch of search events",       variant: "async" },
        { from: "aggregator", to: "aggregator", label: "count phrase frequencies",            variant: "create" },
        { from: "aggregator", to: "builder",    label: "emit ranked phrase frequency list",   variant: "create" },
        { from: "builder",    to: "builder",    label: "build trie with top-k per node",      variant: "create" },
        { from: "builder",    to: "trieIndex",  label: "publish immutable index version",     variant: "create" },
      ]}
    />
  );
}

export function TrendingUpdateSequence() {
  return (
    <Sequence
      title="Sequence: surface a trending phrase in real time"
      caption="A real-time layer watches the event stream for velocity spikes and injects hot phrases into the served top-k, covering the freshness gap that the hours-old batch index misses — the Lambda split keeps batch throughput and real-time freshness independent."
      actors={[
        { id: "queryLog", label: "Query Log", kind: "queue" },
        { id: "trending", label: "Trending",  kind: "service" },
        { id: "trieIndex", label: "Trie Index", kind: "store" },
      ]}
      steps={[
        { from: "queryLog", to: "trending",  label: "stream recent search events",          variant: "async" },
        { from: "trending", to: "trending",  label: "detect velocity spike for phrase",     variant: "control" },
        { from: "trending", to: "trieIndex", label: "inject trending phrase into top-k",    variant: "async" },
      ]}
    />
  );
}

export function TypoCorrectionSequence() {
  return (
    <Sequence
      title="Sequence: correct a typo and personalize"
      caption="A mistyped prefix has no exact trie match, so the service expands to edit-distance variants, looks up the corrected prefix node, and returns did-you-mean suggestions — typo tolerance is applied only on a miss, keeping the hot path fast."
      actors={[
        { id: "client",       label: "Client",               kind: "external" },
        { id: "autocomplete", label: "Autocomplete Service", kind: "service" },
        { id: "trieIndex",    label: "Trie Index",           kind: "store" },
      ]}
      steps={[
        { from: "client",       to: "autocomplete", label: "send mistyped prefix",                variant: "ingress" },
        { from: "autocomplete", to: "trieIndex",    label: "exact trie walk — miss",              variant: "redirect" },
        { from: "trieIndex",    to: "autocomplete", label: "no match found",                      variant: "redirect", reply: true },
        { from: "autocomplete", to: "autocomplete", label: "expand to edit-distance variants",    variant: "control" },
        { from: "autocomplete", to: "trieIndex",    label: "look up corrected prefix",            variant: "redirect" },
        { from: "trieIndex",    to: "autocomplete", label: "return did-you-mean suggestions",     variant: "redirect", reply: true },
        { from: "autocomplete", to: "client",       label: "return corrected suggestions",        variant: "redirect", reply: true },
      ]}
    />
  );
}
