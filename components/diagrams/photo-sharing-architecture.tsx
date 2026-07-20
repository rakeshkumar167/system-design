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
  client:   { x: 24,  y: 150, w: 150, h: 56 },
  api:      { x: 220, y: 150, w: 150, h: 56 },
  objstore: { x: 430, y: 150, w: 150, h: 60 },
  cdn:      { x: 640, y: 150, w: 150, h: 56 },
  meta:     { x: 220, y: 300, w: 150, h: 56 },
  pipeline: { x: 430, y: 300, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function PhotoSharingArchitecture() {
  return (
    <DiagramFrame
      title="Photo sharing architecture: client, app/API, object store, metadata DB, async image pipeline, and CDN"
      viewBox="0 0 820 470"
      caption="On upload, the app stores the original in the Object Store, records the photo in the Metadata DB, and enqueues an asynchronous processing job. The Image Pipeline's workers read the original and generate the derivative sizes and formats, writing them back to the object store. On view, clients fetch images from the CDN, which fills from the object store on a miss and serves the overwhelming majority of read traffic from the edge, so the app tier and object store barely touch image bytes. The design is a write-amplified async media pipeline feeding a read-dominated, CDN-served delivery path."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={44} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={430} y={44} bold size={11} muted>STORAGE</DiagramText>
      <DiagramText x={640} y={44} bold size={11} muted>DELIVERY</DiagramText>
      <DiagramText x={220} y={278} bold size={11} muted>APP TIER + PIPELINE</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.client)} to={anchors.left(N.api)} variant="ingress" label="upload / view" />
      <Edge from={anchors.bottom(N.api)} to={anchors.top(N.meta)} variant="control" label="photo metadata" labelOffset={6} />
      <Edge from={anchors.right(N.api)} to={anchors.left(N.objstore)} variant="create" label="store original" />
      <Edge from={anchors.bottom(N.api)} to={anchors.left(N.pipeline)} variant="async" label="enqueue process" labelOffset={-8} />
      <Edge from={anchors.top(N.pipeline)} to={anchors.bottom(N.objstore)} variant="create" label="write derivatives" labelOffset={6} />
      <Edge from={anchors.right(N.objstore)} to={anchors.left(N.cdn)} variant="redirect" label="origin → CDN" />

      {/* Nodes */}
      <Node geom={N.client}   kind="external" label="Client"        sublabel="upload / view" />
      <Node geom={N.api}      kind="service"  label="App / API"     sublabel="orchestrates" />
      <Node geom={N.objstore} kind="store"    label="Object Store"  sublabel="originals + derivatives" />
      <Node geom={N.cdn}      kind="infra"    label="CDN"           sublabel="edge delivery" />
      <Node geom={N.meta}     kind="store"    label="Metadata DB"   sublabel="photos · albums · social" />
      <Node geom={N.pipeline} kind="service"  label="Image Pipeline" sublabel="derivative workers" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Request" },
          { variant: "control",  label: "Metadata" },
          { variant: "create",   label: "Store / derive" },
          { variant: "async",    label: "Enqueue" },
          { variant: "redirect", label: "CDN fill" },
        ]}
      />
    </DiagramFrame>
  );
}
