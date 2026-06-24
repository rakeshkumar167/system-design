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
  client:          { x: 24,  y: 210, w: 140, h: 56 },
  syncGateway:     { x: 220, y: 210, w: 140, h: 56 },
  metadataSvc:     { x: 430, y: 90,  w: 150, h: 56 },
  blockSvc:        { x: 430, y: 330, w: 150, h: 56 },
  metadataDb:      { x: 640, y: 90,  w: 140, h: 60 },
  blockStorage:    { x: 640, y: 330, w: 140, h: 60 },
  notificationSvc: { x: 220, y: 370, w: 140, h: 56 },
} satisfies Record<string, NodeGeom>;

export function CloudDriveArchitecture() {
  return (
    <DiagramFrame
      title="Cloud drive architecture: client, sync gateway, metadata service, block service, metadata DB, block storage, notification service"
      viewBox="0 0 820 480"
      caption="The defining decision is the metadata/block split: file content is broken into fixed-size chunks, each content-addressed (identified by its hash) and stored once in the Block Storage object store — this is deduplication. File metadata (the namespace tree, FileVersion records as immutable ordered block-hash lists, ACLs) lives in a separate sharded transactional Metadata DB. Uploads flow through the Sync Gateway: new blocks go to the Block Service (which skips duplicates), and the version commit goes to the Metadata Service. After a commit, the Metadata Service emits a change event to the Notification Service, which fans out to the user's other devices so they can pull the metadata delta since their cursor and fetch only new blocks — delta sync in action."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={220} y={46} bold size={11} muted>GATEWAY / NOTIFY</DiagramText>
      <DiagramText x={430} y={46} bold size={11} muted>SERVICES</DiagramText>
      <DiagramText x={640} y={46} bold size={11} muted>STORAGE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Sync Gateway (upload / sync) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.syncGateway)}
        variant="ingress"
        label="upload / sync"
      />

      {/* Sync Gateway → Metadata Service (commit metadata) */}
      <Edge
        from={anchors.top(N.syncGateway)}
        to={anchors.left(N.metadataSvc)}
        variant="redirect"
        label="commit metadata"
        labelOffset={-8}
      />

      {/* Sync Gateway → Block Service (put new blocks) */}
      <Edge
        from={anchors.bottom(N.syncGateway)}
        to={anchors.left(N.blockSvc)}
        variant="create"
        label="put new blocks"
        labelOffset={8}
      />

      {/* Metadata Service → Metadata DB (persist tree) */}
      <Edge
        from={anchors.right(N.metadataSvc)}
        to={anchors.left(N.metadataDb)}
        variant="create"
        label="persist tree"
      />

      {/* Block Service → Block Storage (store unique blocks) */}
      <Edge
        from={anchors.right(N.blockSvc)}
        to={anchors.left(N.blockStorage)}
        variant="create"
        label="store unique blocks"
      />

      {/* Metadata Service → Notification Svc (change event) */}
      <Edge
        from={anchors.bottom(N.metadataSvc)}
        to={anchors.top(N.notificationSvc)}
        variant="async"
        label="change event"
        labelOffset={0}
      />

      {/* Notification Svc → Client (notify other devices) */}
      <Edge
        from={anchors.left(N.notificationSvc)}
        to={anchors.bottom(N.client)}
        variant="async"
        label="notify other devices"
        labelOffset={8}
      />

      {/* Nodes */}
      <Node geom={N.client}          kind="infra"   label="Client"            sublabel="watcher + chunker" />
      <Node geom={N.syncGateway}     kind="service" label="Sync Gateway"       sublabel="route + orchestrate" />
      <Node geom={N.metadataSvc}     kind="service" label="Metadata Service"   sublabel="namespace + versions" />
      <Node geom={N.blockSvc}        kind="service" label="Block Service"       sublabel="chunk dedup" />
      <Node geom={N.metadataDb}      kind="store"   label="Metadata DB"         sublabel="tree / versions / ACLs" />
      <Node geom={N.blockStorage}    kind="store"   label="Block Storage"        sublabel="object store" />
      <Node geom={N.notificationSvc} kind="queue"   label="Notification Svc"   sublabel="device fan-out" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Client upload / sync" },
          { variant: "redirect", label: "Commit metadata path" },
          { variant: "create",   label: "Write / store blocks" },
          { variant: "async",    label: "Async change notification" },
          { kind: "store",       label: "Storage (metadata DB / object store)" },
          { kind: "queue",       label: "Notification service" },
        ]}
      />
    </DiagramFrame>
  );
}
