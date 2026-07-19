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
  game:    { x: 24,  y: 150, w: 150, h: 56 },
  service: { x: 220, y: 150, w: 150, h: 56 },
  cache:   { x: 430, y: 84,  w: 150, h: 56 },
  zset:    { x: 430, y: 208, w: 150, h: 60 },
  stream:  { x: 220, y: 340, w: 150, h: 56 },
  db:      { x: 430, y: 340, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function LeaderboardArchitecture() {
  return (
    <DiagramFrame
      title="Leaderboard architecture: game client, leaderboard service, top-K cache, in-memory sorted set, score stream, and durable score database"
      viewBox="0 0 760 520"
      caption="The write path updates the in-memory Sorted Set (a Redis ZSET backed by a skip list) with an O(log N) ZINCRBY and asynchronously emits a score event to the Score Stream, which persists it to the durable Score DB — the sorted set is a fast derived index, the database is the source of truth. Reads answer the global top-K from a cache in front of the service and an arbitrary player's exact rank directly from the sorted set with ZREVRANK, both O(log N). If the sorted set is ever lost, it is rebuilt from the database, so no scores are lost."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={220} y={46} bold size={11} muted>SERVING TIER</DiagramText>
      <DiagramText x={220} y={318} bold size={11} muted>DURABILITY</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.game)} to={anchors.left(N.service)} variant="ingress" label="submit score / query" />
      <Edge from={anchors.right(N.service)} to={anchors.left(N.cache)} variant="control" label="cache hot top-K" labelOffset={-10} />
      <Edge from={anchors.right(N.service)} to={anchors.left(N.zset)} variant="redirect" label="ZINCRBY / ZREVRANK" labelOffset={10} />
      <Edge from={anchors.bottom(N.service)} to={anchors.top(N.stream)} variant="async" label="emit score event" labelOffset={6} />
      <Edge from={anchors.right(N.stream)} to={anchors.left(N.db)} variant="create" label="persist durably" />
      <Edge from={anchors.top(N.db)} to={anchors.bottom(N.zset)} variant="create" label="rebuild on recovery" labelOffset={-10} />

      {/* Nodes */}
      <Node geom={N.game}    kind="external" label="Game Client"        sublabel="submits scores" />
      <Node geom={N.service} kind="service"  label="Leaderboard Service" sublabel="update & rank" />
      <Node geom={N.cache}   kind="cache"    label="Top-K Cache"        sublabel="hot leaderboards" />
      <Node geom={N.zset}    kind="store"    label="Sorted Set"         sublabel="Redis ZSET · in-memory" />
      <Node geom={N.stream}  kind="queue"    label="Score Stream"       sublabel="score events" />
      <Node geom={N.db}      kind="store"    label="Score DB"           sublabel="durable source of truth" />

      <Legend
        x={24}
        y={462}
        items={[
          { variant: "ingress",  label: "Submit / query" },
          { variant: "control",  label: "Cache" },
          { variant: "redirect", label: "Sorted-set op" },
          { variant: "async",    label: "Async event" },
          { variant: "create",   label: "Persist / rebuild" },
        ]}
      />
    </DiagramFrame>
  );
}
