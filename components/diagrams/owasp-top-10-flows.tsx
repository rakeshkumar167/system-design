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

export function InjectionAttackSequence() {
  return (
    <Sequence
      title="Sequence: a SQL injection attack"
      caption="Injection happens when an application builds a command by gluing untrusted input straight into it. Here the attacker's input is concatenated into a SQL string, so the database parser reads the attacker's payload as part of the query itself and runs it — returning rows the caller was never meant to see. The root cause is mixing code and data; a parameterized query (prepared statement) sends the query and the values on separate channels, so the input can never be interpreted as executable command syntax no matter what it contains."
      actors={[
        { id: "attacker", label: "Attacker",  kind: "external" },
        { id: "app",      label: "Web App",   kind: "service" },
        { id: "db",       label: "Database",  kind: "store" },
      ]}
      steps={[
        { from: "attacker", to: "app", label: "input: ' OR 1=1 --",           variant: "control" },
        { from: "app",      to: "db",  label: "concatenate input into SQL",    variant: "control" },
        { from: "db",       to: "db",  label: "parse & run tainted query",     variant: "control" },
        { from: "db",       to: "app", label: "every row, not just one",       variant: "redirect", reply: true },
        { from: "app",      to: "attacker", label: "leaked data",              variant: "create", reply: true },
      ]}
    />
  );
}

export function SsrfAttackSequence() {
  return (
    <Sequence
      title="Sequence: a server-side request forgery attack"
      caption="In SSRF the attacker doesn't reach the internal network directly — they make the trusted server do it for them. A user-supplied URL is fetched by the server without validation, so the attacker points it at an internal-only address such as the cloud metadata service and the server dutifully retrieves it, handing back credentials or secrets the attacker could never reach on their own. The defense is to never fetch arbitrary user-supplied URLs: allow only an explicit list of permitted destinations and block requests to internal and link-local address ranges."
      actors={[
        { id: "attacker", label: "Attacker",         kind: "external" },
        { id: "server",   label: "Vulnerable Server", kind: "service" },
        { id: "meta",     label: "Metadata Endpoint", kind: "infra" },
      ]}
      steps={[
        { from: "attacker", to: "server", label: "url=http://169.254.169.254/", variant: "control" },
        { from: "server",   to: "meta",   label: "server fetches the URL",       variant: "control" },
        { from: "meta",     to: "server", label: "instance credentials",         variant: "redirect", reply: true },
        { from: "server",   to: "attacker", label: "secrets relayed back",       variant: "create", reply: true },
      ]}
    />
  );
}
