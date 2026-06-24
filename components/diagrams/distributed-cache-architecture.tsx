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
  client:       { x: 24,  y: 200, w: 120, h: 56 },
  cacheRouter:  { x: 208, y: 200, w: 140, h: 56 },
  membership:   { x: 208, y: 360, w: 140, h: 56 },
  cacheNodeA:   { x: 430, y: 80,  w: 130, h: 56 },
  cacheNodeB:   { x: 430, y: 200, w: 130, h: 56 },
  cacheNodeC:   { x: 430, y: 320, w: 130, h: 56 },
  replicaA:     { x: 630, y: 80,  w: 120, h: 56 },
  backingStore: { x: 630, y: 270, w: 120, h: 60 },
} satisfies Record<string, NodeGeom>;

export function DistributedCacheArchitecture() {
  return (
    <DiagramFrame
      title="Distributed cache architecture: client, cache router, cache nodes, replica, backing store, membership"
      viewBox="0 0 800 480"
      caption="Clients send get/set requests to a Cache Router, which partitions the keyspace using consistent hashing and virtual nodes so each key is owned by exactly one shard — churn from node failures moves only a minimal slice of keys. The router routes each request to the owning Cache Node (A, B, or C). Cache Node A synchronously replicates to Replica A for durability and read scaling. On a miss, the owning node performs a read-through to the Backing Store (the durable source of truth) and populates the cache entry with a TTL. The Membership service tracks liveness via gossip and heartbeat; when a node fails, the ring reassigns only the failed node's arc to its successor. Eviction (LRU/LFU/TTL) keeps each node's working set bounded in memory. Hot keys are mitigated by replication and per-request coalescing (single-flight) to prevent stampede. The cache is deliberately lossy derived state: a high hit ratio is its entire reason to exist."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>CLIENT</DiagramText>
      <DiagramText x={208} y={46} bold size={11} muted>ROUTING</DiagramText>
      <DiagramText x={430} y={46} bold size={11} muted>CACHE SHARDS</DiagramText>
      <DiagramText x={630} y={46} bold size={11} muted>STORAGE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Cache Router (get / set key) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.cacheRouter)}
        variant="ingress"
        label="get / set key"
      />

      {/* Cache Router → Cache Node A (route by hash) */}
      <Edge
        from={anchors.top(N.cacheRouter)}
        to={anchors.left(N.cacheNodeA)}
        variant="redirect"
        label="route by hash"
        labelOffset={-8}
      />

      {/* Cache Router → Cache Node B (route by hash) */}
      <Edge
        from={anchors.right(N.cacheRouter)}
        to={anchors.left(N.cacheNodeB)}
        variant="redirect"
        label="route by hash"
      />

      {/* Cache Router → Cache Node C (route by hash) */}
      <Edge
        from={anchors.bottom(N.cacheRouter)}
        to={anchors.left(N.cacheNodeC)}
        variant="redirect"
        label="route by hash"
        labelOffset={8}
      />

      {/* Cache Node A → Replica A (replicate) */}
      <Edge
        from={anchors.right(N.cacheNodeA)}
        to={anchors.left(N.replicaA)}
        variant="async"
        label="replicate"
      />

      {/* Cache Node B → Backing Store (load on miss) */}
      <Edge
        from={anchors.right(N.cacheNodeB)}
        to={anchors.left(N.backingStore)}
        variant="create"
        label="load on miss"
      />

      {/* Membership → Cache Node A (gossip / heartbeat) */}
      <Edge
        from={anchors.top(N.membership)}
        to={anchors.bottom(N.cacheNodeA)}
        variant="muted"
        label="gossip / heartbeat"
        labelOffset={-10}
      />

      {/* Membership → Cache Node B (gossip / heartbeat) */}
      <Edge
        from={anchors.right(N.membership)}
        to={anchors.bottom(N.cacheNodeB)}
        variant="muted"
        label="gossip"
        labelOffset={8}
      />

      {/* Membership → Cache Node C (gossip / heartbeat) */}
      <Edge
        from={anchors.right(N.membership)}
        to={anchors.left(N.cacheNodeC)}
        variant="muted"
        label="gossip"
        labelOffset={8}
      />

      {/* Nodes */}
      <Node geom={N.client}       kind="infra"   label="Client"        sublabel="app / service" />
      <Node geom={N.cacheRouter}  kind="service" label="Cache Router"  sublabel="key → shard mapping" />
      <Node geom={N.membership}   kind="service" label="Membership"    sublabel="liveness + ring" />
      <Node geom={N.cacheNodeA}   kind="cache"   label="Cache Node A"  sublabel="shard 0–33%" />
      <Node geom={N.cacheNodeB}   kind="cache"   label="Cache Node B"  sublabel="shard 34–66%" />
      <Node geom={N.cacheNodeC}   kind="cache"   label="Cache Node C"  sublabel="shard 67–99%" />
      <Node geom={N.replicaA}     kind="cache"   label="Replica A"     sublabel="async copy" />
      <Node geom={N.backingStore} kind="store"   label="Backing Store" sublabel="source of truth" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Client request" },
          { variant: "redirect", label: "Route by hash ring" },
          { variant: "create",   label: "Load on miss (read-through)" },
          { variant: "async",    label: "Async replication" },
          { variant: "muted",    label: "Gossip / heartbeat" },
          { kind: "cache",       label: "Cache node / replica" },
        ]}
      />
    </DiagramFrame>
  );
}
