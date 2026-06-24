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

export function AuthCaptureSequence() {
  return (
    <Sequence
      title="Sequence: authorize and capture — state machine and double-entry posting"
      caption="A payment advances through a durable state machine: initiated, authorized, then captured. Each movement is recorded as equal debits and credits in the double-entry ledger, so the books stay balanced at every step. The external PSP actually moves the money; the ledger records that it happened."
      actors={[
        { id: "client",       label: "Client",              kind: "infra" },
        { id: "orchestrator", label: "Payment Orchestrator", kind: "service" },
        { id: "ledgerSvc",    label: "Ledger Service",       kind: "service" },
        { id: "psp",          label: "PSP",                  kind: "external" },
      ]}
      steps={[
        { from: "client",       to: "orchestrator", label: "POST payment with idempotency key",              variant: "ingress" },
        { from: "orchestrator", to: "orchestrator", label: "persist state: initiated -> authorized",          variant: "redirect" },
        { from: "orchestrator", to: "ledgerSvc",    label: "post pending double-entry",                      variant: "create" },
        { from: "orchestrator", to: "psp",          label: "call PSP: authorize + capture",                  variant: "async" },
        { from: "psp",          to: "orchestrator", label: "PSP confirms authorization",                     variant: "redirect", reply: true },
        { from: "orchestrator", to: "ledgerSvc",    label: "post debit + credit (state captured)",           variant: "create" },
        { from: "orchestrator", to: "client",       label: "return captured result",                         variant: "redirect", reply: true },
      ]}
    />
  );
}

export function IdempotentRetrySequence() {
  return (
    <Sequence
      title="Sequence: idempotent retry — duplicate request returns the original result"
      caption="Retries are inevitable in distributed systems. The idempotency key makes a duplicate request return the original result instead of charging the customer twice — exactly-once processing. The key is stored atomically before any work begins; a retry that arrives after the first attempt finds the key already completed and gets the original response."
      actors={[
        { id: "client",       label: "Client",               kind: "infra" },
        { id: "paymentApi",   label: "Payment API",           kind: "service" },
        { id: "idemStore",    label: "Idempotency Store",     kind: "store" },
        { id: "orchestrator", label: "Payment Orchestrator",  kind: "service" },
      ]}
      steps={[
        { from: "client",       to: "paymentApi",   label: "POST payment (key K)",                             variant: "ingress" },
        { from: "paymentApi",   to: "idemStore",    label: "store key K, begin processing",                    variant: "create" },
        { from: "paymentApi",   to: "orchestrator", label: "process payment",                                  variant: "redirect" },
        { from: "paymentApi",   to: "paymentApi",   label: "response lost — client timeout",                   variant: "control" },
        { from: "client",       to: "paymentApi",   label: "retry with same key K",                            variant: "ingress" },
        { from: "paymentApi",   to: "idemStore",    label: "look up key K",                                    variant: "redirect" },
        { from: "idemStore",    to: "paymentApi",   label: "key K already completed — return stored result",   variant: "control", reply: true },
        { from: "paymentApi",   to: "client",       label: "original result (no double charge)",               variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ReconciliationSequence() {
  return (
    <Sequence
      title="Sequence: reconciliation — internal ledger versus PSP settlement"
      caption="Reconciliation compares the internal ledger against the external PSP settlement file to catch any drift between the two systems. Mismatches — a payment present at the PSP but missing in the ledger, or vice versa — are flagged as discrepancies and resolved so the books remain correct."
      actors={[
        { id: "reconciliation", label: "Reconciliation", kind: "service" },
        { id: "ledgerDb",       label: "Ledger DB",       kind: "store" },
        { id: "psp",            label: "PSP / Bank",      kind: "external" },
      ]}
      steps={[
        { from: "reconciliation", to: "psp",            label: "fetch PSP settlement file",                      variant: "redirect" },
        { from: "psp",            to: "reconciliation", label: "settlement file returned",                       variant: "muted", reply: true },
        { from: "reconciliation", to: "ledgerDb",       label: "read internal ledger for the period",            variant: "redirect" },
        { from: "ledgerDb",       to: "reconciliation", label: "ledger entries returned",                        variant: "redirect", reply: true },
        { from: "reconciliation", to: "reconciliation", label: "match line by line",                             variant: "redirect" },
        { from: "reconciliation", to: "reconciliation", label: "mismatch detected: present at PSP, missing in ledger", variant: "control" },
        { from: "reconciliation", to: "reconciliation", label: "raise discrepancy for resolution",              variant: "control" },
      ]}
    />
  );
}

export function RefundSequence() {
  return (
    <Sequence
      title="Sequence: refund — a reversing double-entry transaction"
      caption="A refund is not a deletion — it is a new reversing double-entry transaction that credits the customer and debits the merchant. The original ledger entries remain untouched, preserving the immutable audit trail. The state machine advances to refunded, and the PSP is called idempotently with its own idempotency key."
      actors={[
        { id: "client",       label: "Client",              kind: "infra" },
        { id: "orchestrator", label: "Payment Orchestrator", kind: "service" },
        { id: "ledgerSvc",    label: "Ledger Service",       kind: "service" },
        { id: "psp",          label: "PSP",                  kind: "external" },
      ]}
      steps={[
        { from: "client",       to: "orchestrator", label: "refund request (idempotency key)",             variant: "ingress" },
        { from: "orchestrator", to: "orchestrator", label: "validate original captured payment",           variant: "redirect" },
        { from: "orchestrator", to: "psp",          label: "call PSP refund (idempotent)",                 variant: "async" },
        { from: "psp",          to: "orchestrator", label: "PSP confirms refund",                          variant: "redirect", reply: true },
        { from: "orchestrator", to: "ledgerSvc",    label: "post reversing entries: credit customer, debit merchant", variant: "create" },
        { from: "orchestrator", to: "orchestrator", label: "state: captured -> refunded",                  variant: "redirect" },
        { from: "orchestrator", to: "client",       label: "refund confirmed",                             variant: "redirect", reply: true },
      ]}
    />
  );
}
