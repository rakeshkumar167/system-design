import {
  DiagramDefs,
  DiagramText,
  Edge,
  Legend,
  Node,
  anchors,
  type NodeGeom,
} from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

const N = {
  editor:               { x: 24,  y: 190, w: 120, h: 56 },
  wsGateway:            { x: 208, y: 190, w: 140, h: 56 },
  collaborationService: { x: 420, y: 190, w: 160, h: 56 },
  opLog:                { x: 650, y: 80,  w: 130, h: 60 },
  snapshotStore:        { x: 650, y: 190, w: 130, h: 60 },
  pubSub:               { x: 650, y: 310, w: 130, h: 56 },
  presenceService:      { x: 420, y: 350, w: 160, h: 56 },
  metadataDb:           { x: 208, y: 350, w: 140, h: 60 },
} satisfies Record<string, NodeGeom>;

export function CollaborativeDocEditorArchitecture() {
  return (
    <DiagramFrame
      title="Collaborative document editor architecture: editor, WS gateway, collaboration service, op log, pub/sub, presence"
      viewBox="0 0 820 470"
      caption="Editors connect via persistent WebSockets to a WS Gateway, which routes each session to a Collaboration Service shard by doc_id so all editors of a document land on the same shard. The Collaboration Service assigns each incoming operation a monotonic sequence number, appends it to the durable Op Log (the source of truth for all replicas), and applies OT or CRDT merging to guarantee convergence — all replicas converge to the same document state with no lost updates. The service then publishes the ordered op to Pub/Sub for low-latency fan-out to every other editor in the session. Periodic snapshots are written to Snapshot Store to bound replay cost. Cursor and selection state flows through the ephemeral Presence Service on a separate lossy channel, never written to the Op Log. Access control reads come from Metadata DB. The dominant load is fan-out over persistent connections and connection state, not raw bandwidth."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={208} y={46} bold size={11} muted>GATEWAY</DiagramText>
      <DiagramText x={420} y={46} bold size={11} muted>COLLABORATION</DiagramText>
      <DiagramText x={650} y={46} bold size={11} muted>STORAGE / BUS</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Editor → WS Gateway (edit ops) */}
      <Edge
        from={anchors.right(N.editor)}
        to={anchors.left(N.wsGateway)}
        variant="ingress"
        label="edit ops"
      />

      {/* WS Gateway → Editor (broadcast) */}
      <Edge
        from={{ x: N.wsGateway.x, y: N.wsGateway.y + N.wsGateway.h / 2 + 10 }}
        to={{ x: N.editor.x + N.editor.w, y: N.editor.y + N.editor.h / 2 + 10 }}
        variant="redirect"
        label="broadcast"
        labelOffset={10}
      />

      {/* WS Gateway → Collaboration Service (route by doc_id) */}
      <Edge
        from={anchors.right(N.wsGateway)}
        to={anchors.left(N.collaborationService)}
        variant="create"
        label="route by doc_id"
      />

      {/* Collaboration Service → Op Log (append op) */}
      <Edge
        from={anchors.top(N.collaborationService)}
        to={anchors.bottom(N.opLog)}
        variant="create"
        label="append op"
        labelOffset={-8}
      />

      {/* Collaboration Service → Snapshot Store (snapshot) */}
      <Edge
        from={anchors.right(N.collaborationService)}
        to={anchors.left(N.snapshotStore)}
        variant="create"
        label="snapshot"
      />

      {/* Collaboration Service → Pub/Sub (fan-out) */}
      <Edge
        from={anchors.bottom(N.collaborationService)}
        to={anchors.top(N.pubSub)}
        variant="async"
        label="fan-out"
        labelOffset={-8}
      />

      {/* Collaboration Service → Presence Service (cursors) */}
      <Edge
        from={anchors.bottom(N.collaborationService)}
        to={anchors.right(N.presenceService)}
        variant="control"
        label="cursors"
        labelOffset={10}
      />

      {/* Collaboration Service → Metadata DB (read ACL) */}
      <Edge
        from={anchors.bottom(N.collaborationService)}
        to={anchors.top(N.metadataDb)}
        variant="redirect"
        label="read ACL"
        labelOffset={-8}
      />

      {/* Nodes */}
      <Node geom={N.editor}               kind="infra"   label="Editor"                sublabel="browser / app" />
      <Node geom={N.wsGateway}            kind="service" label="WS Gateway"            sublabel="persistent websockets" />
      <Node geom={N.collaborationService} kind="service" label="Collaboration Service" sublabel="OT / CRDT + ordering" />
      <Node geom={N.opLog}               kind="store"   label="Op Log"               sublabel="append-only ops" />
      <Node geom={N.snapshotStore}       kind="store"   label="Snapshot Store"       sublabel="periodic compaction" />
      <Node geom={N.pubSub}              kind="queue"   label="Pub/Sub"              sublabel="broadcast bus" />
      <Node geom={N.presenceService}     kind="cache"   label="Presence Service"     sublabel="ephemeral cursors" />
      <Node geom={N.metadataDb}          kind="store"   label="Metadata DB"          sublabel="ACL + doc metadata" />

      <Legend
        x={24}
        y={425}
        items={[
          { variant: "ingress",  label: "Client edit ops" },
          { variant: "create",   label: "Write / route op" },
          { variant: "redirect", label: "Broadcast / read ACL" },
          { variant: "async",    label: "Async pub/sub fan-out" },
          { variant: "control",  label: "Ephemeral presence" },
          { kind: "cache",       label: "Presence (ephemeral)" },
        ]}
      />
    </DiagramFrame>
  );
}
