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
  client: { x: 24,  y: 168, w: 140, h: 56 },
  node0:  { x: 320, y: 24,  w: 160, h: 56 },
  node1:  { x: 320, y: 168, w: 160, h: 56 },
  node2:  { x: 320, y: 312, w: 160, h: 56 },
  coord:  { x: 610, y: 24,  w: 170, h: 60 },
  clock:  { x: 610, y: 306, w: 170, h: 56 },
} satisfies Record<string, NodeGeom>;

export function SnowflakeArchitecture() {
  return (
    <DiagramFrame
      title="Unique ID generator architecture: client, a fleet of independent ID nodes, a startup coordinator, and a clock"
      viewBox="0 0 820 460"
      caption="Every ID Node mints IDs entirely on its own: it packs a wall-clock timestamp, its own machine id, and a local per-millisecond counter into a 64-bit integer, so generating an ID never touches the network or another node. The Coordinator (ZooKeeper or etcd) is consulted exactly once, at startup, to hand each node a machine id no other node holds — after that handshake, the hot path has zero shared state between nodes."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={320} y={14} bold size={11} muted>HOT PATH · no coordination</DiagramText>
      <DiagramText x={610} y={14} bold size={11} muted>STARTUP · once</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.client)} to={anchors.left(N.node0)} variant="ingress" />
      <Edge from={anchors.right(N.client)} to={anchors.left(N.node1)} variant="ingress" label="get id" />
      <Edge from={anchors.right(N.client)} to={anchors.left(N.node2)} variant="ingress" />

      <Edge from={anchors.left(N.coord)} to={anchors.right(N.node0)} variant="control" />
      <Edge from={anchors.left(N.coord)} to={anchors.right(N.node1)} variant="control" label="assign machine id (startup)" />
      <Edge from={anchors.left(N.coord)} to={anchors.right(N.node2)} variant="control" />

      <Edge from={anchors.left(N.clock)} to={anchors.right(N.node0)} variant="muted" />
      <Edge from={anchors.left(N.clock)} to={anchors.right(N.node1)} variant="muted" label="wall clock (ms)" />
      <Edge from={anchors.left(N.clock)} to={anchors.right(N.node2)} variant="muted" />

      {/* Nodes */}
      <Node geom={N.client} kind="external" label="Client"      sublabel="requests an id" />
      <Node geom={N.node0}  kind="service"  label="ID Node"     sublabel="m = 0" />
      <Node geom={N.node1}  kind="service"  label="ID Node"     sublabel="m = 1" />
      <Node geom={N.node2}  kind="service"  label="ID Node"     sublabel="m = 2" />
      <Node geom={N.coord}  kind="infra"    label="Coordinator" sublabel="ZooKeeper / etcd" />
      <Node geom={N.clock}  kind="external" label="Clock / NTP" sublabel="wall clock" />

      <Legend
        x={24}
        y={420}
        items={[
          { variant: "ingress", label: "Client request (hot path)" },
          { variant: "control", label: "Assign machine id (startup only)" },
          { variant: "muted",   label: "Wall clock feed" },
        ]}
      />
    </DiagramFrame>
  );
}
