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
  services:     { x: 24,  y: 222, w: 140, h: 56 },
  collector:    { x: 196, y: 222, w: 140, h: 56 },
  buffer:       { x: 380, y: 222, w: 140, h: 56 },
  indexer:      { x: 560, y: 112, w: 140, h: 56 },
  archiver:     { x: 560, y: 332, w: 140, h: 56 },
  hotStore:     { x: 740, y: 112, w: 140, h: 60 },
  coldStore:    { x: 740, y: 332, w: 140, h: 60 },
  queryService: { x: 380, y: 412, w: 140, h: 56 },
} satisfies Record<string, NodeGeom>;

export function DistributedLoggingArchitecture() {
  return (
    <DiagramFrame
      title="Distributed logging architecture: services and agent, ingest collector, log buffer, indexer, archiver, hot store, cold store, query service"
      viewBox="0 0 920 500"
      caption="A write firehose of millions of events per second flows from application services through a lightweight agent to the Ingest Collector, which batches and forwards log entries to a durable buffer (Kafka-style). The buffer decouples producers from all downstream processing so producers are never backpressured by slow indexing or archiving. The Indexer consumes recent batches, parses fields, and builds an inverted index written to the Hot Store (SSD-backed, indexed). The Archiver independently consumes from the buffer, compresses entries, and writes to the Cold Store (cheap object storage, unindexed). A lifecycle policy ages data from hot to cold once it passes the retention window. The Query Service handles search by scattering across hot shards for recent time ranges and falling back to cold storage for older ranges. Indexing only the hot window keeps cost sustainable — the index over hot data often exceeds the compressed log size itself."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>PRODUCERS</DiagramText>
      <DiagramText x={196} y={46} bold size={11} muted>INGEST</DiagramText>
      <DiagramText x={380} y={46} bold size={11} muted>BUFFER</DiagramText>
      <DiagramText x={560} y={46} bold size={11} muted>PROCESSING</DiagramText>
      <DiagramText x={740} y={46} bold size={11} muted>STORAGE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Services → Collector (ship logs) */}
      <Edge
        from={anchors.right(N.services)}
        to={anchors.left(N.collector)}
        variant="ingress"
        label="ship logs"
      />

      {/* Collector → Buffer (append) */}
      <Edge
        from={anchors.right(N.collector)}
        to={anchors.left(N.buffer)}
        variant="create"
        label="append"
      />

      {/* Buffer → Indexer (consume recent) */}
      <Edge
        from={anchors.top(N.buffer)}
        to={anchors.left(N.indexer)}
        variant="redirect"
        label="consume recent"
        labelOffset={-8}
      />

      {/* Buffer → Archiver (consume archive) */}
      <Edge
        from={anchors.bottom(N.buffer)}
        to={anchors.left(N.archiver)}
        variant="redirect"
        label="consume archive"
        labelOffset={8}
      />

      {/* Indexer → Hot Store (index + store) */}
      <Edge
        from={anchors.right(N.indexer)}
        to={anchors.left(N.hotStore)}
        variant="create"
        label="index + store"
      />

      {/* Archiver → Cold Store (compress + store) */}
      <Edge
        from={anchors.right(N.archiver)}
        to={anchors.left(N.coldStore)}
        variant="create"
        label="compress + store"
      />

      {/* Hot Store → Cold Store (age out / tier down) */}
      <Edge
        from={anchors.bottom(N.hotStore)}
        to={anchors.top(N.coldStore)}
        variant="async"
        label="age out / tier down"
        labelOffset={0}
      />

      {/* Query Service → Hot Store (search recent) */}
      <Edge
        from={anchors.right(N.queryService)}
        to={anchors.bottom(N.hotStore)}
        variant="redirect"
        label="search recent"
        labelOffset={-8}
      />

      {/* Query Service → Cold Store (fetch archived — rare) */}
      <Edge
        from={anchors.bottom(N.queryService)}
        to={anchors.bottom(N.coldStore)}
        variant="muted"
        label="fetch archived (rare)"
        labelOffset={10}
      />

      {/* Nodes */}
      <Node geom={N.services}     kind="infra"   label="Services + Agent"  sublabel="log producers" />
      <Node geom={N.collector}    kind="service" label="Ingest Collector"  sublabel="receive + batch" />
      <Node geom={N.buffer}       kind="queue"   label="Log Buffer"        sublabel="durable (Kafka)" />
      <Node geom={N.indexer}      kind="service" label="Indexer"           sublabel="parse + index" />
      <Node geom={N.archiver}     kind="service" label="Archiver"          sublabel="compress" />
      <Node geom={N.hotStore}     kind="store"   label="Hot Store"         sublabel="indexed / SSD" />
      <Node geom={N.coldStore}    kind="store"   label="Cold Store"        sublabel="object storage" />
      <Node geom={N.queryService} kind="service" label="Query Service"     sublabel="search API" />

      <Legend
        x={24}
        y={440}
        items={[
          { variant: "ingress",  label: "Log shipping" },
          { variant: "create",   label: "Append / index / store" },
          { variant: "redirect", label: "Consume / search" },
          { variant: "async",    label: "Tier-down (age out)" },
          { variant: "muted",    label: "Cold fallback (rare)" },
          { kind: "queue",       label: "Durable buffer" },
        ]}
      />
    </DiagramFrame>
  );
}
