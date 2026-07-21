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
  user:    { x: 24,  y: 88,  w: 150, h: 56 },
  routing: { x: 220, y: 88,  w: 150, h: 56 },
  edge:    { x: 430, y: 88,  w: 150, h: 56 },
  shield:  { x: 640, y: 88,  w: 150, h: 56 },
  control: { x: 430, y: 260, w: 150, h: 56 },
  origin:  { x: 640, y: 260, w: 150, h: 60 },
} satisfies Record<string, NodeGeom>;

export function CdnArchitecture() {
  return (
    <DiagramFrame
      title="Content delivery network architecture: request routing, edge PoP, origin shield, origin, and control plane"
      viewBox="0 0 820 360"
      caption="A request never has to reach the origin to get an answer if it doesn't have to. Anycast or GeoDNS routing steers each user to their nearest healthy edge point of presence; a local hit is served in a handful of milliseconds without the origin ever knowing the request happened. A miss climbs one tier to a mid-layer cache that collapses many edges' misses for the same object into one upstream fetch before fanning the result back out. The origin only ever sees the sliver of traffic that both tiers missed — the cache-hit ratio is what determines how thin that sliver is. A separate control plane pushes configuration and purge instructions down to the edge, out of band from the request path."
    >
      <DiagramDefs />

      <DiagramText x={24}  y={64}  bold size={11} muted>DELIVERY PATH</DiagramText>
      <DiagramText x={430} y={240} bold size={11} muted>CONTROL PATH</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.user)} to={anchors.left(N.routing)} variant="ingress" label="request" />
      <Edge from={anchors.right(N.routing)} to={anchors.left(N.edge)} variant="redirect" label="nearest healthy PoP" />
      <Edge from={anchors.top(N.control)} to={anchors.bottom(N.edge)} variant="async" label="config / purge" labelOffset={-8} />
      <Edge from={{ x: N.edge.x + N.edge.w, y: N.edge.y + 18 }} to={{ x: N.shield.x, y: N.shield.y + 18 }} variant="control" label="on miss" labelOffset={-8} />
      <Edge from={{ x: N.shield.x, y: N.shield.y + 38 }} to={{ x: N.edge.x + N.edge.w, y: N.edge.y + 38 }} variant="redirect" label="serve" labelOffset={10} />
      <Edge from={{ x: N.shield.x + 45, y: N.shield.y + N.shield.h }} to={{ x: N.origin.x + 45, y: N.origin.y }} variant="control" label="coalesced fetch" labelOffset={-6} />
      <Edge from={{ x: N.origin.x + 105, y: N.origin.y }} to={{ x: N.shield.x + 105, y: N.shield.y + N.shield.h }} variant="create" label="fill" labelOffset={10} />

      {/* Nodes */}
      <Node geom={N.user}    kind="external" label="User"            sublabel="requests content" />
      <Node geom={N.routing} kind="infra"    label="Request Routing" sublabel="Anycast / GeoDNS" />
      <Node geom={N.edge}    kind="cache"    label="Edge PoP"        sublabel="close to the user" />
      <Node geom={N.shield}  kind="cache"    label="Origin Shield"   sublabel="mid-tier cache" />
      <Node geom={N.control} kind="service"  label="Control Plane"   sublabel="config + purge" />
      <Node geom={N.origin}  kind="store"    label="Origin"          sublabel="source of truth" />

      <Legend
        x={24}
        y={330}
        items={[
          { variant: "ingress",  label: "Request" },
          { variant: "redirect", label: "Route / serve" },
          { variant: "control",  label: "Miss / coalesced fetch" },
          { variant: "create",   label: "Fill" },
          { variant: "async",    label: "Config / purge" },
        ]}
      />
    </DiagramFrame>
  );
}
