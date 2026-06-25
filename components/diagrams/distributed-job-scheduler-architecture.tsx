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
  client:        { x: 24,  y: 222, w: 140, h: 56 },
  scheduler:     { x: 196, y: 222, w: 140, h: 56 },
  jobStore:      { x: 196, y: 80,  w: 140, h: 60 },
  coordination:  { x: 196, y: 364, w: 140, h: 56 },
  dispatchQueue: { x: 390, y: 222, w: 140, h: 56 },
  workers:       { x: 580, y: 222, w: 140, h: 56 },
  historyStore:  { x: 750, y: 80,  w: 140, h: 60 },
  dlq:           { x: 580, y: 364, w: 140, h: 56 },
} satisfies Record<string, NodeGeom>;

export function DistributedJobSchedulerArchitecture() {
  return (
    <DiagramFrame
      title="Distributed job scheduler architecture: client API, scheduler, job store, coordination, dispatch queue, workers, history store, retry and DLQ"
      viewBox="0 0 920 480"
      caption="Jobs arrive via a client API and are persisted to the Job Store — the durable source of truth — along with the next fire time. The Scheduler (leader-elected via the Coordination service, ensuring no single point of failure) scans for due jobs and enqueues them to the Dispatch Queue. Workers pull jobs from the queue under a lease: the lease guarantees at-least-once execution — if a worker crashes, the lease expires and another worker re-claims the job. Workers write run results to the History Store and on failure route to the Retry / DLQ for backoff and dead-lettering. Because jobs may run more than once, they must be idempotent."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={196} y={46} bold size={11} muted>SCHEDULING</DiagramText>
      <DiagramText x={390} y={46} bold size={11} muted>DISPATCH</DiagramText>
      <DiagramText x={580} y={46} bold size={11} muted>EXECUTION</DiagramText>
      <DiagramText x={750} y={46} bold size={11} muted>STORAGE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Scheduler (POST job) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.scheduler)}
        variant="ingress"
        label="POST job"
      />

      {/* Scheduler → Job Store (persist + read due) */}
      <Edge
        from={anchors.top(N.scheduler)}
        to={anchors.bottom(N.jobStore)}
        variant="create"
        label="persist + read due"
        labelOffset={0}
      />

      {/* Scheduler → Dispatch Queue (enqueue due jobs) */}
      <Edge
        from={anchors.right(N.scheduler)}
        to={anchors.left(N.dispatchQueue)}
        variant="async"
        label="enqueue due jobs"
      />

      {/* Dispatch Queue → Workers (deliver under lease) */}
      <Edge
        from={anchors.right(N.dispatchQueue)}
        to={anchors.left(N.workers)}
        variant="redirect"
        label="deliver (lease)"
      />

      {/* Workers → Dispatch Queue (ack / extend lease) */}
      <Edge
        from={anchors.bottom(N.workers)}
        to={anchors.bottom(N.dispatchQueue)}
        variant="control"
        label="ack / extend lease"
        labelOffset={12}
      />

      {/* Workers → History Store (write result) */}
      <Edge
        from={anchors.top(N.workers)}
        to={anchors.bottom(N.historyStore)}
        variant="create"
        label="write result"
      />

      {/* Workers → DLQ (on failure) */}
      <Edge
        from={anchors.bottom(N.workers)}
        to={anchors.top(N.dlq)}
        variant="control"
        label="on failure"
        labelOffset={0}
      />

      {/* Coordination → Scheduler (leader election) */}
      <Edge
        from={anchors.top(N.coordination)}
        to={anchors.bottom(N.scheduler)}
        variant="muted"
        label="leader election"
        labelOffset={0}
      />

      {/* Nodes */}
      <Node geom={N.client}        kind="infra"   label="Client API"       sublabel="schedule jobs" />
      <Node geom={N.scheduler}     kind="service" label="Scheduler"        sublabel="scan due (leader)" />
      <Node geom={N.jobStore}      kind="store"   label="Job Store"        sublabel="defs + schedule" />
      <Node geom={N.coordination}  kind="service" label="Coordination"     sublabel="election + leases" />
      <Node geom={N.dispatchQueue} kind="queue"   label="Dispatch Queue"   sublabel="due jobs" />
      <Node geom={N.workers}       kind="service" label="Workers"          sublabel="lease + execute" />
      <Node geom={N.historyStore}  kind="store"   label="History Store"    sublabel="run records" />
      <Node geom={N.dlq}           kind="queue"   label="Retry / DLQ"      sublabel="backoff + dead-letter" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "create",   label: "Persist / write result" },
          { variant: "async",    label: "Enqueue (async)" },
          { variant: "redirect", label: "Deliver (lease)" },
          { variant: "control",  label: "Ack / failure / DLQ" },
          { variant: "muted",    label: "Leader election" },
        ]}
      />
    </DiagramFrame>
  );
}
