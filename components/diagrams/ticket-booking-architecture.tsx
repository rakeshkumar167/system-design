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
  client:          { x: 24,  y: 220, w: 110, h: 56 },
  waitingRoom:     { x: 188, y: 220, w: 130, h: 56 },
  bookingService:  { x: 380, y: 220, w: 140, h: 56 },
  inventoryDb:     { x: 380, y: 100, w: 140, h: 60 },
  availCache:      { x: 188, y: 100, w: 130, h: 56 },
  payment:         { x: 580, y: 100, w: 120, h: 56 },
  bookingStore:    { x: 580, y: 220, w: 120, h: 60 },
  expiryWorker:    { x: 580, y: 340, w: 140, h: 56 },
} satisfies Record<string, NodeGeom>;

export function TicketBookingArchitecture() {
  return (
    <DiagramFrame
      title="Ticket booking architecture: waiting room, booking service, inventory, hold expiry, payment"
      viewBox="0 0 760 460"
      caption="The Inventory DB is the strongly-consistent source of truth for seat availability; every hold is an atomic conditional update (compare-and-set on status and version) so two concurrent requests for the same seat cannot both succeed — the system never oversells. The Availability Cache serves high-volume seat-map reads without touching the DB on every request; it is approximate and may be slightly stale, but the authoritative hold write always goes to the Inventory DB. Holds carry a TTL: the Hold Expiry Worker periodically sweeps the Inventory DB and releases any expired holds back to available, preventing seats from leaking into an unsellable held state forever. On payment confirmation the Booking Service flips the hold to booked and writes a permanent record to the Booking Store as an idempotent saga step."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24} y={46} bold size={11} muted>INGRESS</DiagramText>
      <DiagramText x={188} y={46} bold size={11} muted>QUEUE / CACHE</DiagramText>
      <DiagramText x={380} y={46} bold size={11} muted>CORE</DiagramText>
      <DiagramText x={580} y={46} bold size={11} muted>EXTERNAL / STORE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Waiting Room */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.waitingRoom)}
        variant="ingress"
        label="request ticket"
      />

      {/* Waiting Room → Booking Service (admitted) */}
      <Edge
        from={anchors.right(N.waitingRoom)}
        to={anchors.left(N.bookingService)}
        variant="async"
        label="admit"
      />

      {/* Booking Service → Inventory DB (atomic hold) */}
      <Edge
        from={anchors.top(N.bookingService)}
        to={anchors.bottom(N.inventoryDb)}
        variant="create"
        label="atomic hold"
      />

      {/* Availability Cache → Client (seat-map reads) */}
      <Edge
        from={anchors.bottom(N.availCache)}
        to={anchors.top(N.waitingRoom)}
        variant="redirect"
        label="seat-map read"
        labelOffset={0}
      />

      {/* Booking Service → Availability Cache (read) */}
      <Edge
        from={anchors.left(N.bookingService)}
        to={anchors.right(N.availCache)}
        variant="redirect"
        label="read"
      />

      {/* Booking Service → Payment (external) */}
      <Edge
        from={anchors.right(N.bookingService)}
        to={anchors.left(N.payment)}
        variant="create"
        label="charge"
      />

      {/* Booking Service → Booking Store (confirm) */}
      <Edge
        from={anchors.right(N.bookingService)}
        to={anchors.left(N.bookingStore)}
        variant="create"
        label="write booking"
      />

      {/* Hold Expiry Worker → Inventory DB (release expired) */}
      <Edge
        from={anchors.top(N.expiryWorker)}
        to={anchors.bottom(N.bookingStore)}
        variant="control"
        label="sweep"
        labelOffset={0}
      />
      <Edge
        from={anchors.left(N.expiryWorker)}
        to={anchors.bottom(N.inventoryDb)}
        variant="control"
        label="release expired"
      />

      {/* Nodes */}
      <Node geom={N.client}         kind="infra"    label="Client" sublabel="browser / app" />
      <Node geom={N.waitingRoom}    kind="queue"    label="Waiting Room" sublabel="on-sale queue" />
      <Node geom={N.bookingService} kind="service"  label="Booking Service" />
      <Node geom={N.inventoryDb}    kind="store"    label="Inventory DB" sublabel="sharded by event" />
      <Node geom={N.availCache}     kind="cache"    label="Availability Cache" sublabel="seat-map reads" />
      <Node geom={N.payment}        kind="external" label="Payment" sublabel="external provider" />
      <Node geom={N.bookingStore}   kind="store"    label="Booking Store" sublabel="confirmed bookings" />
      <Node geom={N.expiryWorker}   kind="queue"    label="Hold Expiry Worker" sublabel="TTL sweep" />

      <Legend
        x={24}
        y={410}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "async",    label: "Async admit" },
          { variant: "create",   label: "Atomic hold / write" },
          { variant: "redirect", label: "Cache read" },
          { variant: "control",  label: "Release expired holds" },
          { kind: "external",    label: "External payment" },
        ]}
      />
    </DiagramFrame>
  );
}
