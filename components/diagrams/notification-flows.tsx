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

export function SendFanoutSequence() {
  return (
    <Sequence
      title="Sequence: send notification — fan-out flow"
      caption="The accept path is intentionally thin: the Ingestion API validates the request and enqueues it immediately, returning 202 Accepted without waiting for delivery. The Fan-out Service consumes the notification asynchronously, looks up the recipient's channel preferences, and publishes one message per enabled channel into the corresponding Channel Queue. This fan-out step is where a single notification becomes multiple per-channel delivery tasks — the core amplification the system must be sized for."
      actors={[
        { id: "producer",      label: "Producer",       kind: "infra" },
        { id: "ingestionApi",  label: "Ingestion API",  kind: "service" },
        { id: "ingestionQ",    label: "Ingestion Queue", kind: "queue" },
        { id: "fanout",        label: "Fan-out Service", kind: "service" },
        { id: "channelQueues", label: "Channel Queues",  kind: "queue" },
      ]}
      steps={[
        { from: "producer",     to: "ingestionApi",  label: "POST /v1/notifications {payload, idempotency_key}", variant: "create" },
        { from: "ingestionApi", to: "ingestionQ",    label: "enqueue notification",                              variant: "create" },
        { from: "ingestionApi", to: "producer",      label: "202 Accepted {notification_id}",                   variant: "create", reply: true },
        { from: "fanout",       to: "ingestionQ",    label: "consume notification (async)",                     variant: "async" },
        { from: "fanout",       to: "fanout",        label: "lookup channel preferences",                       variant: "redirect" },
        { from: "fanout",       to: "channelQueues", label: "publish message per enabled channel",              variant: "create" },
      ]}
    />
  );
}

export function RetryBackoffSequence() {
  return (
    <Sequence
      title="Sequence: retry with exponential backoff"
      caption="When a Provider returns a transient error (5xx or timeout), the Channel Worker re-enqueues the message with an exponentially increasing visibility delay plus random jitter, preventing thundering-herd retry storms. Each subsequent attempt waits longer than the last. Once the provider recovers and returns success, the message is acknowledged and removed from the queue. Backoff with jitter is the standard pattern for resilient at-least-once delivery against flaky external providers."
      actors={[
        { id: "channelQ",  label: "Channel Queue",   kind: "queue" },
        { id: "worker",    label: "Channel Worker",  kind: "service" },
        { id: "provider",  label: "Provider",        kind: "external" },
      ]}
      steps={[
        { from: "worker",   to: "channelQ",  label: "consume message",                      variant: "async" },
        { from: "worker",   to: "provider",  label: "deliver notification",                 variant: "redirect" },
        { from: "provider", to: "worker",    label: "5xx / timeout (transient failure)",    variant: "control", reply: true },
        { from: "worker",   to: "channelQ",  label: "re-enqueue with backoff + jitter",     variant: "control" },
        { from: "worker",   to: "channelQ",  label: "consume (after backoff delay)",        variant: "async" },
        { from: "worker",   to: "provider",  label: "deliver notification (retry attempt)", variant: "redirect" },
        { from: "provider", to: "worker",    label: "200 / accepted",                       variant: "redirect", reply: true },
        { from: "worker",   to: "channelQ",  label: "acknowledge — delete from queue",      variant: "redirect" },
      ]}
    />
  );
}

export function DeadLetterSequence() {
  return (
    <Sequence
      title="Sequence: dead-letter after retry budget exhausted"
      caption="When a message has been retried the maximum number of times and the Provider still fails, the Channel Worker gives up retrying and moves the message to the dead-letter queue (DLQ) instead of discarding it or blocking the queue indefinitely. An alerting system monitors the DLQ and pages on-call engineers. The DLQ preserves the message for manual inspection, replay, or discard — preventing a single poison message from starving healthy deliveries on the same channel queue."
      actors={[
        { id: "channelQ", label: "Channel Queue",  kind: "queue" },
        { id: "worker",   label: "Channel Worker", kind: "service" },
        { id: "provider", label: "Provider",       kind: "external" },
        { id: "dlq",      label: "DLQ",            kind: "queue" },
      ]}
      steps={[
        { from: "worker",   to: "channelQ",  label: "consume message (retry #N — final attempt)", variant: "async" },
        { from: "worker",   to: "provider",  label: "deliver notification",                       variant: "redirect" },
        { from: "provider", to: "worker",    label: "5xx — retry budget exhausted",               variant: "control", reply: true },
        { from: "worker",   to: "dlq",       label: "move to DLQ (exhausted retries)",            variant: "control" },
        { from: "dlq",      to: "dlq",       label: "alert on-call — inspect / replay / discard", variant: "control" },
      ]}
    />
  );
}

export function IdempotentSendSequence() {
  return (
    <Sequence
      title="Sequence: idempotent send — duplicate suppression"
      caption="At-least-once delivery means a notification may be accepted more than once (e.g. due to network retries from the producer). Idempotency keys make repeated submissions safe: the first request performs a check-and-set on the Dedup Store and proceeds normally. A second request with the same key finds the entry already present, suppresses the duplicate, and returns the original 202 and notification id without re-enqueuing. The result is effectively-once delivery: guaranteed to reach the recipient at least once, but never duplicated."
      actors={[
        { id: "producer",    label: "Producer",      kind: "infra" },
        { id: "ingestionApi", label: "Ingestion API", kind: "service" },
        { id: "dedupStore",  label: "Dedup Store",   kind: "cache" },
      ]}
      steps={[
        { from: "producer",     to: "ingestionApi", label: "POST /v1/notifications {idempotency_key: K}",             variant: "create" },
        { from: "ingestionApi", to: "dedupStore",   label: "SET K IF NOT EXISTS (check-and-set)",                     variant: "redirect" },
        { from: "dedupStore",   to: "ingestionApi", label: "key was new — proceed",                                   variant: "redirect", reply: true },
        { from: "ingestionApi", to: "producer",     label: "202 Accepted {notification_id: X}",                       variant: "create", reply: true },
        { from: "producer",     to: "ingestionApi", label: "POST /v1/notifications {idempotency_key: K} (duplicate)", variant: "create" },
        { from: "ingestionApi", to: "dedupStore",   label: "SET K IF NOT EXISTS",                                     variant: "redirect" },
        { from: "dedupStore",   to: "ingestionApi", label: "key already exists — suppress",                           variant: "control", reply: true },
        { from: "ingestionApi", to: "producer",     label: "202 Accepted {notification_id: X} (same id, no re-enqueue)", variant: "control", reply: true },
      ]}
    />
  );
}
