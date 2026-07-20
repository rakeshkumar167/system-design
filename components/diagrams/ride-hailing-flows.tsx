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

export function LocationUpdateSequence() {
  return (
    <Sequence
      title="Sequence: a driver location update"
      caption="A driver's app sends a GPS ping every few seconds. The location service maps the coordinates to a grid cell and upserts the driver's current position into the in-memory geospatial index, overwriting the previous one. Only the latest position is kept, not a durable history of every ping — persisting the full firehose would be pointless, so driver location is treated as ephemeral live state that the matching queries read against."
      actors={[
        { id: "driver",   label: "Driver App",      kind: "external" },
        { id: "locsvc",   label: "Location Ingest", kind: "service" },
        { id: "geoindex", label: "Geo Index",       kind: "store" },
      ]}
      steps={[
        { from: "driver",   to: "locsvc",   label: "GPS ping (lat, lng)",         variant: "ingress" },
        { from: "locsvc",   to: "locsvc",   label: "map to grid cell",            variant: "control" },
        { from: "locsvc",   to: "geoindex", label: "upsert latest position",      variant: "create" },
        { from: "geoindex", to: "locsvc",   label: "ok (overwrote previous)",     variant: "redirect", reply: true },
      ]}
    />
  );
}

export function MatchRideSequence() {
  return (
    <Sequence
      title="Sequence: match a rider to a driver"
      caption="A ride request asks the matching service for a driver. It queries the geo index for available drivers in the rider's cell and its neighbors, ranks them by estimated arrival time, and reserves the best one atomically before creating the trip. An atomic reservation ensures one driver is never matched to two riders — the same contention control as seat booking — and a driver who declines or times out is skipped for the next candidate."
      actors={[
        { id: "rider",    label: "Rider",           kind: "external" },
        { id: "matcher",  label: "Matching Service", kind: "service" },
        { id: "geoindex", label: "Geo Index",       kind: "store" },
        { id: "trip",     label: "Trip Service",    kind: "service" },
      ]}
      steps={[
        { from: "rider",    to: "matcher",  label: "request ride",                variant: "ingress" },
        { from: "matcher",  to: "geoindex", label: "nearby available drivers",    variant: "redirect" },
        { from: "geoindex", to: "matcher",  label: "candidates in cell + neighbors", variant: "redirect", reply: true },
        { from: "matcher",  to: "matcher",  label: "rank by ETA; reserve best",   variant: "control" },
        { from: "matcher",  to: "trip",     label: "create trip (matched)",       variant: "create" },
        { from: "trip",     to: "rider",    label: "driver assigned",             variant: "redirect", reply: true },
      ]}
    />
  );
}

export function TripStateSequence() {
  return (
    <Sequence
      title="Sequence: the trip lifecycle"
      caption="Every trip is an explicit state machine that rejects invalid transitions. After matching, the trip advances on events — the driver accepts and heads to pickup, arrives, starts the ride, and completes it, at which point payment is captured. A cancellation or no-show is a legal transition to a terminal state, but skipping ahead (starting a ride that was never accepted) is refused, so the trip can never enter an inconsistent state."
      actors={[
        { id: "driver", label: "Driver",       kind: "external" },
        { id: "trip",   label: "Trip Service", kind: "service" },
        { id: "rider",  label: "Rider",        kind: "external" },
      ]}
      steps={[
        { from: "driver", to: "trip",   label: "accept → en route",           variant: "control" },
        { from: "trip",   to: "rider",  label: "driver en route",             variant: "redirect", reply: true },
        { from: "driver", to: "trip",   label: "arrived → start ride",        variant: "control" },
        { from: "driver", to: "trip",   label: "end ride → completed",        variant: "create" },
        { from: "trip",   to: "rider",  label: "trip complete + fare",        variant: "redirect", reply: true },
      ]}
    />
  );
}

export function LiveTrackingSequence() {
  return (
    <Sequence
      title="Sequence: track the driver in real time"
      caption="While the driver approaches, the rider subscribes to the assigned driver's live location stream, so the map updates in real time. Each new driver ping is pushed over a long-lived connection to the rider's app, which redraws the driver's position and refreshes the ETA computed from road routing — the same push-delivery model as a chat system, scoped to just the one driver the rider is matched with."
      actors={[
        { id: "driver",   label: "Driver App",     kind: "external" },
        { id: "geoindex", label: "Geo Index",      kind: "store" },
        { id: "track",    label: "Tracking Service", kind: "service" },
        { id: "rider",    label: "Rider App",      kind: "external" },
      ]}
      steps={[
        { from: "rider",    to: "track",    label: "subscribe to driver",        variant: "ingress" },
        { from: "driver",   to: "geoindex", label: "new position ping",          variant: "create" },
        { from: "geoindex", to: "track",    label: "driver moved",               variant: "async" },
        { from: "track",    to: "rider",    label: "push location + ETA",        variant: "redirect", reply: true },
      ]}
    />
  );
}
