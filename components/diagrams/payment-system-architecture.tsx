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
  client:           { x: 24,  y: 210, w: 150, h: 56 },
  paymentApi:       { x: 220, y: 210, w: 150, h: 56 },
  idempotencyStore: { x: 220, y: 360, w: 150, h: 60 },
  orchestrator:     { x: 424, y: 90,  w: 150, h: 56 },
  ledgerSvc:        { x: 424, y: 210, w: 150, h: 56 },
  reconciliation:   { x: 424, y: 340, w: 150, h: 56 },
  psp:              { x: 640, y: 90,  w: 150, h: 56 },
  ledgerDb:         { x: 640, y: 210, w: 150, h: 60 },
  outbox:           { x: 640, y: 340, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function PaymentSystemArchitecture() {
  return (
    <DiagramFrame
      title="Payment system architecture: client, Payment API, idempotency store, orchestrator, ledger service, ledger DB, reconciliation, outbox, PSP"
      viewBox="0 0 860 480"
      caption="The double-entry ledger is the source of truth: every movement is recorded as equal debits and credits, balances are derived, and the ledger is append-only and immutable. Exactly-once processing is enforced by an idempotency key checked at the Payment API before any work begins. The dual-write problem — the ledger write and the external PSP call cannot be one ACID transaction — is solved with a transactional outbox: the orchestrator writes an intent record to the outbox atomically, and a relay dispatches to the PSP idempotently. Reconciliation compares the internal ledger against the PSP settlement file to catch any drift between the two."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={220} y={46} bold size={11} muted>API / DEDUP</DiagramText>
      <DiagramText x={424} y={46} bold size={11} muted>ORCHESTRATION / LEDGER</DiagramText>
      <DiagramText x={640} y={46} bold size={11} muted>EXTERNAL / STORAGE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Payment API */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.paymentApi)}
        variant="ingress"
        label="POST /payments + key"
      />

      {/* Payment API → Idempotency Store */}
      <Edge
        from={anchors.bottom(N.paymentApi)}
        to={anchors.top(N.idempotencyStore)}
        variant="create"
        label="check / store key"
        labelOffset={0}
      />

      {/* Payment API → Payment Orchestrator */}
      <Edge
        from={anchors.top(N.paymentApi)}
        to={anchors.left(N.orchestrator)}
        variant="redirect"
        label="process (deduped)"
        labelOffset={-8}
      />

      {/* Payment Orchestrator → Ledger Service */}
      <Edge
        from={anchors.bottom(N.orchestrator)}
        to={anchors.top(N.ledgerSvc)}
        variant="create"
        label="record entries"
        labelOffset={0}
      />

      {/* Ledger Service → Ledger DB */}
      <Edge
        from={anchors.right(N.ledgerSvc)}
        to={anchors.left(N.ledgerDb)}
        variant="create"
        label="append debit + credit"
      />

      {/* Payment Orchestrator → Outbox */}
      <Edge
        from={anchors.right(N.orchestrator)}
        to={anchors.top(N.outbox)}
        variant="async"
        label="intent (outbox)"
        labelOffset={-8}
      />

      {/* Outbox → PSP / Bank */}
      <Edge
        from={anchors.top(N.outbox)}
        to={anchors.bottom(N.psp)}
        variant="async"
        label="call PSP idempotently"
        labelOffset={0}
      />

      {/* Reconciliation → Ledger DB */}
      <Edge
        from={anchors.right(N.reconciliation)}
        to={anchors.bottom(N.ledgerDb)}
        variant="redirect"
        label="read ledger"
        labelOffset={8}
      />

      {/* PSP / Bank → Reconciliation */}
      <Edge
        from={anchors.bottom(N.psp)}
        to={anchors.top(N.reconciliation)}
        variant="muted"
        label="settlement file"
        labelOffset={0}
      />

      {/* Nodes */}
      <Node geom={N.client}           kind="infra"    label="Client"              sublabel="merchant / app" />
      <Node geom={N.paymentApi}       kind="service"  label="Payment API"         sublabel="idempotency keys" />
      <Node geom={N.idempotencyStore} kind="store"    label="Idempotency Store"   sublabel="dedup keys" />
      <Node geom={N.orchestrator}     kind="service"  label="Payment Orchestrator" sublabel="state machine" />
      <Node geom={N.ledgerSvc}        kind="service"  label="Ledger Service"      sublabel="double-entry" />
      <Node geom={N.reconciliation}   kind="service"  label="Reconciliation"      sublabel="ledger vs PSP" />
      <Node geom={N.psp}              kind="external" label="PSP / Bank"          sublabel="card network" />
      <Node geom={N.ledgerDb}         kind="store"    label="Ledger DB"           sublabel="append-only" />
      <Node geom={N.outbox}           kind="queue"    label="Outbox / Events"     sublabel="async dispatch" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "create",   label: "Write / ledger post" },
          { variant: "redirect", label: "Read / process path" },
          { variant: "async",    label: "Outbox / PSP dispatch" },
          { variant: "muted",    label: "Settlement file" },
          { kind: "store",       label: "Storage (idempotency / ledger)" },
          { kind: "queue",       label: "Outbox queue" },
          { kind: "external",    label: "PSP / Bank" },
        ]}
      />
    </DiagramFrame>
  );
}
