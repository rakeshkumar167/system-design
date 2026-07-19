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

export function EnvelopeEncryptSequence() {
  return (
    <Sequence
      title="Sequence: encrypting data with envelope encryption"
      caption="To encrypt, the application asks the key service for a fresh data key and gets back two forms of it: the plaintext data key and the same key wrapped (encrypted) under a master key. The app encrypts the payload locally with the plaintext data key, immediately discards that plaintext, and stores the wrapped data key beside the ciphertext. The master key never leaves the KMS or its HSM, so what lands on disk — ciphertext plus a wrapped key only the KMS can open — is useless to anyone who steals the database alone."
      actors={[
        { id: "app",   label: "App Server",  kind: "service" },
        { id: "kms",   label: "KMS / HSM",   kind: "external" },
        { id: "store", label: "Data Store",  kind: "store" },
      ]}
      steps={[
        { from: "app",   to: "kms",   label: "generate data key",             variant: "control" },
        { from: "kms",   to: "app",   label: "plaintext DEK + wrapped DEK",   variant: "redirect", reply: true },
        { from: "app",   to: "app",   label: "encrypt payload with DEK (AES)", variant: "control" },
        { from: "app",   to: "app",   label: "discard plaintext DEK",         variant: "control" },
        { from: "app",   to: "store", label: "store ciphertext + wrapped DEK", variant: "create" },
      ]}
    />
  );
}

export function EnvelopeDecryptSequence() {
  return (
    <Sequence
      title="Sequence: decrypting data with envelope encryption"
      caption="To decrypt, the application reads the ciphertext and the wrapped data key stored beside it, then sends only the wrapped key to the key service. The wrapped data key is opened inside the KMS using the master key, and the plaintext data key comes back for the app to decrypt the payload locally. Because one data key protects many objects, the app holds it in memory for a short window and decrypts further objects without another round trip — so the key service is consulted per data key, not per object."
      actors={[
        { id: "app",   label: "App Server",  kind: "service" },
        { id: "store", label: "Data Store",  kind: "store" },
        { id: "kms",   label: "KMS / HSM",   kind: "external" },
      ]}
      steps={[
        { from: "app",   to: "store", label: "read ciphertext + wrapped DEK", variant: "control" },
        { from: "store", to: "app",   label: "ciphertext + wrapped DEK",      variant: "redirect", reply: true },
        { from: "app",   to: "kms",   label: "unwrap DEK",                    variant: "control" },
        { from: "kms",   to: "app",   label: "plaintext DEK",                 variant: "redirect", reply: true },
        { from: "app",   to: "app",   label: "decrypt locally; cache DEK",    variant: "create" },
      ]}
    />
  );
}
