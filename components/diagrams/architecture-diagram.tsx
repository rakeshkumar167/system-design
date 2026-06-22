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
  client: { x: 24, y: 281, w: 104, h: 56 },
  edge: { x: 162, y: 281, w: 120, h: 56 },
  gateway: { x: 322, y: 281, w: 132, h: 56 },
  writeSvc: { x: 506, y: 78, w: 140, h: 56 },
  idGen: { x: 716, y: 78, w: 140, h: 56 },
  abuse: { x: 716, y: 166, w: 140, h: 48 },
  store: { x: 506, y: 268, w: 150, h: 82 },
  redirectSvc: { x: 506, y: 452, w: 140, h: 56 },
  cache: { x: 716, y: 452, w: 150, h: 56 },
  stream: { x: 286, y: 452, w: 150, h: 56 },
  worker: { x: 286, y: 544, w: 150, h: 50 },
  olap: { x: 506, y: 546, w: 150, h: 48 },
  obs: { x: 716, y: 546, w: 150, h: 48 },
} satisfies Record<string, NodeGeom>;

export function ArchitectureDiagram() {
  return (
    <DiagramFrame
      title="URL Shortener architecture: separate write and redirect paths sharing a partitioned mapping store"
      viewBox="0 0 1000 660"
      caption="Two paths share one mapping store. On create, the write service reserves a Base62 key from the ID generator and persists the mapping. On a redirect, the redirect service reads cache first and only falls back to the mapping store on a miss, then emits a click event asynchronously to the analytics pipeline so logging never adds latency to the redirect."
    >
      <DiagramDefs />

      {/* Lane labels */}
      <DiagramText x={506} y={64} bold muted size={10.5}>
        CREATE PATH
      </DiagramText>
      <DiagramText x={506} y={438} bold muted size={10.5}>
        REDIRECT PATH
      </DiagramText>
      <DiagramText x={286} y={438} bold muted size={10.5}>
        ASYNC ANALYTICS
      </DiagramText>

      {/* Edges (drawn before nodes so nodes sit on top) */}
      <Edge from={anchors.right(N.client)} to={anchors.left(N.edge)} variant="ingress" label="HTTPS" />
      <Edge from={anchors.right(N.edge)} to={anchors.left(N.gateway)} variant="ingress" />

      {/* Create path */}
      <Edge from={anchors.right(N.gateway)} to={anchors.left(N.writeSvc)} variant="create" label="POST /urls" labelOffset={-8} />
      <Edge from={anchors.right(N.writeSvc)} to={anchors.left(N.idGen)} variant="create" label="reserve id" />
      <Edge from={anchors.bottom(N.writeSvc)} to={anchors.top(N.store)} variant="create" label="write mapping" />
      <Edge from={{ x: N.writeSvc.x + N.writeSvc.w, y: N.writeSvc.y + 42 }} to={anchors.left(N.abuse)} variant="async" label="scan" />

      {/* Redirect path */}
      <Edge from={anchors.right(N.gateway)} to={anchors.left(N.redirectSvc)} variant="redirect" label="GET /{code}" labelOffset={8} />
      <Edge from={anchors.right(N.redirectSvc)} to={anchors.left(N.cache)} variant="redirect" label="read" />
      <Edge from={anchors.top(N.cache)} to={anchors.right(N.store)} variant="redirect" label="on miss" labelOffset={-6} />

      {/* Async analytics */}
      <Edge from={anchors.left(N.redirectSvc)} to={anchors.right(N.stream)} variant="async" label="click event" />
      <Edge from={anchors.bottom(N.stream)} to={anchors.top(N.worker)} variant="async" />
      <Edge from={anchors.right(N.worker)} to={anchors.left(N.olap)} variant="async" label="aggregate" />

      {/* Telemetry */}
      <Edge from={anchors.bottom(N.redirectSvc)} to={anchors.left(N.obs)} variant="muted" label="metrics" />

      {/* Nodes */}
      <Node geom={N.client} kind="infra" label="Client" />
      <Node geom={N.edge} kind="infra" label="Edge / CDN" />
      <Node geom={N.gateway} kind="infra" label="API Gateway" sublabel="+ load balancer" />
      <Node geom={N.writeSvc} kind="service" label="Write Service" />
      <Node geom={N.idGen} kind="service" label="ID Generator" sublabel="Base62 keys" />
      <Node geom={N.abuse} kind="external" label="Abuse Scanner" />
      <Node geom={N.store} kind="store" label="Mapping Store" sublabel="sharded key-value" />
      <Node geom={N.redirectSvc} kind="service" label="Redirect Service" />
      <Node geom={N.cache} kind="cache" label="Distributed Cache" />
      <Node geom={N.stream} kind="queue" label="Event Stream" />
      <Node geom={N.worker} kind="service" label="Analytics Worker" />
      <Node geom={N.olap} kind="store" label="Analytics Store" />
      <Node geom={N.obs} kind="service" label="Observability" />

      <Legend
        x={24}
        y={616}
        items={[
          { variant: "create", label: "Create (sync)" },
          { variant: "redirect", label: "Redirect (sync)" },
          { variant: "async", label: "Async event" },
          { kind: "store", label: "Datastore" },
          { kind: "cache", label: "Cache" },
          { kind: "external", label: "3rd-party" },
        ]}
      />
    </DiagramFrame>
  );
}
