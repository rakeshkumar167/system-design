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
  client:       { x: 24,  y: 200, w: 150, h: 56 },
  postService:  { x: 230, y: 120, w: 150, h: 56 },
  postStore:    { x: 460, y: 60,  w: 150, h: 60 },
  feedService:  { x: 640, y: 120, w: 150, h: 56 },
  fanoutService:{ x: 230, y: 280, w: 155, h: 56 },
  socialGraph:  { x: 460, y: 200, w: 150, h: 60 },
  fanoutQueue:  { x: 230, y: 390, w: 155, h: 56 },
  fanoutWorker: { x: 460, y: 330, w: 155, h: 56 },
  feedCache:    { x: 640, y: 240, w: 150, h: 60 },
} satisfies Record<string, NodeGeom>;

export function NewsFeedArchitecture() {
  return (
    <DiagramFrame
      title="News Feed architecture: client, post service, post store, fan-out service, social graph, fan-out queue, fan-out worker, feed cache, and feed service"
      viewBox="0 0 830 530"
      caption="Fan-out on write drives the design: when a user posts, the Post Service stores the content in the Post Store and asynchronously triggers the Fan-out Service, which reads the author's follow graph from the Social Graph, enqueues per-follower jobs to the Fan-out Queue, and Fan-out Workers write the post ID into each follower's precomputed feed in the Feed Cache. The read path is O(1): the Feed Service reads the precomputed list of post IDs from the Feed Cache and hydrates full post content from the Post Store. Hot users (celebrities) break pure push — the hybrid model handles them by pulling their recent posts at read time."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={230} y={46} bold size={11} muted>WRITE PATH</DiagramText>
      <DiagramText x={640} y={46} bold size={11} muted>READ PATH</DiagramText>
      <DiagramText x={230} y={374} bold size={11} muted>FAN-OUT PIPELINE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Post Service (new post) — upper right exit */}
      <Edge
        from={{ x: N.client.x + N.client.w, y: N.client.y + 14 }}
        to={anchors.top(N.postService)}
        variant="ingress"
        label="new post"
        labelOffset={-8}
      />

      {/* Client → Feed Service (get feed) — lower right exit, goes above fanout nodes */}
      <Edge
        from={{ x: N.client.x + N.client.w, y: N.client.y + N.client.h - 14 }}
        to={anchors.left(N.feedService)}
        variant="ingress"
        label="get feed"
        labelOffset={10}
      />

      {/* Post Service → Post Store (store post) */}
      <Edge
        from={anchors.right(N.postService)}
        to={anchors.left(N.postStore)}
        variant="create"
        label="store post"
        labelOffset={-8}
      />

      {/* Post Service → Fan-out Service (trigger fan-out async) */}
      <Edge
        from={anchors.bottom(N.postService)}
        to={anchors.top(N.fanoutService)}
        variant="async"
        label="trigger fan-out"
        labelOffset={6}
      />

      {/* Fan-out Service → Social Graph (get followers) */}
      <Edge
        from={anchors.right(N.fanoutService)}
        to={anchors.left(N.socialGraph)}
        variant="control"
        label="get followers"
        labelOffset={-8}
      />

      {/* Fan-out Service → Fan-out Queue (enqueue jobs) */}
      <Edge
        from={anchors.bottom(N.fanoutService)}
        to={anchors.top(N.fanoutQueue)}
        variant="async"
        label="enqueue jobs"
        labelOffset={6}
      />

      {/* Fan-out Queue → Fan-out Worker (consume jobs) */}
      <Edge
        from={anchors.right(N.fanoutQueue)}
        to={anchors.left(N.fanoutWorker)}
        variant="async"
        label="consume jobs"
        labelOffset={-8}
      />

      {/* Fan-out Worker → Feed Cache (push post id) */}
      <Edge
        from={anchors.right(N.fanoutWorker)}
        to={anchors.left(N.feedCache)}
        variant="create"
        label="push post id"
        labelOffset={-8}
      />

      {/* Feed Service → Feed Cache (read feed ids) */}
      <Edge
        from={anchors.bottom(N.feedService)}
        to={anchors.top(N.feedCache)}
        variant="redirect"
        label="read feed ids"
        labelOffset={6}
      />

      {/* Feed Service → Post Store (hydrate content) — horizontal at y=120 */}
      <Edge
        from={anchors.top(N.feedService)}
        to={anchors.bottom(N.postStore)}
        variant="redirect"
        label="hydrate content"
      />

      {/* Nodes */}
      <Node geom={N.client}        kind="external" label="Client"          sublabel="post / read" />
      <Node geom={N.postService}   kind="service"  label="Post Service"    sublabel="ingest posts" />
      <Node geom={N.postStore}     kind="store"    label="Post Store"      sublabel="posts + content" />
      <Node geom={N.feedService}   kind="service"  label="Feed Service"    sublabel="read + hydrate" />
      <Node geom={N.fanoutService} kind="service"  label="Fan-out Service" sublabel="push pipeline" />
      <Node geom={N.socialGraph}   kind="store"    label="Social Graph"    sublabel="follow graph" />
      <Node geom={N.fanoutQueue}   kind="queue"    label="Fan-out Queue"   sublabel="fan-out jobs" />
      <Node geom={N.fanoutWorker}  kind="service"  label="Fan-out Worker"  sublabel="write feeds" />
      <Node geom={N.feedCache}     kind="cache"    label="Feed Cache"      sublabel="per-user feeds" />

      <Legend
        x={24}
        y={468}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "create",   label: "Write / push" },
          { variant: "async",    label: "Async fan-out" },
          { variant: "control",  label: "Follow graph lookup" },
          { variant: "redirect", label: "Read / hydrate" },
        ]}
      />
    </DiagramFrame>
  );
}
