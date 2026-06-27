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

export function OAuthAuthCodeSequence() {
  return (
    <Sequence
      title="Sequence: OAuth 2.0 authorization-code flow with PKCE"
      caption="OAuth lets a user grant an app limited access to their data on another service without ever revealing their password to that app. The browser is redirected to the authorization server to log in and consent; the app receives a short-lived authorization code, then exchanges it (with its PKCE verifier) at the token endpoint for an access token. With OpenID Connect the same exchange also returns an ID token, a signed JWT that proves the user's identity."
      actors={[
        { id: "user",   label: "User",        kind: "external" },
        { id: "client", label: "Client App",  kind: "service" },
        { id: "authsrv", label: "Auth Server", kind: "service" },
        { id: "api",    label: "Resource API", kind: "store" },
      ]}
      steps={[
        { from: "user",   to: "client", label: "click sign in",                  variant: "ingress" },
        { from: "client", to: "authsrv", label: "redirect to authorize + PKCE",  variant: "redirect" },
        { from: "authsrv", to: "user",  label: "prompt login + consent",         variant: "control" },
        { from: "user",   to: "authsrv", label: "authenticate + approve",        variant: "ingress" },
        { from: "authsrv", to: "client", label: "redirect back with code",       variant: "redirect", reply: true },
        { from: "client", to: "authsrv", label: "exchange code at token endpoint", variant: "create" },
        { from: "authsrv", to: "client", label: "access token (+ ID token)",     variant: "redirect", reply: true },
        { from: "client", to: "api",    label: "call API with bearer token",     variant: "redirect" },
      ]}
    />
  );
}

export function SessionVsTokenSequence() {
  return (
    <Sequence
      title="Sequence: stateful session lookup vs stateless token verification"
      caption="Stateful sessions: the client sends an opaque session id (in a cookie) and the API server reads a central session store to recover the user's identity on every request — a network round-trip on the hot path that scales with traffic and must stay available. The stateless alternative replaces those store steps with a local signature check of a self-contained token: no shared lookup, which is why tokens scale, but also nothing to delete, which is why revoking them early is hard."
      actors={[
        { id: "client", label: "Client",        kind: "external" },
        { id: "server", label: "API Server",    kind: "service" },
        { id: "store",  label: "Session Store", kind: "cache" },
      ]}
      steps={[
        { from: "client", to: "server", label: "request + session cookie", variant: "ingress" },
        { from: "server", to: "store",  label: "look up session by id",    variant: "control" },
        { from: "store",  to: "server", label: "return user identity",     variant: "redirect", reply: true },
        { from: "server", to: "client", label: "authorized response",      variant: "redirect", reply: true },
      ]}
    />
  );
}
