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

export function CreatePasteSequence() {
  return (
    <Sequence
      title="Sequence: creating a paste"
      caption="The client POSTs the paste content to the App/API. The app writes the blob to object storage first — so a committed metadata row always points to a real blob — then inserts the metadata row (id, blob_key, expiry, visibility) in the Metadata DB. Only after both writes succeed does the app return 201 with the paste id and URL."
      actors={[
        { id: "client",   label: "Client",         kind: "infra" },
        { id: "app",      label: "App / API",       kind: "service" },
        { id: "objStore", label: "Object Storage",  kind: "store" },
        { id: "metaDb",   label: "Metadata DB",     kind: "store" },
      ]}
      steps={[
        { from: "client",   to: "app",      label: "POST /v1/pastes {content, expiry, visibility}", variant: "create" },
        { from: "app",      to: "objStore", label: "PUT blob",                                      variant: "create" },
        { from: "objStore", to: "app",      label: "blob_key",                                      variant: "create", reply: true },
        { from: "app",      to: "metaDb",   label: "INSERT (id, blob_key, expiry, visibility)",     variant: "create" },
        { from: "metaDb",   to: "app",      label: "ok",                                            variant: "create", reply: true },
        { from: "app",      to: "client",   label: "201 {id, url}",                                 variant: "create", reply: true },
      ]}
    />
  );
}

export function ReadCacheHitSequence() {
  return (
    <Sequence
      title="Sequence: read paste — CDN cache hit"
      caption="The common case. Because paste content is immutable, the CDN can cache it indefinitely. The client's request hits a CDN edge node that already holds the blob, and the content is returned immediately without contacting the origin. Most read traffic ends here, keeping latency below 50 ms globally and shielding the origin from read load."
      actors={[
        { id: "client", label: "Client", kind: "infra" },
        { id: "cdn",    label: "CDN",    kind: "cache" },
      ]}
      steps={[
        { from: "client", to: "cdn",    label: "GET /{id}/raw",          variant: "redirect" },
        { from: "cdn",    to: "client", label: "200 OK (cached content)", variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ReadCacheMissSequence() {
  return (
    <Sequence
      title="Sequence: read paste — CDN cache miss"
      caption="On a CDN miss the request falls through to the App/API. The app reads the metadata row to check expiry and visibility, then fetches the blob from object storage. The response is returned to the client and simultaneously used to backfill the CDN edge cache with a long TTL so subsequent requests for the same paste are served from the edge."
      actors={[
        { id: "client",   label: "Client",        kind: "infra" },
        { id: "cdn",      label: "CDN",           kind: "cache" },
        { id: "app",      label: "App / API",     kind: "service" },
        { id: "metaDb",   label: "Metadata DB",   kind: "store" },
        { id: "objStore", label: "Object Storage", kind: "store" },
      ]}
      steps={[
        { from: "client",   to: "cdn",      label: "GET /{id}/raw",                variant: "redirect" },
        { from: "cdn",      to: "app",      label: "CDN miss → origin request",    variant: "redirect" },
        { from: "app",      to: "metaDb",   label: "SELECT expiry, visibility, blob_key", variant: "redirect" },
        { from: "metaDb",   to: "app",      label: "metadata row",                 variant: "redirect", reply: true },
        { from: "app",      to: "objStore", label: "GET blob_key",                 variant: "redirect" },
        { from: "objStore", to: "app",      label: "blob content",                 variant: "redirect", reply: true },
        { from: "app",      to: "cdn",      label: "200 OK + Cache-Control (backfill)", variant: "redirect", reply: true },
        { from: "cdn",      to: "client",   label: "200 OK (content)",             variant: "redirect", reply: true },
      ]}
    />
  );
}

export function ExpirySequence() {
  return (
    <Sequence
      title="Sequence: expiry — lazy check and active worker deletion"
      caption="Expiry uses two complementary strategies. Lazily: when a client reads an expired paste, the App/API checks expires_at in the metadata row and immediately returns 410 Gone without fetching the blob. Actively: the Expiry Worker periodically scans the Metadata DB for expired rows, deletes the metadata, and removes the corresponding blob from object storage — reclaiming storage and ensuring stale content is unreachable even if not recently requested."
      actors={[
        { id: "client",     label: "Client",        kind: "infra" },
        { id: "app",        label: "App / API",     kind: "service" },
        { id: "metaDb",     label: "Metadata DB",   kind: "store" },
        { id: "objStore",   label: "Object Storage", kind: "store" },
        { id: "expWorker",  label: "Expiry Worker", kind: "queue" },
      ]}
      steps={[
        { from: "client",    to: "app",       label: "GET /{id}/raw (expired paste)",     variant: "redirect" },
        { from: "app",       to: "metaDb",    label: "SELECT expires_at",                 variant: "redirect" },
        { from: "metaDb",    to: "app",       label: "expires_at < now",                  variant: "control", reply: true },
        { from: "app",       to: "client",    label: "410 Gone",                          variant: "control", reply: true },
        { from: "expWorker", to: "metaDb",    label: "SELECT WHERE expires_at < now",     variant: "control" },
        { from: "expWorker", to: "metaDb",    label: "DELETE expired row",                variant: "control" },
        { from: "expWorker", to: "objStore",  label: "DELETE blob_key",                   variant: "async" },
      ]}
    />
  );
}
