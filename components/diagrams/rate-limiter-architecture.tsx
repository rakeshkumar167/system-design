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
  client:   { x: 24,  y: 200, w: 104, h: 56 },
  gateway:  { x: 164, y: 200, w: 140, h: 56 },
  limiter:  { x: 340, y: 200, w: 150, h: 56 },
  store:    { x: 340, y: 340, w: 150, h: 82 },
  backend:  { x: 540, y: 200, w: 140, h: 56 },
  alerts:   { x: 540, y: 340, w: 140, h: 48 },
} satisfies Record<string, NodeGeom>;

export function RateLimiterArchitecture() {
  return (
    <DiagramFrame
      title="Rate limiter architecture: middleware, counter store, and backend service"
      viewBox="0 0 740 480"
      caption="Each request passes through the API Gateway and into the rate limiter middleware. The limiter performs an atomic INCR on a Redis counter store scoped to the caller's key. If the count is under the limit the request continues to the backend service; if it exceeds the limit the limiter returns 429 Too Many Requests. When the counter store is unreachable the limiter chooses to fail open — allowing the request rather than blocking all traffic — and emits an alert to the observability layer so the outage is visible."
    >
      <DiagramDefs />

      {/* Lane labels */}
      <DiagramText x={340} y={324} bold muted size={10.5}>
        COUNTER STORE
      </DiagramText>
      <DiagramText x={540} y={324} bold muted size={10.5}>
        OBSERVABILITY
      </DiagramText>

      {/* Edges drawn before nodes */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.gateway)}
        variant="ingress"
        label="request"
      />
      <Edge
        from={anchors.right(N.gateway)}
        to={anchors.left(N.limiter)}
        variant="ingress"
        label="forward"
      />

      {/* Limiter ↔ counter store: atomic increment */}
      <Edge
        from={anchors.bottom(N.limiter)}
        to={anchors.top(N.store)}
        variant="create"
        label="INCR key"
      />
      <Edge
        from={{ x: N.store.x + N.store.w - 24, y: N.store.y }}
        to={{ x: N.limiter.x + N.limiter.w - 24, y: N.limiter.y + N.limiter.h }}
        variant="redirect"
        label="count"
        labelOffset={0}
      />

      {/* Allowed request → backend */}
      <Edge
        from={anchors.right(N.limiter)}
        to={anchors.left(N.backend)}
        variant="redirect"
        label="allow"
      />

      {/* Fail-open path: store unreachable → limiter bypasses → backend (control variant) */}
      <Edge
        from={anchors.right(N.limiter)}
        to={anchors.left(N.backend)}
        variant="control"
        label="store down → allow"
        labelOffset={-12}
      />

      {/* Telemetry: limiter → alerts */}
      <Edge
        from={anchors.bottom(N.limiter)}
        to={anchors.top(N.alerts)}
        variant="muted"
        label="alert"
      />

      {/* Nodes */}
      <Node geom={N.client}  kind="infra"   label="Client" />
      <Node geom={N.gateway} kind="infra"   label="API Gateway" />
      <Node geom={N.limiter} kind="service" label="Limiter" sublabel="middleware" />
      <Node geom={N.store}   kind="store"   label="Counter Store" sublabel="Redis" />
      <Node geom={N.backend} kind="service" label="Backend Service" />
      <Node geom={N.alerts}  kind="external" label="Observability" />

      <Legend
        x={24}
        y={432}
        items={[
          { variant: "create",   label: "Atomic write (INCR)" },
          { variant: "redirect", label: "Allow path" },
          { variant: "control",  label: "Bypass (store unreachable)" },
          { variant: "muted",    label: "Telemetry / alert" },
          { kind: "store",       label: "Counter store" },
          { kind: "external",    label: "Observability" },
        ]}
      />
    </DiagramFrame>
  );
}
