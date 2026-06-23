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
  producer:       { x: 24,  y: 220, w: 120, h: 56 },
  ingestionApi:   { x: 188, y: 220, w: 130, h: 56 },
  ingestionQueue: { x: 372, y: 220, w: 140, h: 56 },
  fanoutService:  { x: 372, y: 100, w: 140, h: 56 },
  prefStore:      { x: 188, y: 60,  w: 130, h: 60 },
  dedupStore:     { x: 560, y: 60,  w: 130, h: 60 },
  channelQueues:  { x: 560, y: 220, w: 140, h: 56 },
  channelWorkers: { x: 560, y: 340, w: 140, h: 56 },
  providers:      { x: 560, y: 460, w: 140, h: 56 },
  dlq:            { x: 372, y: 340, w: 120, h: 56 },
} satisfies Record<string, NodeGeom>;

export function NotificationArchitecture() {
  return (
    <DiagramFrame
      title="Notification architecture: ingestion, fan-out, channel queues, workers, and DLQ"
      viewBox="0 0 760 560"
      caption="Notifications flow through an async pipeline of message queues: the Ingestion API accepts requests and enqueues them immediately, returning 202 Accepted. A Fan-out Service dequeues each notification, consults the Preference Store to resolve enabled channels, checks the Dedup Store for duplicate idempotency keys, then publishes one message per channel into per-channel Channel Queues. Channel Workers consume those queues and call external Providers (APNs/FCM, SMS gateway, SMTP). On transient failures, workers retry with exponential backoff and jitter. When retries are exhausted, the message is routed to the dead-letter queue (DLQ) for inspection and alerting, preventing poison messages from blocking the pipeline forever."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24} y={46} bold size={11} muted>INGESTION</DiagramText>
      <DiagramText x={372} y={46} bold size={11} muted>FAN-OUT</DiagramText>
      <DiagramText x={560} y={46} bold size={11} muted>DELIVERY</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Producer → Ingestion API */}
      <Edge
        from={anchors.right(N.producer)}
        to={anchors.left(N.ingestionApi)}
        variant="create"
        label="POST /v1/notifications"
      />

      {/* Ingestion API → Ingestion Queue */}
      <Edge
        from={anchors.right(N.ingestionApi)}
        to={anchors.left(N.ingestionQueue)}
        variant="create"
        label="enqueue"
      />

      {/* Ingestion Queue → Fan-out Service (async consume) */}
      <Edge
        from={anchors.top(N.ingestionQueue)}
        to={anchors.bottom(N.fanoutService)}
        variant="async"
        label="consume"
      />

      {/* Fan-out Service → Preference Store */}
      <Edge
        from={anchors.left(N.fanoutService)}
        to={anchors.right(N.prefStore)}
        variant="redirect"
        label="lookup prefs"
      />

      {/* Fan-out Service → Dedup Store */}
      <Edge
        from={anchors.right(N.fanoutService)}
        to={anchors.left(N.dedupStore)}
        variant="redirect"
        label="check key"
        labelOffset={0}
      />

      {/* Fan-out Service → Channel Queues (publish per channel) */}
      <Edge
        from={anchors.right(N.fanoutService)}
        to={anchors.top(N.channelQueues)}
        variant="create"
        label="publish"
      />

      {/* Channel Queues → Channel Workers */}
      <Edge
        from={anchors.bottom(N.channelQueues)}
        to={anchors.top(N.channelWorkers)}
        variant="async"
        label="consume"
      />

      {/* Channel Workers → Providers */}
      <Edge
        from={anchors.bottom(N.channelWorkers)}
        to={anchors.top(N.providers)}
        variant="redirect"
        label="deliver"
      />

      {/* Channel Workers → DLQ (exhausted retries) */}
      <Edge
        from={anchors.left(N.channelWorkers)}
        to={anchors.right(N.dlq)}
        variant="control"
        label="exhausted → DLQ"
      />

      {/* Nodes */}
      <Node geom={N.producer}       kind="infra"    label="Producer" sublabel="caller / service" />
      <Node geom={N.ingestionApi}   kind="service"  label="Ingestion API" sublabel="202 Accepted" />
      <Node geom={N.ingestionQueue} kind="queue"    label="Ingestion Queue" />
      <Node geom={N.fanoutService}  kind="service"  label="Fan-out Service" />
      <Node geom={N.prefStore}      kind="store"    label="Preference Store" sublabel="channel prefs" />
      <Node geom={N.dedupStore}     kind="cache"    label="Dedup Store" sublabel="idempotency keys" />
      <Node geom={N.channelQueues}  kind="queue"    label="Channel Queues" sublabel="push / SMS / email" />
      <Node geom={N.channelWorkers} kind="service"  label="Channel Workers" sublabel="autoscaled" />
      <Node geom={N.providers}      kind="external" label="Providers" sublabel="APNs · FCM · SMTP" />
      <Node geom={N.dlq}            kind="queue"    label="DLQ" sublabel="exhausted msgs" />

      <Legend
        x={24}
        y={510}
        items={[
          { variant: "create",   label: "Sync write / enqueue" },
          { variant: "async",    label: "Async consume" },
          { variant: "redirect", label: "Read / deliver" },
          { variant: "control",  label: "Exhausted → DLQ" },
          { kind: "queue",       label: "Queue / DLQ" },
          { kind: "external",    label: "External provider" },
        ]}
      />
    </DiagramFrame>
  );
}
