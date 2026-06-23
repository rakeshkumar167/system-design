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
  client:     { x: 24,  y: 240, w: 104, h: 56 },
  cdn:        { x: 168, y: 240, w: 130, h: 56 },
  app:        { x: 346, y: 240, w: 140, h: 56 },
  metaDb:     { x: 540, y: 140, w: 150, h: 82 },
  objStore:   { x: 540, y: 340, w: 150, h: 82 },
  expWorker:  { x: 346, y: 440, w: 140, h: 56 },
} satisfies Record<string, NodeGeom>;

export function PastebinArchitecture() {
  return (
    <DiagramFrame
      title="Pastebin architecture: CDN, app, metadata layer, and expiry worker"
      viewBox="0 0 760 580"
      caption="Content is immutable once written, making it safe for long-lived CDN caching. On a read, the CDN serves cached content directly; on a CDN miss it asks the App/API to fetch the blob from object storage and backfills the edge cache with a long TTL. Metadata (expiry, visibility, blob_key pointer) lives in the Metadata DB — a small, fast database separate from the blob store. The Expiry Worker runs independently, sweeping the Metadata DB for expired rows and deleting the corresponding blobs from object storage, keeping storage costs bounded."
    >
      <DiagramDefs />

      {/* Edges drawn before nodes */}

      {/* Read path: Client → CDN → App */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.cdn)}
        variant="redirect"
        label="GET /{id}/raw"
      />
      <Edge
        from={anchors.right(N.cdn)}
        to={anchors.left(N.app)}
        variant="redirect"
        label="CDN miss"
      />

      {/* App → Metadata DB */}
      <Edge
        from={anchors.top(N.app)}
        to={anchors.bottom(N.metaDb)}
        variant="create"
        label="read/write metadata"
        labelOffset={0}
      />

      {/* App → Object Storage (read blob + write blob on create) */}
      <Edge
        from={anchors.bottom(N.app)}
        to={anchors.top(N.objStore)}
        variant="create"
        label="read/write blob"
        labelOffset={0}
      />

      {/* App → CDN backfill on miss */}
      <Edge
        from={anchors.left(N.app)}
        to={anchors.right(N.cdn)}
        variant="redirect"
        label="CDN backfill"
        labelOffset={-16}
      />

      {/* Expiry Worker → Metadata DB */}
      <Edge
        from={anchors.right(N.expWorker)}
        to={anchors.bottom(N.metaDb)}
        variant="control"
        label="sweep expired rows"
      />

      {/* Expiry Worker → Object Storage */}
      <Edge
        from={anchors.right(N.expWorker)}
        to={anchors.left(N.objStore)}
        variant="async"
        label="delete expired blobs"
      />

      {/* Nodes */}
      <Node geom={N.client}    kind="infra"   label="Client" />
      <Node geom={N.cdn}       kind="cache"   label="CDN" sublabel="edge cache" />
      <Node geom={N.app}       kind="service" label="App / API" />
      <Node geom={N.metaDb}    kind="store"   label="Metadata DB" sublabel="id, blob_key, expiry" />
      <Node geom={N.objStore}  kind="store"   label="Blob Store" sublabel="S3-compatible" />
      <Node geom={N.expWorker} kind="queue"   label="Expiry Worker" />

      <Legend
        x={24}
        y={528}
        items={[
          { variant: "redirect", label: "Read path" },
          { variant: "create",   label: "Write / metadata" },
          { variant: "control",  label: "Expiry sweep" },
          { variant: "async",    label: "Async delete" },
          { kind: "cache",       label: "CDN / cache" },
          { kind: "store",       label: "Datastore" },
        ]}
      />
    </DiagramFrame>
  );
}
