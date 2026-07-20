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

export function UploadPhotoSequence() {
  return (
    <Sequence
      title="Sequence: upload a photo"
      caption="The client asks the app for a presigned URL and uploads the original bytes straight to the object store, so uploading directly to the object store bypasses the application servers, which would otherwise bottleneck on multi-megabyte request bodies. The app records the photo's metadata marked as processing and enqueues a job, then acknowledges immediately — the heavy work happens asynchronously, so the upload feels instant."
      actors={[
        { id: "client", label: "Client",       kind: "external" },
        { id: "api",    label: "App / API",     kind: "service" },
        { id: "store",  label: "Object Store",  kind: "store" },
        { id: "queue",  label: "Process Queue", kind: "queue" },
      ]}
      steps={[
        { from: "client", to: "api",    label: "request presigned URL",       variant: "ingress" },
        { from: "api",    to: "client", label: "presigned URL",               variant: "redirect", reply: true },
        { from: "client", to: "store",  label: "upload original (direct)",    variant: "create" },
        { from: "api",    to: "queue",  label: "enqueue process job",         variant: "async" },
        { from: "api",    to: "client", label: "202 accepted (processing)",   variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ProcessImageSequence() {
  return (
    <Sequence
      title="Sequence: process an uploaded image"
      caption="A worker pulls the job, reads the original from the object store, and generates the derivative resolutions and formats (resizing, transcoding to WebP/AVIF, stripping EXIF), writing each back to the store and marking the photo ready. The original is never modified, so derivatives can be regenerated — a new size backfilled later — and the job is idempotent, so a retry after a crash re-derives exactly the same outputs."
      actors={[
        { id: "queue",  label: "Process Queue", kind: "queue" },
        { id: "worker", label: "Image Worker",  kind: "service" },
        { id: "store",  label: "Object Store",  kind: "store" },
        { id: "meta",   label: "Metadata DB",   kind: "store" },
      ]}
      steps={[
        { from: "queue",  to: "worker", label: "dispatch process job",         variant: "async" },
        { from: "worker", to: "store",  label: "read original",                variant: "redirect" },
        { from: "worker", to: "worker", label: "resize, transcode, strip EXIF", variant: "control" },
        { from: "worker", to: "store",  label: "write derivatives",            variant: "create" },
        { from: "worker", to: "meta",   label: "mark photo ready",             variant: "create" },
      ]}
    />
  );
}

export function ServeImageSequence() {
  return (
    <Sequence
      title="Sequence: serve an image"
      caption="A client requests the image at the size its screen needs; the CDN returns it from the edge on a hit, and on a miss fetches that derivative from the object store, caches it, and returns it. Because derivative URLs are immutable they cache indefinitely, so the CDN absorbs the overwhelming majority of read traffic and the origin object store sees only the small fraction of misses — responsive delivery sends the smallest derivative that fits the device."
      actors={[
        { id: "client", label: "Client",       kind: "external" },
        { id: "cdn",    label: "CDN",           kind: "infra" },
        { id: "store",  label: "Object Store",  kind: "store" },
      ]}
      steps={[
        { from: "client", to: "cdn",    label: "GET right-sized image",       variant: "ingress" },
        { from: "cdn",    to: "store",  label: "cache miss → fetch derivative", variant: "redirect" },
        { from: "store",  to: "cdn",    label: "derivative bytes",            variant: "redirect", reply: true },
        { from: "cdn",    to: "cdn",    label: "cache at edge (immutable)",   variant: "create" },
        { from: "cdn",    to: "client", label: "image (from edge)",           variant: "redirect", reply: true },
      ]}
    />
  );
}

export function FeedLoadSequence() {
  return (
    <Sequence
      title="Sequence: load a photo feed"
      caption="The client asks the feed service for the timeline and gets back a page of post IDs with their metadata; it then fetches each image from the CDN. The feed is a list of post IDs hydrated with image URLs, and the images themselves come from the CDN, not the feed service — so feed generation is the fan-out problem from the News Feed design, while the heavy image bytes are served entirely from the edge."
      actors={[
        { id: "client", label: "Client",       kind: "external" },
        { id: "feed",   label: "Feed Service",  kind: "service" },
        { id: "meta",   label: "Metadata DB",   kind: "store" },
        { id: "cdn",    label: "CDN",           kind: "infra" },
      ]}
      steps={[
        { from: "client", to: "feed", label: "GET feed page",              variant: "ingress" },
        { from: "feed",   to: "meta", label: "read post-ID list + meta",   variant: "control" },
        { from: "meta",   to: "feed", label: "posts + image URLs",         variant: "redirect", reply: true },
        { from: "feed",   to: "client", label: "feed page (IDs + URLs)",   variant: "redirect", reply: true },
        { from: "client", to: "cdn",  label: "fetch each image",           variant: "ingress" },
      ]}
    />
  );
}
