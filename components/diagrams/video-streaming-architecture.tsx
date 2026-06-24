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
  player:           { x: 24,  y: 200, w: 110, h: 56 },
  uploadService:    { x: 188, y: 200, w: 140, h: 56 },
  rawStorage:       { x: 390, y: 100, w: 130, h: 60 },
  transcodeQueue:   { x: 390, y: 200, w: 130, h: 56 },
  transcodeWorkers: { x: 390, y: 320, w: 140, h: 56 },
  segmentStorage:   { x: 590, y: 200, w: 130, h: 60 },
  cdn:              { x: 188, y: 340, w: 130, h: 56 },
  metadataDb:       { x: 590, y: 340, w: 130, h: 60 },
} satisfies Record<string, NodeGeom>;

export function VideoStreamingArchitecture() {
  return (
    <DiagramFrame
      title="Video streaming architecture: upload service, transcode pipeline, CDN delivery"
      viewBox="0 0 760 460"
      caption="The Upload Service receives chunked video from the Player and stores the raw source in Raw Storage before enqueueing an async transcode job. Transcode Workers dequeue jobs, read the source, and produce a rendition ladder of segments (each rendition × each segment stored in Segment Storage). Once all segments and the HLS/DASH manifest are written, the worker marks the video ready in the Metadata DB. Delivery is CDN-dominated: the Player fetches the master manifest and then requests individual segments using adaptive bitrate logic — switching rendition per segment based on measured throughput. The CDN serves ~95% of segment requests from edge cache; only misses reach Segment Storage (the origin). The asynchronous pipeline (queue → workers) decouples upload throughput from transcode capacity and makes every job idempotent and retryable."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>INGRESS</DiagramText>
      <DiagramText x={188} y={46} bold size={11} muted>INGEST</DiagramText>
      <DiagramText x={390} y={46} bold size={11} muted>PIPELINE</DiagramText>
      <DiagramText x={590} y={46} bold size={11} muted>STORAGE / CDN</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Player → Upload Service (upload chunks) */}
      <Edge
        from={anchors.right(N.player)}
        to={anchors.left(N.uploadService)}
        variant="ingress"
        label="upload chunks"
      />

      {/* Upload Service → Raw Storage (store source) */}
      <Edge
        from={anchors.top(N.uploadService)}
        to={anchors.bottom(N.rawStorage)}
        variant="create"
        label="store source"
      />

      {/* Upload Service → Transcode Queue (enqueue job) */}
      <Edge
        from={anchors.right(N.uploadService)}
        to={anchors.left(N.transcodeQueue)}
        variant="async"
        label="enqueue job"
      />

      {/* Transcode Queue → Transcode Workers (dequeue) */}
      <Edge
        from={anchors.bottom(N.transcodeQueue)}
        to={anchors.top(N.transcodeWorkers)}
        variant="async"
        label="dequeue"
      />

      {/* Transcode Workers → Raw Storage (read source) */}
      <Edge
        from={anchors.top(N.transcodeWorkers)}
        to={anchors.bottom(N.rawStorage)}
        variant="redirect"
        label="read source"
        labelOffset={-10}
      />

      {/* Transcode Workers → Segment Storage (write renditions) */}
      <Edge
        from={anchors.right(N.transcodeWorkers)}
        to={anchors.bottom(N.segmentStorage)}
        variant="create"
        label="write renditions"
      />

      {/* Transcode Workers → Metadata DB (mark ready) */}
      <Edge
        from={anchors.right(N.transcodeWorkers)}
        to={anchors.left(N.metadataDb)}
        variant="control"
        label="mark ready"
        labelOffset={-12}
      />

      {/* Player → CDN (request segments) */}
      <Edge
        from={anchors.bottom(N.player)}
        to={anchors.left(N.cdn)}
        variant="redirect"
        label="request segments"
      />

      {/* CDN → Segment Storage (origin fetch on miss) */}
      <Edge
        from={anchors.top(N.cdn)}
        to={anchors.bottom(N.segmentStorage)}
        variant="redirect"
        label="origin fetch (miss)"
        labelOffset={0}
      />

      {/* Nodes */}
      <Node geom={N.player}           kind="infra"   label="Player"            sublabel="browser / app" />
      <Node geom={N.uploadService}    kind="service" label="Upload Service"    sublabel="resumable chunks" />
      <Node geom={N.rawStorage}       kind="store"   label="Raw Storage"       sublabel="source files" />
      <Node geom={N.transcodeQueue}   kind="queue"   label="Transcode Queue"   sublabel="async jobs" />
      <Node geom={N.transcodeWorkers} kind="service" label="Transcode Workers" sublabel="rendition ladder" />
      <Node geom={N.segmentStorage}   kind="store"   label="Segment Storage"   sublabel="segments + manifests" />
      <Node geom={N.cdn}              kind="cache"   label="CDN"               sublabel="~95% hit ratio" />
      <Node geom={N.metadataDb}       kind="store"   label="Metadata DB"       sublabel="video status" />

      <Legend
        x={24}
        y={415}
        items={[
          { variant: "ingress",  label: "Client upload" },
          { variant: "async",    label: "Async enqueue / dequeue" },
          { variant: "create",   label: "Write / store renditions" },
          { variant: "redirect", label: "Read / CDN serve" },
          { variant: "control",  label: "Mark ready" },
          { kind: "cache",       label: "CDN edge cache" },
        ]}
      />
    </DiagramFrame>
  );
}
