import {
  DiagramDefs,
  Edge,
  Legend,
  Node,
  anchors,
  type NodeGeom,
} from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

const N = {
  sender:          { x: 24,  y: 220, w: 150, h: 56 },
  gateway:         { x: 220, y: 220, w: 150, h: 56 },
  messageService:  { x: 430, y: 220, w: 155, h: 56 },
  messageStore:    { x: 640, y: 100, w: 150, h: 60 },
  sessionRegistry: { x: 640, y: 220, w: 160, h: 60 },
  mailbox:         { x: 640, y: 340, w: 150, h: 60 },
  recipient:       { x: 220, y: 380, w: 150, h: 56 },
  presence:        { x: 430, y: 380, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function ChatArchitecture() {
  return (
    <DiagramFrame
      title="Chat System architecture: sender, WebSocket gateway, message service, session registry, message store, mailbox, recipient, and presence service"
      viewBox="0 0 850 530"
      caption="Each online user holds a persistent connection to a stateful WebSocket gateway; ~100M such connections at peak are spread across ~1,000 gateways. The session registry maps every user to their current gateway so the Message Service can route a message directly to the recipient's gateway for a real-time push. When a recipient is offline, the message is queued in their per-user mailbox and delivered on reconnect. Presence and last-seen are maintained by heartbeats from each connected client, fanned out to the user's conversation partners."
    >
      <DiagramDefs />

      {/* Edges — drawn before nodes */}

      {/* Sender → Gateway: send over socket */}
      <Edge
        from={anchors.right(N.sender)}
        to={anchors.left(N.gateway)}
        variant="ingress"
        label="send over socket"
      />

      {/* Gateway → MessageService: forward message (upper half) */}
      <Edge
        from={{ x: N.gateway.x + N.gateway.w, y: N.gateway.y + 14 }}
        to={{ x: N.messageService.x, y: N.messageService.y + 14 }}
        variant="redirect"
        label="forward message"
        labelOffset={-8}
      />

      {/* MessageService → Gateway: route to gateway (lower half, reverse direction) */}
      <Edge
        from={{ x: N.messageService.x, y: N.messageService.y + 42 }}
        to={{ x: N.gateway.x + N.gateway.w, y: N.gateway.y + 42 }}
        variant="async"
        label="route to gateway"
        labelOffset={8}
      />

      {/* MessageService → MessageStore: persist message (upper right exit) */}
      <Edge
        from={{ x: N.messageService.x + N.messageService.w, y: N.messageService.y + 14 }}
        to={anchors.left(N.messageStore)}
        variant="create"
        label="persist message"
        labelOffset={-8}
      />

      {/* MessageService → SessionRegistry: look up recipient (center right exit) */}
      <Edge
        from={anchors.right(N.messageService)}
        to={anchors.left(N.sessionRegistry)}
        variant="control"
        label="look up recipient"
        labelOffset={-8}
      />

      {/* MessageService → Mailbox: queue if offline (lower right exit) */}
      <Edge
        from={{ x: N.messageService.x + N.messageService.w, y: N.messageService.y + 42 }}
        to={anchors.left(N.mailbox)}
        variant="create"
        label="queue if offline"
        labelOffset={8}
      />

      {/* Gateway → Recipient: push message */}
      <Edge
        from={anchors.bottom(N.gateway)}
        to={anchors.top(N.recipient)}
        variant="redirect"
        label="push message"
        labelOffset={6}
      />

      {/* Gateway → Presence: heartbeat (bottom-right corner of gateway) */}
      <Edge
        from={{ x: N.gateway.x + N.gateway.w, y: N.gateway.y + N.gateway.h }}
        to={anchors.left(N.presence)}
        variant="muted"
        label="heartbeat"
        labelOffset={6}
      />

      {/* Nodes */}
      <Node geom={N.sender}          kind="external" label="Sender"            sublabel="client" />
      <Node geom={N.gateway}         kind="service"  label="WebSocket Gateway" sublabel="holds connections" />
      <Node geom={N.messageService}  kind="service"  label="Message Service"   sublabel="route + persist" />
      <Node geom={N.messageStore}    kind="store"    label="Message Store"     sublabel="messages + history" />
      <Node geom={N.sessionRegistry} kind="cache"    label="Session Registry"  sublabel="user → gateway" />
      <Node geom={N.mailbox}         kind="store"    label="Mailbox"           sublabel="offline inbox" />
      <Node geom={N.recipient}       kind="external" label="Recipient"         sublabel="client" />
      <Node geom={N.presence}        kind="service"  label="Presence"          sublabel="online / last-seen" />

      <Legend
        x={24}
        y={460}
        items={[
          { variant: "ingress",  label: "Client message" },
          { variant: "redirect", label: "Forward / push" },
          { variant: "create",   label: "Persist / queue" },
          { variant: "control",  label: "Route lookup" },
          { variant: "async",    label: "Async route" },
          { variant: "muted",    label: "Heartbeat" },
        ]}
      />
    </DiagramFrame>
  );
}
