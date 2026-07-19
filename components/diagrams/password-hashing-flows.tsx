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

export function PasswordRegistrationSequence() {
  return (
    <Sequence
      title="Sequence: hashing a password at registration"
      caption="The service never stores the password itself. It draws a fresh random salt, combines it with the password, and runs a deliberately slow, memory-hard hash at a high work factor, then persists the algorithm, its cost parameters, the salt, and the resulting digest together in one self-describing record. Because the transform is one-way and salted per user, a stolen database reveals no usable passwords — an attacker is left to brute-force every hash individually."
      actors={[
        { id: "user",   label: "User",             kind: "external" },
        { id: "auth",   label: "Auth Service",     kind: "service" },
        { id: "hasher", label: "Argon2",           kind: "infra" },
        { id: "store",  label: "Credential Store", kind: "store" },
      ]}
      steps={[
        { from: "user",   to: "auth",   label: "set password",                     variant: "ingress" },
        { from: "auth",   to: "auth",   label: "generate random salt",             variant: "control" },
        { from: "auth",   to: "hasher", label: "hash(salt + password), high cost", variant: "control" },
        { from: "hasher", to: "auth",   label: "digest",                           variant: "redirect", reply: true },
        { from: "auth",   to: "store",  label: "store algorithm, params, salt, hash", variant: "create" },
      ]}
    />
  );
}

export function PasswordVerificationSequence() {
  return (
    <Sequence
      title="Sequence: verifying a password at login"
      caption="At login the service looks up the stored credential record, reads the salt and cost parameters out of it, and recomputes the hash of the submitted password with those exact parameters. The candidate digest is recomputed and compared in constant time against the stored one — the password is never decrypted, because a one-way hash has no inverse. If the stored work factor now sits below current policy, the service transparently rehashes the password at the higher cost before returning success."
      actors={[
        { id: "user",   label: "User",             kind: "external" },
        { id: "auth",   label: "Auth Service",     kind: "service" },
        { id: "store",  label: "Credential Store", kind: "store" },
        { id: "hasher", label: "Argon2",           kind: "infra" },
      ]}
      steps={[
        { from: "user",   to: "auth",   label: "log in: username + password",       variant: "ingress" },
        { from: "auth",   to: "store",  label: "fetch record by username",          variant: "control" },
        { from: "store",  to: "auth",   label: "algorithm, params, salt, hash",     variant: "redirect", reply: true },
        { from: "auth",   to: "hasher", label: "recompute with stored salt + params", variant: "control" },
        { from: "hasher", to: "auth",   label: "candidate digest",                  variant: "redirect", reply: true },
        { from: "auth",   to: "auth",   label: "constant-time compare",             variant: "control" },
        { from: "auth",   to: "user",   label: "allow — or deny",                   variant: "create", reply: true },
      ]}
    />
  );
}
