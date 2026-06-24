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

export function EditBroadcastSequence() {
  return (
    <Sequence
      title="Sequence: edit broadcast — optimistic local apply then server-ordered fan-out"
      caption="Edits apply locally the instant the user types (optimistic apply), so the UI feels instant. The operation is then sent to the Collaboration Service, which assigns a monotonic sequence number, appends it to the durable op log, and acknowledges the originating editor. The ordered op is then broadcast to every other collaborator in the session, who apply it to their local state. All replicas stay consistent because operations are ordered by the server before distribution."
      actors={[
        { id: "editorA", label: "Editor A", kind: "infra" },
        { id: "collab",  label: "Collaboration Service", kind: "service" },
        { id: "editorB", label: "Editor B", kind: "infra" },
      ]}
      steps={[
        { from: "editorA", to: "editorA", label: "apply op locally (optimistic)",          variant: "create" },
        { from: "editorA", to: "collab",  label: "send op {type, pos, content, client_seq}", variant: "ingress" },
        { from: "collab",  to: "collab",  label: "assign seq number + append to op log",   variant: "create" },
        { from: "collab",  to: "editorA", label: "ack {server_seq}",                        variant: "redirect", reply: true },
        { from: "collab",  to: "editorB", label: "broadcast op {server_seq, op}",           variant: "async" },
        { from: "editorB", to: "editorB", label: "apply ordered op to local state",         variant: "create" },
      ]}
    />
  );
}

export function ConflictResolutionSequence() {
  return (
    <Sequence
      title="Sequence: conflict resolution — concurrent edits transformed so no update is lost"
      caption="When two editors modify the same position concurrently, both operations arrive at the Collaboration Service in an arbitrary order. The server orders them by sequence number and applies an Operational Transformation (OT) or CRDT merge: the later-arriving op is transformed against the earlier one so neither edit is lost. Both editors receive the transformed operations and apply them in the same server-assigned order, so all replicas converge to an identical document state with intention preservation."
      actors={[
        { id: "editorA", label: "Editor A", kind: "infra" },
        { id: "collab",  label: "Collaboration Service", kind: "service" },
        { id: "editorB", label: "Editor B", kind: "infra" },
      ]}
      steps={[
        { from: "editorA", to: "collab",  label: "op A: insert 'X' at pos 5",              variant: "ingress" },
        { from: "editorB", to: "collab",  label: "op B: insert 'Y' at pos 5 (concurrent)", variant: "ingress" },
        { from: "collab",  to: "collab",  label: "order ops: A(seq=1), B(seq=2)",           variant: "create" },
        { from: "collab",  to: "collab",  label: "transform B against A → insert 'Y' at pos 6", variant: "create" },
        { from: "collab",  to: "editorA", label: "broadcast transformed op B {seq=2}",     variant: "async" },
        { from: "collab",  to: "editorB", label: "ack op B as transformed + send op A {seq=1}", variant: "redirect", reply: true },
        { from: "editorA", to: "editorA", label: "apply transformed B — replicas align",   variant: "create" },
        { from: "editorB", to: "editorB", label: "apply op A + transformed B — replicas align", variant: "create" },
      ]}
    />
  );
}

export function PresenceSequence() {
  return (
    <Sequence
      title="Sequence: presence and cursor awareness — ephemeral channel separate from op log"
      caption="Presence (cursor positions, selections, active users) is ephemeral and lossy — dropped frames are acceptable because the next update arrives within milliseconds. Presence updates travel through the Presence Service on a dedicated channel and are never written to the durable op log. This keeps the op log clean, bounded in size, and replayable without cursor noise. When a user disconnects, their presence entry expires automatically via TTL."
      actors={[
        { id: "editorA",  label: "Editor A",        kind: "infra" },
        { id: "presence", label: "Presence Service", kind: "cache" },
        { id: "editorB",  label: "Editor B",         kind: "infra" },
      ]}
      steps={[
        { from: "editorA",  to: "presence", label: "cursor moved → send presence update {pos, user_id}", variant: "control" },
        { from: "presence", to: "presence", label: "update ephemeral state (TTL 30 s)",                  variant: "control" },
        { from: "presence", to: "editorB",  label: "fan-out presence update to session peers",            variant: "control" },
        { from: "editorB",  to: "editorB",  label: "render remote cursor overlay",                       variant: "control" },
        { from: "editorA",  to: "presence", label: "cursor moved again (lossy — may skip frames)",       variant: "control" },
        { from: "presence", to: "editorB",  label: "fan-out latest cursor state (stale frames dropped)", variant: "control" },
      ]}
    />
  );
}

export function ReconnectSyncSequence() {
  return (
    <Sequence
      title="Sequence: reconnect and catch-up sync — delta from op log since last known version"
      caption="When an editor reconnects after a network interruption it sends its last acknowledged sequence number. The Collaboration Service reads all operations after that sequence from the durable op log and delivers the exact delta to the client. The client applies the catch-up ops in order, reconciling any optimistically-applied local ops via transform, then resumes live editing as if it never disconnected. This makes the op log the single source of truth for recovery: no special snapshot logic is needed for short gaps."
      actors={[
        { id: "editor", label: "Editor",                 kind: "infra" },
        { id: "collab", label: "Collaboration Service",  kind: "service" },
        { id: "oplog",  label: "Op Log",                 kind: "store" },
      ]}
      steps={[
        { from: "editor", to: "editor", label: "network interruption — ops buffered locally",          variant: "control" },
        { from: "editor", to: "collab", label: "reconnect WS + send {last_seq: N}",                   variant: "ingress" },
        { from: "collab", to: "oplog",  label: "read ops WHERE seq > N (catch-up range)",              variant: "redirect" },
        { from: "oplog",  to: "collab", label: "ops N+1 … current streamed back",                     variant: "redirect", reply: true },
        { from: "collab", to: "editor", label: "deliver catch-up delta {ops[N+1…current]}",           variant: "create" },
        { from: "editor", to: "editor", label: "apply delta + transform buffered local ops → in sync", variant: "create" },
      ]}
    />
  );
}
