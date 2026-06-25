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
  client:          { x: 24,  y: 232, w: 150, h: 56 },
  routingGateway:  { x: 196, y: 232, w: 150, h: 56 },
  mapMatcher:      { x: 372, y: 232, w: 150, h: 56 },
  routeEngine:     { x: 560, y: 232, w: 150, h: 56 },
  graphStore:      { x: 560, y: 80,  w: 150, h: 60 },
  probes:          { x: 24,  y: 392, w: 150, h: 56 },
  trafficPipeline: { x: 196, y: 392, w: 150, h: 56 },
  liveWeights:     { x: 372, y: 392, w: 150, h: 60 },
  tileService:     { x: 760, y: 80,  w: 150, h: 56 },
  cdn:             { x: 760, y: 160, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function MapsNavigationArchitecture() {
  return (
    <DiagramFrame
      title="Maps and Navigation architecture: client, routing gateway, map matcher, route engine, graph and CH store, traffic pipeline, live weights, CDN, and tile service"
      viewBox="0 0 960 520"
      caption="Route requests flow left to right — the map matcher snaps coordinates to graph nodes, then the route engine answers a bidirectional upward search over the precomputed contraction hierarchies held entirely in memory, cutting per-query work by ~62,500× versus plain Dijkstra. Live traffic re-weighting arrives as GPS probe streams aggregated by the traffic pipeline into per-segment edge times; CRP metric customization applies new weights without rebuilding the hierarchy. Map tiles are served from a z/x/y pyramid cached at the CDN edge — only cache misses reach the tile service origin."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={196} y={46} bold size={11} muted>ROUTING</DiagramText>
      <DiagramText x={560} y={46} bold size={11} muted>GRAPH &amp; ENGINE</DiagramText>
      <DiagramText x={760} y={46} bold size={11} muted>TILE SERVING</DiagramText>
      <DiagramText x={24}  y={370} bold size={11} muted>LIVE TRAFFIC</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Routing Gateway (route request) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.routingGateway)}
        variant="ingress"
        label="GET /route"
      />

      {/* Routing Gateway → Map Matcher (snap origin/dest) */}
      <Edge
        from={anchors.right(N.routingGateway)}
        to={anchors.left(N.mapMatcher)}
        variant="create"
        label="snap origin/dest"
      />

      {/* Map Matcher → Route Engine (query path) */}
      <Edge
        from={anchors.right(N.mapMatcher)}
        to={anchors.left(N.routeEngine)}
        variant="create"
        label="query path"
      />

      {/* Graph/CH Store → Route Engine (load graph into memory) */}
      <Edge
        from={anchors.bottom(N.graphStore)}
        to={anchors.top(N.routeEngine)}
        variant="redirect"
        label="load graph"
      />

      {/* Route Engine → Routing Gateway (path + ETA reply, runs below row) */}
      <Edge
        from={anchors.bottom(N.routeEngine)}
        to={anchors.bottom(N.routingGateway)}
        variant="redirect"
        label="path + ETA"
        labelOffset={16}
      />

      {/* Probes → Traffic Pipeline (async probe stream) */}
      <Edge
        from={anchors.right(N.probes)}
        to={anchors.left(N.trafficPipeline)}
        variant="async"
        label="probe stream"
      />

      {/* Traffic Pipeline → Live Weights (update edge times) */}
      <Edge
        from={anchors.right(N.trafficPipeline)}
        to={anchors.left(N.liveWeights)}
        variant="create"
        label="update weights"
      />

      {/* Live Weights → Route Engine (CRP re-customize) */}
      <Edge
        from={anchors.right(N.liveWeights)}
        to={anchors.bottom(N.routeEngine)}
        variant="control"
        label="re-customize"
        labelOffset={-10}
      />

      {/* Client → CDN (tile request, diagonal above routing row) */}
      <Edge
        from={anchors.top(N.client)}
        to={anchors.left(N.cdn)}
        variant="ingress"
        label="GET tile z/x/y"
        labelOffset={-8}
      />

      {/* CDN → Tile Service (cache miss → origin) */}
      <Edge
        from={anchors.top(N.cdn)}
        to={anchors.bottom(N.tileService)}
        variant="redirect"
        label="miss → origin"
      />

      {/* Nodes */}
      <Node geom={N.client}          kind="infra"     label="Client"            sublabel="navigate / view map" />
      <Node geom={N.routingGateway}  kind="service"   label="Routing Gateway"   sublabel="API edge" />
      <Node geom={N.mapMatcher}      kind="service"   label="Map Matcher"       sublabel="snap + geocode" />
      <Node geom={N.routeEngine}     kind="service"   label="Route Engine"      sublabel="in-memory CH" />
      <Node geom={N.graphStore}      kind="store"     label="Graph / CH Store"  sublabel="graph + shortcuts" />
      <Node geom={N.probes}          kind="external"  label="GPS Probes"        sublabel="GPS pings" />
      <Node geom={N.trafficPipeline} kind="queue"     label="Traffic Pipeline"  sublabel="aggregate" />
      <Node geom={N.liveWeights}     kind="store"     label="Live Weights"      sublabel="edge times" />
      <Node geom={N.tileService}     kind="service"   label="Tile Service"      sublabel="z/x/y pyramid" />
      <Node geom={N.cdn}             kind="external"  label="CDN"               sublabel="edge cache" />

      <Legend
        x={24}
        y={470}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "create",   label: "Query / write path" },
          { variant: "redirect", label: "Read / reply / load" },
          { variant: "async",    label: "Probe stream (async)" },
          { variant: "control",  label: "CRP re-customize weights" },
        ]}
      />
    </DiagramFrame>
  );
}
