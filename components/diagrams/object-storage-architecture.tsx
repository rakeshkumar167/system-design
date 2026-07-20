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
  client:   { x: 24,  y: 168, w: 150, h: 56 },
  api:      { x: 220, y: 168, w: 150, h: 56 },
  meta:     { x: 220, y: 64,  w: 150, h: 56 },
  coder:    { x: 430, y: 168, w: 150, h: 56 },
  storage:  { x: 640, y: 168, w: 150, h: 60 },
  scrubber: { x: 640, y: 300, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function ObjectStorageArchitecture() {
  return (
    <DiagramFrame
      title="Object storage architecture: client, object API, metadata service, erasure coder, storage nodes, and background scrubber"
      viewBox="0 0 820 470"
      caption="A client's PUT or GET hits the stateless Object API, which looks up (or commits) the object's fragment locations in the Metadata Service — a sharded index over a flat key namespace, kept entirely separate from the bytes. The Erasure Coder splits each object into data and parity fragments and distributes them across Storage Nodes in independent failure domains; a read fetches any k of them and reconstructs if some are missing. A background Scrubber continuously re-reads fragments, verifies checksums, and rebuilds anything corrupt or lost. Durability comes from spreading erasure-coded fragments across independent failure domains, not from keeping full replicas."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={44} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={220} y={44} bold size={11} muted>CONTROL PLANE</DiagramText>
      <DiagramText x={430} y={44} bold size={11} muted>DATA PLANE</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.client)} to={anchors.left(N.api)} variant="ingress" label="PUT / GET" />
      <Edge from={anchors.top(N.api)} to={anchors.bottom(N.meta)} variant="control" label="key → locations" labelOffset={6} />
      <Edge from={anchors.right(N.api)} to={anchors.left(N.coder)} variant="redirect" label="encode / decode" />
      <Edge from={anchors.right(N.coder)} to={anchors.left(N.storage)} variant="create" label="distribute fragments" />
      <Edge from={anchors.top(N.scrubber)} to={anchors.bottom(N.storage)} variant="async" label="scrub & repair" labelOffset={6} />

      {/* Nodes */}
      <Node geom={N.client}   kind="external" label="Client"           sublabel="PUT / GET objects" />
      <Node geom={N.api}      kind="service"  label="Object API"        sublabel="stateless" />
      <Node geom={N.meta}     kind="store"    label="Metadata Service"  sublabel="key → fragments" />
      <Node geom={N.coder}    kind="service"  label="Erasure Coder"     sublabel="k data + m parity" />
      <Node geom={N.storage}  kind="store"    label="Storage Nodes"     sublabel="fragments · failure domains" />
      <Node geom={N.scrubber} kind="service"  label="Scrubber / Repair" sublabel="background integrity" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Request" },
          { variant: "control",  label: "Metadata" },
          { variant: "redirect", label: "Encode / decode" },
          { variant: "create",   label: "Distribute" },
          { variant: "async",    label: "Scrub / repair" },
        ]}
      />
    </DiagramFrame>
  );
}
