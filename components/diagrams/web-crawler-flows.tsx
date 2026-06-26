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

export function FetchPageSequence() {
  return (
    <Sequence
      title="Sequence: fetch a page and extract links"
      caption="The core crawl loop: the frontier pops the next URL and hands it to the fetcher, which downloads the page and writes it to the content store; the parser then extracts all outbound links and feeds new ones back into the frontier to be deduplicated and scheduled."
      actors={[
        { id: "frontier",     label: "Frontier",      kind: "queue" },
        { id: "fetcher",      label: "Fetcher",       kind: "service" },
        { id: "parser",       label: "Parser",        kind: "service" },
        { id: "contentStore", label: "Content Store", kind: "store" },
      ]}
      steps={[
        { from: "frontier",     to: "fetcher",      label: "pop next URL from queue",              variant: "redirect" },
        { from: "fetcher",      to: "fetcher",      label: "resolve DNS + issue HTTP request",     variant: "muted" },
        { from: "fetcher",      to: "contentStore", label: "write raw HTML to content store",      variant: "create" },
        { from: "fetcher",      to: "parser",       label: "forward page for link extraction",     variant: "create" },
        { from: "parser",       to: "parser",       label: "extract outbound links",               variant: "create" },
        { from: "parser",       to: "frontier",     label: "submit new links for dedup + enqueue", variant: "async" },
      ]}
    />
  );
}

export function DedupCheckSequence() {
  return (
    <Sequence
      title="Sequence: dedup a discovered URL"
      caption="Every discovered URL is checked against the bloom-filter seen-set: already-seen URLs are dropped immediately, preventing the crawler from revisiting pages; new URLs are added to the seen-set and enqueued in the frontier, so the crawler only does work once per URL."
      actors={[
        { id: "parser",   label: "Parser",    kind: "service" },
        { id: "seenSet",  label: "Seen-Set",  kind: "store" },
        { id: "frontier", label: "Frontier",  kind: "queue" },
      ]}
      steps={[
        { from: "parser",   to: "seenSet",  label: "submit discovered URL for dedup check",   variant: "control" },
        { from: "seenSet",  to: "seenSet",  label: "probe bloom filter",                       variant: "control" },
        { from: "seenSet",  to: "parser",   label: "already seen — drop URL",                  variant: "control", reply: true },
        { from: "seenSet",  to: "seenSet",  label: "not seen — add URL to seen-set",           variant: "create" },
        { from: "seenSet",  to: "frontier", label: "enqueue new URL with priority score",      variant: "async" },
      ]}
    />
  );
}

export function PolitenessSequence() {
  return (
    <Sequence
      title="Sequence: apply politeness and robots rules"
      caption="Before contacting a host, the fetcher loads its cached robots.txt, checks the target URL is allowed, and verifies the per-host crawl delay has elapsed — then sends at most one request at a time. Disallowed or throttled requests are dropped, keeping the crawler a good citizen."
      actors={[
        { id: "fetcher",      label: "Fetcher",      kind: "service" },
        { id: "robotsCache",  label: "Robots Cache", kind: "store" },
        { id: "host",         label: "Host",         kind: "external" },
      ]}
      steps={[
        { from: "fetcher",     to: "robotsCache", label: "load cached robots.txt for host",            variant: "control" },
        { from: "robotsCache", to: "fetcher",     label: "rules returned (or fetch and cache)",        variant: "redirect", reply: true },
        { from: "fetcher",     to: "fetcher",     label: "check URL against disallow rules — allowed", variant: "control" },
        { from: "fetcher",     to: "fetcher",     label: "disallowed? → drop request",                variant: "control" },
        { from: "fetcher",     to: "fetcher",     label: "check crawl delay elapsed for host",         variant: "control" },
        { from: "fetcher",     to: "host",        label: "send single HTTP request",                   variant: "redirect" },
        { from: "host",        to: "fetcher",     label: "page response",                              variant: "redirect", reply: true },
      ]}
    />
  );
}

export function RecrawlSequence() {
  return (
    <Sequence
      title="Sequence: schedule a recrawl for freshness"
      caption="A scheduler reads each page's last-crawled time and estimated change rate, computes when it is next due, and re-enqueues it in the frontier — pages that change frequently get a shorter cadence than static ones, so the crawler stays fresh without wasting bandwidth."
      actors={[
        { id: "scheduler",  label: "Scheduler",   kind: "service" },
        { id: "pageStore",  label: "Page Store",  kind: "store" },
        { id: "frontier",   label: "Frontier",    kind: "queue" },
      ]}
      steps={[
        { from: "scheduler", to: "pageStore",  label: "read last-crawled time + change rate",     variant: "redirect" },
        { from: "pageStore", to: "scheduler",  label: "metadata returned",                         variant: "redirect", reply: true },
        { from: "scheduler", to: "scheduler",  label: "compute next-crawl time — page is due",    variant: "create" },
        { from: "scheduler", to: "frontier",   label: "re-enqueue URL with freshness priority",   variant: "async" },
      ]}
    />
  );
}
