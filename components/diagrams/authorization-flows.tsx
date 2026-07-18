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

export function AuthorizationDecisionSequence() {
  return (
    <Sequence
      title="Sequence: an externalized authorization decision"
      caption="The application code does not embed authorization logic. A Policy Enforcement Point intercepts the request and asks a separate Policy Decision Point for a verdict, passing the subject, the action, and the target resource. The decision point evaluates the declarative policy, pulling any attributes or role assignments it needs from an information source, and returns a plain allow or deny. The enforcement point then either serves the resource or rejects the call — decoupling deciding from enforcing so policy lives in one auditable place instead of scattered if-statements."
      actors={[
        { id: "client", label: "Client",   kind: "external" },
        { id: "pep",    label: "PEP",       kind: "service" },
        { id: "pdp",    label: "PDP",       kind: "infra" },
        { id: "pip",    label: "Attributes", kind: "store" },
      ]}
      steps={[
        { from: "client", to: "pep", label: "request: action on resource",        variant: "ingress" },
        { from: "pep",    to: "pdp", label: "decide(subject, action, resource)",   variant: "control" },
        { from: "pdp",    to: "pip", label: "fetch roles / attributes",            variant: "control" },
        { from: "pip",    to: "pdp", label: "subject + resource attributes",       variant: "redirect", reply: true },
        { from: "pdp",    to: "pep", label: "allow (or deny)",                     variant: "redirect", reply: true },
        { from: "pep",    to: "client", label: "serve resource — or 403",          variant: "create", reply: true },
      ]}
    />
  );
}

export function RelationshipCheckSequence() {
  return (
    <Sequence
      title="Sequence: a relationship-based permission check"
      caption="Permissions follow a graph of relationships rather than static roles. To answer whether a user may view a document, the authorization service looks up the stored relationship tuples and walks the graph: this user belongs to a group, and that group is a viewer of the document, so the permission is inherited. This is the model Google Zanzibar popularized for shared, hierarchical resources — a central, strongly consistent store of tuples answering a simple check call — and it is what open-source engines like SpiceDB and OpenFGA implement."
      actors={[
        { id: "client", label: "Client",        kind: "external" },
        { id: "authz",  label: "Authz Service",  kind: "service" },
        { id: "store",  label: "Tuple Store",    kind: "store" },
      ]}
      steps={[
        { from: "client", to: "authz", label: "check(user, viewer, doc:123)",         variant: "ingress" },
        { from: "authz",  to: "store", label: "lookup relationship tuples",           variant: "control" },
        { from: "store",  to: "authz", label: "user in group; group = viewer of doc",  variant: "redirect", reply: true },
        { from: "authz",  to: "authz", label: "walk the graph, resolve inheritance",   variant: "control" },
        { from: "authz",  to: "client", label: "allowed",                             variant: "redirect", reply: true },
      ]}
    />
  );
}
