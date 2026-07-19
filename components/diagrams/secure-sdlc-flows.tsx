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

export function SecureSdlcPipelineSequence() {
  return (
    <Sequence
      title="Sequence: security gates in the CI/CD pipeline"
      caption="A Secure SDLC bakes automated checks into the delivery pipeline so flaws are caught before they ship. A commit triggers static analysis and secret scanning of the source, a composition scan of every dependency for known vulnerabilities, then a build that is signed and accompanied by a bill of materials, and a dynamic scan against the running app in staging before it is promoted. Each gate can fail the build, so problems surface at the cheapest possible moment rather than in production — shift-left, automated and enforced on every change."
      actors={[
        { id: "dev",   label: "Developer",  kind: "external" },
        { id: "ci",    label: "CI Pipeline", kind: "service" },
        { id: "stage", label: "Staging",    kind: "infra" },
        { id: "prod",  label: "Production",  kind: "store" },
      ]}
      steps={[
        { from: "dev",   to: "ci",    label: "commit code",                     variant: "control" },
        { from: "ci",    to: "ci",    label: "SAST + secret scan",              variant: "control" },
        { from: "ci",    to: "ci",    label: "SCA: scan dependencies",          variant: "control" },
        { from: "ci",    to: "stage", label: "build, sign, SBOM → deploy",      variant: "create" },
        { from: "stage", to: "stage", label: "DAST against running app",        variant: "control" },
        { from: "stage", to: "prod",  label: "promote, then monitor at runtime", variant: "redirect" },
      ]}
    />
  );
}

export function VulnerabilityResponseSequence() {
  return (
    <Sequence
      title="Sequence: the vulnerability-management loop"
      caption="Not every flaw is caught before release, so a Secure SDLC also closes the loop on what turns up later. A vulnerability reported by a scanner, a penetration tester, or an external researcher is triaged and assigned a severity, prioritized against everything else, then fixed, tested, and deployed, and finally verified as resolved. This continuous intake-to-remediation cycle is what turns scattered findings into reliably closed risks, and it never truly stops because new vulnerabilities are disclosed against code that has not changed."
      actors={[
        { id: "reporter", label: "Reporter/Scanner", kind: "external" },
        { id: "sec",      label: "Security Team",    kind: "service" },
        { id: "eng",      label: "Engineering",      kind: "infra" },
      ]}
      steps={[
        { from: "reporter", to: "sec", label: "report a vulnerability",        variant: "control" },
        { from: "sec",      to: "sec", label: "triage & assign severity",       variant: "control" },
        { from: "sec",      to: "eng", label: "prioritize & assign fix",        variant: "redirect" },
        { from: "eng",      to: "eng", label: "patch, test & verify",           variant: "control" },
        { from: "eng",      to: "sec", label: "deploy fix — confirm resolved",  variant: "create", reply: true },
      ]}
    />
  );
}
