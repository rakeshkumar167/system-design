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

export function ScheduleJobSequence() {
  return (
    <Sequence
      title="Sequence: schedule a job — persist a durable trigger"
      caption="Scheduling persists a durable job with its next fire time; the job store is the source of truth and survives restarts. A one-time job fires once and is done; a recurring job gets its next fire time recomputed after each run."
      actors={[
        { id: "client",    label: "Client",    kind: "infra" },
        { id: "scheduler", label: "Scheduler", kind: "service" },
        { id: "jobStore",  label: "Job Store", kind: "store" },
      ]}
      steps={[
        { from: "client",    to: "scheduler", label: "submit one-time or cron job",                variant: "ingress" },
        { from: "scheduler", to: "scheduler", label: "validate + compute next fire time",          variant: "create" },
        { from: "scheduler", to: "jobStore",  label: "persist job with schedule index",            variant: "create" },
        { from: "jobStore",  to: "scheduler", label: "job id returned",                            variant: "redirect", reply: true },
        { from: "scheduler", to: "client",    label: "return job id to caller",                    variant: "redirect", reply: true },
      ]}
    />
  );
}

export function DispatchExecuteSequence() {
  return (
    <Sequence
      title="Sequence: dispatch a due job to a worker"
      caption="The leader-elected scheduler finds due jobs and enqueues them; a worker claims one under a lease and executes it. The lease guards against a crashed worker — if the worker dies, the lease expires and another worker re-claims the job (at-least-once)."
      actors={[
        { id: "scheduler",     label: "Scheduler",      kind: "service" },
        { id: "dispatchQueue", label: "Dispatch Queue", kind: "queue" },
        { id: "worker",        label: "Worker",         kind: "service" },
        { id: "jobStore",      label: "Job Store",      kind: "store" },
      ]}
      steps={[
        { from: "scheduler",     to: "scheduler",     label: "scan for due jobs",                        variant: "redirect" },
        { from: "scheduler",     to: "dispatchQueue", label: "enqueue due job",                          variant: "async" },
        { from: "dispatchQueue", to: "worker",        label: "deliver job under lease",                  variant: "redirect" },
        { from: "worker",        to: "worker",        label: "claim lease + begin execution",            variant: "control" },
        { from: "worker",        to: "dispatchQueue", label: "ack + mark done",                         variant: "control" },
        { from: "worker",        to: "jobStore",      label: "compute next fire time + update record",   variant: "create" },
      ]}
    />
  );
}

export function LeaseRecoverySequence() {
  return (
    <Sequence
      title="Sequence: lease recovery — re-claim a crashed worker's job"
      caption="If a worker dies mid-job, its lease expires and another worker re-claims the job so it still runs (at-least-once) — which is why jobs must be idempotent. The lease timeout is the maximum delay between a crash and a re-claim."
      actors={[
        { id: "workerA",       label: "Worker A",       kind: "service" },
        { id: "dispatchQueue", label: "Dispatch Queue", kind: "queue" },
        { id: "workerB",       label: "Worker B",       kind: "service" },
      ]}
      steps={[
        { from: "dispatchQueue", to: "workerA",       label: "deliver job under lease",               variant: "redirect" },
        { from: "workerA",       to: "workerA",       label: "claim lease + begin execution",         variant: "control" },
        { from: "workerA",       to: "workerA",       label: "crash — lease not renewed",             variant: "control" },
        { from: "dispatchQueue", to: "dispatchQueue", label: "lease expires — job becomes visible",   variant: "control" },
        { from: "dispatchQueue", to: "workerB",       label: "re-deliver job to new worker",          variant: "redirect" },
        { from: "workerB",       to: "workerB",       label: "claim lease + run to completion",       variant: "create" },
      ]}
    />
  );
}

export function RetryBackoffSequence() {
  return (
    <Sequence
      title="Sequence: retry with backoff, then dead-letter"
      caption="A failed job is re-enqueued with exponential backoff up to a maximum attempt count, then moved to the dead-letter queue for inspection — transient failures self-heal while permanent ones are quarantined."
      actors={[
        { id: "worker",   label: "Worker",     kind: "service" },
        { id: "jobStore", label: "Job Store",  kind: "store" },
        { id: "dlq",      label: "Retry / DLQ", kind: "queue" },
      ]}
      steps={[
        { from: "worker",   to: "worker",   label: "run job — failure occurs",                     variant: "control" },
        { from: "worker",   to: "jobStore", label: "increment attempt count",                      variant: "create" },
        { from: "jobStore", to: "worker",   label: "attempt count + max retries returned",         variant: "redirect", reply: true },
        { from: "worker",   to: "dlq",      label: "if under max: re-enqueue with backoff + jitter", variant: "async" },
        { from: "worker",   to: "dlq",      label: "if over max: move to dead-letter queue",       variant: "control" },
      ]}
    />
  );
}
