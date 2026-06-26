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
  gateway:         { x: 220, y: 232, w: 150, h: 56 },
  authService:     { x: 390, y: 80,  w: 150, h: 56 },
  rateLimiter:     { x: 570, y: 80,  w: 150, h: 56 },
  serviceRegistry: { x: 760, y: 80,  w: 150, h: 60 },
  backends:        { x: 760, y: 232, w: 150, h: 56 },
  configStore:     { x: 24,  y: 392, w: 150, h: 60 },
  controlPlane:    { x: 220, y: 392, w: 150, h: 56 },
  telemetry:       { x: 480, y: 392, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function ApiGatewayArchitecture() {
  return (
    <DiagramFrame
      title="API Gateway architecture: client, gateway data plane, auth service, rate limiter, service registry, backends, config store, control plane, and telemetry sink"
      viewBox="0 0 960 520"
      caption="The gateway is the single edge fronting all microservices, running an ordered filter chain — authenticate, rate-limit, route, forward — on every request's critical path. The stateless data plane (high-throughput proxy fleet with in-memory config) is separated from the control plane (owns routes, API keys, and policies), which validates and pushes versioned config so routing and policy change without redeploying the proxies. Edge authentication keeps token verification cheap via a local cache; the rate limiter checks and increments distributed counters before any backend is touched. All observability — logs, metrics, distributed traces — drains through the telemetry sink, making the gateway the natural home for cross-cutting concerns."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={220} y={46} bold size={11} muted>DATA PLANE</DiagramText>
      <DiagramText x={390} y={46} bold size={11} muted>EDGE AUTH &amp; LIMITS</DiagramText>
      <DiagramText x={760} y={46} bold size={11} muted>BACKENDS</DiagramText>
      <DiagramText x={24}  y={370} bold size={11} muted>CONTROL PLANE</DiagramText>
      <DiagramText x={480} y={370} bold size={11} muted>OBSERVABILITY</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Gateway (ingress request) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.gateway)}
        variant="ingress"
        label="request"
      />

      {/* Gateway → Auth Service (verify token) */}
      <Edge
        from={anchors.right(N.gateway)}
        to={anchors.bottom(N.authService)}
        variant="create"
        label="verify token"
        labelOffset={-8}
      />

      {/* Gateway → Rate Limiter (check + incr) */}
      <Edge
        from={anchors.right(N.gateway)}
        to={anchors.bottom(N.rateLimiter)}
        variant="control"
        label="check + incr"
        labelOffset={8}
      />

      {/* Gateway → Backends (route + forward) */}
      <Edge
        from={anchors.right(N.gateway)}
        to={anchors.left(N.backends)}
        variant="redirect"
        label="route + forward"
      />

      {/* Service Registry → Gateway (discovery) */}
      <Edge
        from={anchors.left(N.serviceRegistry)}
        to={anchors.right(N.gateway)}
        variant="muted"
        label="discovery"
        labelOffset={-12}
      />

      {/* Control Plane → Config Store (manage config) */}
      <Edge
        from={anchors.left(N.controlPlane)}
        to={anchors.right(N.configStore)}
        variant="create"
        label="manage config"
      />

      {/* Control Plane → Gateway (push config, async) */}
      <Edge
        from={anchors.top(N.controlPlane)}
        to={anchors.bottom(N.gateway)}
        variant="async"
        label="push config"
        labelOffset={6}
      />

      {/* Gateway → Telemetry (observability) */}
      <Edge
        from={anchors.bottom(N.gateway)}
        to={anchors.top(N.telemetry)}
        variant="muted"
        label="observability"
        labelOffset={-8}
      />

      {/* Nodes */}
      <Node geom={N.client}          kind="infra"    label="Client"           sublabel="all traffic" />
      <Node geom={N.gateway}         kind="service"  label="Gateway"          sublabel="data plane · filters" />
      <Node geom={N.authService}     kind="service"  label="Auth Service"     sublabel="verify / introspect" />
      <Node geom={N.rateLimiter}     kind="cache"    label="Rate Limiter"     sublabel="counters" />
      <Node geom={N.serviceRegistry} kind="store"    label="Service Registry" sublabel="healthy upstreams" />
      <Node geom={N.backends}        kind="service"  label="Backends"         sublabel="upstreams" />
      <Node geom={N.configStore}     kind="store"    label="Config Store"     sublabel="versioned config" />
      <Node geom={N.controlPlane}    kind="service"  label="Control Plane"    sublabel="routes / keys / policies" />
      <Node geom={N.telemetry}       kind="queue"    label="Telemetry"        sublabel="logs / metrics / traces" />

      <Legend
        x={24}
        y={470}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "create",   label: "Write / verify path" },
          { variant: "redirect", label: "Route + forward / read" },
          { variant: "async",    label: "Config push (async)" },
          { variant: "control",  label: "Rate-limit check / reject" },
          { variant: "muted",    label: "Discovery / telemetry" },
        ]}
      />
    </DiagramFrame>
  );
}
