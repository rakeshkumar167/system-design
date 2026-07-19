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

export function SessionFixationSequence() {
  return (
    <Sequence
      title="Sequence: a session fixation attack"
      caption="In fixation the attacker chooses the session id in advance. They obtain a valid id from the application, then trick the victim into browsing with that same id (for example through a crafted link). When the victim logs in, a vulnerable server upgrades that very id to an authenticated session instead of issuing a new one — so the attacker, who already knows the id, is now logged in as the victim. The defense is to always regenerate the session id at login, which makes any id the attacker planted beforehand worthless."
      actors={[
        { id: "attacker", label: "Attacker",  kind: "external" },
        { id: "victim",   label: "Victim",    kind: "external" },
        { id: "app",      label: "Web App",   kind: "service" },
      ]}
      steps={[
        { from: "attacker", to: "app",    label: "get a valid session id",         variant: "control" },
        { from: "attacker", to: "victim", label: "plant that id (crafted link)",   variant: "control" },
        { from: "victim",   to: "app",    label: "log in using the planted id",    variant: "control" },
        { from: "app",      to: "victim", label: "same id kept — now authenticated", variant: "control", reply: true },
        { from: "attacker", to: "app",    label: "reuse the id — logged in as victim", variant: "create" },
      ]}
    />
  );
}

export function SecureLoginSessionSequence() {
  return (
    <Sequence
      title="Sequence: establishing and validating a secure session"
      caption="On a successful login the server mints a brand-new, high-entropy session id (replacing any prior one, which defeats fixation), writes the session record to its store, and returns the id in a cookie marked HttpOnly, Secure, and SameSite so scripts can't read it and the browser won't leak it cross-site or over plaintext. On each later request the browser automatically returns the cookie, and the server looks the opaque id up in the store to recover the identity — the id itself carries no data, it is simply a bearer credential validated server-side every time."
      actors={[
        { id: "user",  label: "User",           kind: "external" },
        { id: "app",   label: "Web App",        kind: "service" },
        { id: "store", label: "Session Store",  kind: "store" },
      ]}
      steps={[
        { from: "user",  to: "app",   label: "log in (valid credentials)",       variant: "control" },
        { from: "app",   to: "store", label: "generate fresh id, save session",  variant: "create" },
        { from: "app",   to: "user",  label: "Set-Cookie: HttpOnly, Secure, SameSite", variant: "redirect", reply: true },
        { from: "user",  to: "app",   label: "next request returns the cookie",  variant: "control" },
        { from: "app",   to: "store", label: "look up the opaque id",            variant: "redirect" },
        { from: "app",   to: "user",  label: "identity restored — serve",        variant: "create", reply: true },
      ]}
    />
  );
}
