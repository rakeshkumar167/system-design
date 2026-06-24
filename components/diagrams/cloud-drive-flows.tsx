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

export function FileUploadSequence() {
  return (
    <Sequence
      title="Sequence: file upload — chunk, dedup, then commit metadata"
      caption="The client chunks the file and content-hashes each chunk. Only blocks the server does not already have are uploaded (dedup check avoids re-transmitting known blocks). Once all new blocks are stored, the client commits the new FileVersion — an immutable ordered list of block hashes — to the Metadata Service. The top bar is durability: blocks are persisted before the version is committed."
      actors={[
        { id: "client",       label: "Client",           kind: "infra" },
        { id: "blockSvc",     label: "Block Service",    kind: "service" },
        { id: "metadataSvc",  label: "Metadata Service", kind: "service" },
      ]}
      steps={[
        { from: "client",      to: "client",      label: "chunk file + hash each block",                   variant: "control" },
        { from: "client",      to: "blockSvc",    label: "ask which block hashes are missing (dedup check)", variant: "ingress" },
        { from: "blockSvc",    to: "client",      label: "list of block hashes not yet stored",             variant: "redirect", reply: true },
        { from: "client",      to: "blockSvc",    label: "upload only new blocks",                          variant: "create" },
        { from: "client",      to: "metadataSvc", label: "commit version (block list + base version)",      variant: "create" },
        { from: "metadataSvc", to: "client",      label: "ack — new version published",                     variant: "redirect", reply: true },
      ]}
    />
  );
}

export function DeltaSyncSequence() {
  return (
    <Sequence
      title="Sequence: delta sync — transfer only the changed chunks"
      caption="When a file is edited, the client re-chunks it and diffs the new chunk list against the previous version's block hashes. Only the changed blocks are uploaded; unchanged blocks are referenced by their existing hash. The version commit records the full block list (unchanged + new). This cuts upload bandwidth roughly proportional to the fraction of changed content — the core bandwidth win that makes large-file editing practical."
      actors={[
        { id: "client",       label: "Client",           kind: "infra" },
        { id: "blockSvc",     label: "Block Service",    kind: "service" },
        { id: "metadataSvc",  label: "Metadata Service", kind: "service" },
      ]}
      steps={[
        { from: "client",      to: "client",      label: "file edited locally — re-chunk, diff block list",     variant: "control" },
        { from: "client",      to: "blockSvc",    label: "upload only the few changed blocks",                   variant: "create" },
        { from: "blockSvc",    to: "client",      label: "blocks stored",                                        variant: "redirect", reply: true },
        { from: "client",      to: "metadataSvc", label: "commit version referencing unchanged blocks by hash",  variant: "create" },
        { from: "metadataSvc", to: "client",      label: "ack — new version published",                          variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ChangeNotificationSequence() {
  return (
    <Sequence
      title="Sequence: change notification — cursor catch-up after a commit"
      caption="After a commit, other devices need to learn about the new version without polling the full metadata store. The Metadata Service emits a change event to the Notification Service, which delivers it to the user's connected devices. Each device knows its last-seen cursor position and pulls only the metadata delta since that cursor, then fetches only the new blocks it lacks. This is convergence without continuous polling."
      actors={[
        { id: "metadataSvc",     label: "Metadata Service",  kind: "service" },
        { id: "notificationSvc", label: "Notification Svc",  kind: "queue" },
        { id: "otherDevice",     label: "Other Device",      kind: "infra" },
      ]}
      steps={[
        { from: "metadataSvc",     to: "notificationSvc", label: "commit raises a change event",                      variant: "async" },
        { from: "notificationSvc", to: "otherDevice",     label: "notify: new version available",                     variant: "async" },
        { from: "otherDevice",     to: "metadataSvc",     label: "pull metadata delta since cursor",                  variant: "ingress" },
        { from: "metadataSvc",     to: "otherDevice",     label: "metadata delta returned (new block hashes)",        variant: "redirect", reply: true },
        { from: "otherDevice",     to: "otherDevice",     label: "fetch new blocks, apply locally, advance cursor",   variant: "create" },
      ]}
    />
  );
}

export function ConflictSequence() {
  return (
    <Sequence
      title="Sequence: conflict — concurrent edits become a conflicted copy"
      caption="When two devices edit the same file from the same base version and both attempt to commit, the first commit succeeds. The second commit arrives with a stale base version — the Metadata Service detects the mismatch and rejects a silent merge. Instead, the second device's edit is stored as a conflicted copy: a new file alongside the winning version. Neither edit is lost. This is intentionally simpler than operational transformation — the system trades seamless merge for predictable, auditable conflict visibility."
      actors={[
        { id: "deviceA",      label: "Device A",          kind: "infra" },
        { id: "metadataSvc",  label: "Metadata Service",  kind: "service" },
        { id: "deviceB",      label: "Device B",          kind: "infra" },
      ]}
      steps={[
        { from: "deviceA",     to: "metadataSvc", label: "both edit from base version N (concurrent)",             variant: "ingress" },
        { from: "deviceA",     to: "metadataSvc", label: "Device A commits — accepted as version N+1",             variant: "create" },
        { from: "metadataSvc", to: "deviceA",     label: "ack — version N+1 published",                            variant: "redirect", reply: true },
        { from: "deviceB",     to: "metadataSvc", label: "Device B commits based on stale version N",              variant: "create" },
        { from: "metadataSvc", to: "metadataSvc", label: "stale base detected — version N already superseded",     variant: "control" },
        { from: "metadataSvc", to: "deviceB",     label: "stored as conflicted copy — both versions preserved",    variant: "async", reply: true },
      ]}
    />
  );
}
