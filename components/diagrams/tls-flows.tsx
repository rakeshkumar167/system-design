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

export function TlsHandshakeSequence() {
  return (
    <Sequence
      title="Sequence: the TLS handshake establishing an encrypted session"
      caption="Before any application data flows, the client and server negotiate a protocol version and cipher suite, the server presents its certificate to prove its identity, and both sides perform an ephemeral key exchange to independently derive the same shared session key — a value an eavesdropper watching every byte cannot reconstruct. Only then does encrypted HTTP traffic flow, protected by fast symmetric encryption. Because the key is ephemeral, stealing the server's private key later cannot decrypt these recorded sessions, which is forward secrecy."
      actors={[
        { id: "client", label: "Client",  kind: "external" },
        { id: "server", label: "Server",  kind: "service" },
      ]}
      steps={[
        { from: "client", to: "server", label: "ClientHello — versions, ciphers, key share", variant: "ingress" },
        { from: "server", to: "client", label: "ServerHello + certificate + key share",      variant: "redirect", reply: true },
        { from: "client", to: "client", label: "verify certificate, derive session key",      variant: "control" },
        { from: "client", to: "server", label: "Finished (verify), derive same key",          variant: "create" },
        { from: "client", to: "server", label: "encrypted application data (symmetric)",       variant: "redirect" },
      ]}
    />
  );
}

export function CertValidationSequence() {
  return (
    <Sequence
      title="Sequence: validating a certificate chain to a trusted root"
      caption="The server sends its leaf certificate together with any intermediate certificates. The client walks the chain, checking each certificate's signature against the next one up, until it reaches a root certificate that is pre-installed in its local trust store — the anchor it already trusts without being told to. It also confirms the certificate's domain matches the site and that nothing in the chain has expired. If the chain terminates at a trusted anchor and every check passes, the server's identity is accepted."
      actors={[
        { id: "client", label: "Client",      kind: "external" },
        { id: "server", label: "Server",      kind: "service" },
        { id: "store",  label: "Trust Store", kind: "cache" },
      ]}
      steps={[
        { from: "client", to: "server", label: "request connection",               variant: "ingress" },
        { from: "server", to: "client", label: "leaf + intermediate certificates",  variant: "redirect", reply: true },
        { from: "client", to: "client", label: "check signatures up the chain",     variant: "control" },
        { from: "client", to: "store",  label: "is the root a trusted anchor?",     variant: "control" },
        { from: "store",  to: "client", label: "yes — anchored, domain + dates ok",  variant: "redirect", reply: true },
      ]}
    />
  );
}
