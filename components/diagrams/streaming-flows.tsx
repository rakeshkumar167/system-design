import {
  DiagramDefs,
  edgeColors,
  type EdgeVariant,
  type NodeKind,
} from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

interface Actor {
  id: string;
  label: string;
  kind: NodeKind;
}

interface Step {
  from: string;
  to: string;
  label: string;
  variant: EdgeVariant;
  /** Dashed return / response message. */
  reply?: boolean;
}

const MARGIN = 24;
const ACTOR_W = 150;
const GAP = 46;
const HEAD_Y = 18;
const HEAD_H = 44;
const FIRST_STEP_Y = 96;
const STEP_DY = 46;

const actorColor: Record<NodeKind, { fill: string; stroke: string }> = {
  infra:    { fill: "var(--surface-2)",   stroke: "var(--border-strong)" },
  service:  { fill: "var(--accent-soft)", stroke: "var(--accent)" },
  store:    { fill: "var(--surface)",     stroke: "var(--fundamentals)" },
  cache:    { fill: "var(--surface)",     stroke: "var(--success)" },
  queue:    { fill: "var(--surface)",     stroke: "var(--advanced)" },
  external: { fill: "var(--surface)",     stroke: "var(--warning)" },
};

function Sequence({
  title,
  caption,
  actors,
  steps,
}: {
  title: string;
  caption: string;
  actors: Actor[];
  steps: Step[];
}) {
  const centerX = (i: number) => MARGIN + i * (ACTOR_W + GAP) + ACTOR_W / 2;
  const indexOf = (id: string) => actors.findIndex((a) => a.id === id);
  const width = MARGIN * 2 + actors.length * ACTOR_W + (actors.length - 1) * GAP;
  const lifelineBottom = FIRST_STEP_Y + steps.length * STEP_DY - 12;
  const height = lifelineBottom + 28;

  return (
    <DiagramFrame title={title} caption={caption} viewBox={`0 0 ${width} ${height}`}>
      <DiagramDefs />

      {/* Lifelines + actor headers */}
      {actors.map((a, i) => {
        const cx = centerX(i);
        const c = actorColor[a.kind];
        return (
          <g key={a.id}>
            <line
              x1={cx}
              y1={HEAD_Y + HEAD_H}
              x2={cx}
              y2={lifelineBottom}
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <rect
              x={cx - ACTOR_W / 2}
              y={HEAD_Y}
              width={ACTOR_W}
              height={HEAD_H}
              rx={9}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth={1.5}
              strokeDasharray={a.kind === "external" ? "5 4" : undefined}
            />
            <text
              x={cx}
              y={HEAD_Y + HEAD_H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Messages */}
      {steps.map((s, i) => {
        const y = FIRST_STEP_Y + i * STEP_DY;
        const fi = indexOf(s.from);
        const ti = indexOf(s.to);
        const color = edgeColors[s.variant];

        if (fi === ti) {
          const cx = centerX(fi);
          return (
            <g key={i}>
              <path
                d={`M${cx},${y} h36 v18 h-36`}
                fill="none"
                stroke={color}
                strokeWidth={1.75}
                markerEnd={`url(#arrow-${s.variant})`}
              />
              <StepLabel x={cx + 46} y={y + 2} n={i + 1} text={s.label} color={color} anchor="start" />
            </g>
          );
        }

        const x1 = centerX(fi);
        const x2 = centerX(ti);
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y}
              x2={x2 + (x2 > x1 ? -1 : 1)}
              y2={y}
              stroke={color}
              strokeWidth={1.75}
              strokeDasharray={s.reply ? "5 4" : undefined}
              markerEnd={`url(#arrow-${s.variant})`}
            />
            <StepLabel
              x={(x1 + x2) / 2}
              y={y - 7}
              n={i + 1}
              text={s.label}
              color={color}
              anchor="middle"
            />
            <circle cx={x1} cy={y} r={2.5} fill={color} />
          </g>
        );
      })}
    </DiagramFrame>
  );
}

function StepLabel({
  x,
  y,
  n,
  text,
  color,
  anchor,
}: {
  x: number;
  y: number;
  n: number;
  text: string;
  color: string;
  anchor: "start" | "middle";
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
      <tspan style={{ fill: color, fontSize: 10, fontWeight: 700 }}>{n}. </tspan>
      <tspan style={{ fill: "var(--ink)", fontSize: 11 }}>{text}</tspan>
    </text>
  );
}

export function UploadIngestSequence() {
  return (
    <Sequence
      title="Sequence: upload and ingest — resumable chunked upload to object storage"
      caption="Uploads are resumable: the client sends chunks directly to Raw Storage via a presigned URL, so a network interruption does not restart the entire upload. The Upload Service creates the video record and issues the presigned URL but does not proxy the bytes — the upload goes straight to object storage. Once the client confirms the upload is complete, the Upload Service enqueues an async transcode job and returns 202 Accepted immediately; the video status is 'transcoding' until the pipeline finishes."
      actors={[
        { id: "player",  label: "Player",         kind: "infra" },
        { id: "upload",  label: "Upload Service", kind: "service" },
        { id: "raw",     label: "Raw Storage",    kind: "store" },
        { id: "queue",   label: "Transcode Queue", kind: "queue" },
      ]}
      steps={[
        { from: "player", to: "upload", label: "POST /v1/videos {title, size, duration}",             variant: "create" },
        { from: "upload", to: "raw",    label: "issue presigned upload URL",                          variant: "create" },
        { from: "raw",    to: "upload", label: "presigned URL returned",                              variant: "redirect", reply: true },
        { from: "upload", to: "player", label: "201 Created {video_id, upload_url}",                  variant: "redirect", reply: true },
        { from: "player", to: "raw",    label: "PUT chunks via presigned URL (resumable)",            variant: "ingress" },
        { from: "player", to: "upload", label: "POST /v1/videos/{id}/complete",                      variant: "create" },
        { from: "upload", to: "queue",  label: "enqueue transcode job {video_id}",                   variant: "async" },
        { from: "upload", to: "player", label: "202 Accepted {status: transcoding}",                 variant: "redirect", reply: true },
      ]}
    />
  );
}

export function TranscodePipelineSequence() {
  return (
    <Sequence
      title="Sequence: transcode pipeline — async fan-out into rendition ladder"
      caption="The transcode pipeline is an async fan-out: one source video becomes many renditions (e.g. 1080p, 720p, 480p, 360p, 240p), and each rendition is segmented into short chunks (typically 2–6 seconds). Workers dequeue jobs idempotently — a crash or retry restarts the job without side effects because segment writes are idempotent and the final status flip is a conditional update. The video is marked ready in the Metadata DB only after all segments and the HLS/DASH master manifest are fully written; a partial transcode is never surfaced to players."
      actors={[
        { id: "worker",  label: "Transcode Workers", kind: "service" },
        { id: "raw",     label: "Raw Storage",       kind: "store" },
        { id: "segment", label: "Segment Storage",   kind: "store" },
        { id: "meta",    label: "Metadata DB",       kind: "store" },
      ]}
      steps={[
        { from: "worker",  to: "worker",  label: "dequeue transcode job {video_id}",                      variant: "async" },
        { from: "worker",  to: "raw",     label: "GET source file",                                       variant: "redirect" },
        { from: "raw",     to: "worker",  label: "source bytes streamed",                                 variant: "redirect", reply: true },
        { from: "worker",  to: "worker",  label: "transcode → rendition ladder + segment each rendition", variant: "create" },
        { from: "worker",  to: "segment", label: "PUT segments + per-rendition manifests",                variant: "create" },
        { from: "worker",  to: "segment", label: "PUT master manifest (all renditions)",                  variant: "create" },
        { from: "worker",  to: "meta",    label: "UPDATE video SET status='ready', manifest_url=…",       variant: "control" },
      ]}
    />
  );
}

export function AbrPlaybackSequence() {
  return (
    <Sequence
      title="Sequence: adaptive bitrate playback — client-driven quality selection"
      caption="Adaptive bitrate streaming delegates quality selection to the player, not the server. The player fetches the master manifest from the CDN, which lists all available renditions and their bandwidth requirements. It picks a starting rendition, requests the first segment, measures the actual download throughput, and switches to a higher or lower rendition for the next segment if conditions change. This per-segment adaptation avoids rebuffering: the player degrades gracefully under congestion rather than stalling."
      actors={[
        { id: "player",  label: "Player",          kind: "infra" },
        { id: "cdn",     label: "CDN",              kind: "cache" },
        { id: "segment", label: "Segment Storage", kind: "store" },
      ]}
      steps={[
        { from: "player",  to: "cdn",     label: "GET master manifest",                              variant: "redirect" },
        { from: "cdn",     to: "player",  label: "manifest: rendition list + bandwidth hints",       variant: "redirect", reply: true },
        { from: "player",  to: "player",  label: "pick rendition based on current bandwidth",        variant: "control" },
        { from: "player",  to: "cdn",     label: "GET segment N (chosen rendition)",                 variant: "redirect" },
        { from: "cdn",     to: "player",  label: "segment bytes (cache hit)",                        variant: "redirect", reply: true },
        { from: "player",  to: "player",  label: "measure throughput → switch rendition for N+1",   variant: "control" },
        { from: "player",  to: "cdn",     label: "GET segment N+1 (new rendition)",                  variant: "redirect" },
        { from: "cdn",     to: "segment", label: "origin fetch (cache miss for new rendition)",      variant: "redirect" },
        { from: "segment", to: "cdn",     label: "segment bytes → cache fill",                       variant: "redirect", reply: true },
        { from: "cdn",     to: "player",  label: "segment bytes served",                             variant: "redirect", reply: true },
      ]}
    />
  );
}

export function CdnDeliverySequence() {
  return (
    <Sequence
      title="Sequence: CDN delivery — cache hit vs. origin fetch on cache miss"
      caption="Cache hit ratio is the dominant delivery lever: segments are immutable once written, so the CDN can cache them indefinitely and serve ~95% of requests from the edge without touching the origin. A cache hit is served directly from the CDN edge node with sub-millisecond overhead. A cache miss (cold segment or first-time rendition request) triggers an origin fetch from Segment Storage — the CDN fetches, caches, and serves in a single round trip. Only the miss fraction (~5%) reaches the origin, making Segment Storage throughput requirements manageable even at tens of Tbps peak delivery."
      actors={[
        { id: "player",  label: "Player",          kind: "infra" },
        { id: "cdn",     label: "CDN Edge",         kind: "cache" },
        { id: "segment", label: "Segment Storage", kind: "store" },
      ]}
      steps={[
        { from: "player",  to: "cdn",     label: "GET segment (popular / warm)",                      variant: "redirect" },
        { from: "cdn",     to: "player",  label: "200 OK — served from edge cache (hit)",             variant: "redirect", reply: true },
        { from: "player",  to: "cdn",     label: "GET segment (cold / first request)",                variant: "redirect" },
        { from: "cdn",     to: "cdn",     label: "cache miss — forward to origin",                   variant: "control" },
        { from: "cdn",     to: "segment", label: "GET segment from Segment Storage (origin fetch)",   variant: "redirect" },
        { from: "segment", to: "cdn",     label: "segment bytes",                                    variant: "redirect", reply: true },
        { from: "cdn",     to: "cdn",     label: "cache fill — store segment at edge",               variant: "control" },
        { from: "cdn",     to: "player",  label: "200 OK — segment served (miss filled)",            variant: "redirect", reply: true },
      ]}
    />
  );
}
