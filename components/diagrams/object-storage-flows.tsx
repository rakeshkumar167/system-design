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

export function PutObjectSequence() {
  return (
    <Sequence
      title="Sequence: write (PUT) an object"
      caption="The object is checksummed, split by the erasure coder into data and parity fragments, and those fragments are written across storage nodes in separate failure domains. Only after the fragments are durably stored does the API commit the key-to-location mapping in the metadata service — the metadata is committed last, so a half-written object is never visible, and any fragments left behind by a failed upload are simply garbage-collected later."
      actors={[
        { id: "client",  label: "Client",           kind: "external" },
        { id: "api",     label: "Object API",        kind: "service" },
        { id: "coder",   label: "Erasure Coder",     kind: "infra" },
        { id: "storage", label: "Storage Nodes",     kind: "store" },
        { id: "meta",    label: "Metadata Service",   kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "api",     label: "PUT object + checksum",          variant: "ingress" },
        { from: "api",     to: "coder",   label: "erasure-code into k + m",        variant: "control" },
        { from: "coder",   to: "storage", label: "distribute fragments (domains)", variant: "create" },
        { from: "storage", to: "api",     label: "fragments durably stored",       variant: "redirect", reply: true },
        { from: "api",     to: "meta",    label: "commit key → locations",         variant: "create" },
        { from: "api",     to: "client",  label: "200 OK (ETag)",                  variant: "redirect", reply: true },
      ]}
    />
  );
}

export function MultipartUploadSequence() {
  return (
    <Sequence
      title="Sequence: multipart upload of a large object"
      caption="A large object is uploaded in parts: the client initiates the upload to get an upload id, sends the parts in parallel, and finally issues a complete call that stitches the part list into a single object. Each part uploads and retries independently, so a multi-gigabyte object survives flaky networks — a dropped part is re-sent without restarting the whole transfer — and parts upload concurrently for throughput."
      actors={[
        { id: "client",  label: "Client",       kind: "external" },
        { id: "api",     label: "Object API",    kind: "service" },
        { id: "storage", label: "Storage Nodes", kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "api",     label: "initiate multipart upload",     variant: "ingress" },
        { from: "api",     to: "client",  label: "uploadId",                       variant: "redirect", reply: true },
        { from: "client",  to: "api",     label: "upload parts 1..N (parallel)",   variant: "ingress" },
        { from: "api",     to: "storage", label: "store each part (erasure-coded)", variant: "create" },
        { from: "client",  to: "api",     label: "complete: part list + ETags",    variant: "ingress" },
        { from: "api",     to: "client",  label: "assembled object",               variant: "redirect", reply: true },
      ]}
    />
  );
}

export function GetObjectSequence() {
  return (
    <Sequence
      title="Sequence: read (GET) an object"
      caption="A read resolves the object's fragment locations from the metadata service, then fetches fragments from the storage nodes. Any k of the total fragments are enough to reconstruct the object, so a slow or failed node is simply bypassed — the API reads from the fastest responders and rebuilds from parity if a data fragment is missing, which gives failure tolerance and better tail latency for free."
      actors={[
        { id: "client",  label: "Client",           kind: "external" },
        { id: "api",     label: "Object API",        kind: "service" },
        { id: "meta",    label: "Metadata Service",   kind: "store" },
        { id: "storage", label: "Storage Nodes",     kind: "store" },
      ]}
      steps={[
        { from: "client",  to: "api",     label: "GET object",                    variant: "ingress" },
        { from: "api",     to: "meta",    label: "look up fragment locations",    variant: "control" },
        { from: "meta",    to: "api",     label: "locations + checksum",          variant: "redirect", reply: true },
        { from: "api",     to: "storage", label: "fetch fragments",               variant: "redirect" },
        { from: "storage", to: "api",     label: "k fragments (fastest first)",   variant: "redirect", reply: true },
        { from: "api",     to: "client",  label: "reconstruct & stream",          variant: "create", reply: true },
      ]}
    />
  );
}

export function ScrubRepairSequence() {
  return (
    <Sequence
      title="Sequence: scrub and repair a corrupt fragment"
      caption="Disks silently corrupt data over time, so a background scrubber continuously re-reads fragments and verifies their checksums. When it finds a fragment that is corrupt or missing, it reconstructs it from the surviving fragments and rewrites it, restoring full redundancy before enough are lost to threaten the object — this continuous background repair is what sustains durability over years, not the initial write."
      actors={[
        { id: "scrub",   label: "Scrubber",       kind: "service" },
        { id: "storage", label: "Storage Nodes",  kind: "store" },
      ]}
      steps={[
        { from: "scrub",   to: "storage", label: "read fragment + verify checksum", variant: "control" },
        { from: "storage", to: "scrub",   label: "checksum mismatch / missing",     variant: "redirect", reply: true },
        { from: "scrub",   to: "storage", label: "fetch surviving fragments",       variant: "control" },
        { from: "scrub",   to: "scrub",   label: "reconstruct lost fragment",       variant: "control" },
        { from: "scrub",   to: "storage", label: "rewrite repaired fragment",       variant: "create" },
      ]}
    />
  );
}
