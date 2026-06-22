import type { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Shared SVG vocabulary for technical diagrams.
 *
 * Colors reference CSS custom properties so diagrams adapt to light/dark.
 * Node shape encodes role; edge color + dash encode the meaning of a path:
 *   - create  (accent, solid)   : synchronous write path
 *   - redirect(green,  solid)   : synchronous read/redirect path
 *   - async   (violet, dashed)  : asynchronous / event-driven path
 *   - control (amber,  dashed)  : control / invalidation messages
 *   - muted   (faint,  dotted)  : telemetry (metrics, logs)
 * ------------------------------------------------------------------ */

export type NodeKind =
  | "infra"
  | "service"
  | "store"
  | "cache"
  | "queue"
  | "external";

export type EdgeVariant =
  | "ingress"
  | "create"
  | "redirect"
  | "async"
  | "control"
  | "muted";

const nodeStyles: Record<NodeKind, { fill: string; stroke: string }> = {
  infra: { fill: "var(--surface-2)", stroke: "var(--border-strong)" },
  service: { fill: "var(--accent-soft)", stroke: "var(--accent)" },
  store: { fill: "var(--surface)", stroke: "var(--fundamentals)" },
  cache: { fill: "var(--surface)", stroke: "var(--success)" },
  queue: { fill: "var(--surface)", stroke: "var(--advanced)" },
  external: { fill: "var(--surface)", stroke: "var(--warning)" },
};

export const edgeColors: Record<EdgeVariant, string> = {
  ingress: "var(--ink-muted)",
  create: "var(--accent)",
  redirect: "var(--success)",
  async: "var(--advanced)",
  control: "var(--warning)",
  muted: "var(--ink-faint)",
};

const edgeDash: Record<EdgeVariant, string | undefined> = {
  ingress: undefined,
  create: undefined,
  redirect: undefined,
  async: "6 5",
  control: "6 5",
  muted: "2 4",
};

/** Arrowhead marker definitions — one per edge color. Render once per <svg>. */
export function DiagramDefs() {
  return (
    <defs>
      {(Object.keys(edgeColors) as EdgeVariant[]).map((variant) => (
        <marker
          key={variant}
          id={`arrow-${variant}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={edgeColors[variant]} />
        </marker>
      ))}
    </defs>
  );
}

export interface NodeGeom {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const anchors = {
  left: (n: NodeGeom) => ({ x: n.x, y: n.y + n.h / 2 }),
  right: (n: NodeGeom) => ({ x: n.x + n.w, y: n.y + n.h / 2 }),
  top: (n: NodeGeom) => ({ x: n.x + n.w / 2, y: n.y }),
  bottom: (n: NodeGeom) => ({ x: n.x + n.w / 2, y: n.y + n.h }),
  center: (n: NodeGeom) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 }),
};

export function Node({
  geom,
  kind,
  label,
  sublabel,
}: {
  geom: NodeGeom;
  kind: NodeKind;
  label: string;
  sublabel?: string;
}) {
  const { x, y, w, h } = geom;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = nodeStyles[kind];
  const dashed = kind === "external";

  return (
    <g>
      {kind === "store" ? (
        <Cylinder geom={geom} fill={s.fill} stroke={s.stroke} />
      ) : (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={kind === "cache" ? h / 2 : 10}
          fill={s.fill}
          stroke={s.stroke}
          strokeWidth={1.5}
          strokeDasharray={dashed ? "5 4" : undefined}
        />
      )}
      <text
        x={cx}
        y={sublabel ? cy - 4 : cy}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "var(--ink)", fontSize: 13, fontWeight: 600 }}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "var(--ink-muted)", fontSize: 10.5 }}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

function Cylinder({
  geom,
  fill,
  stroke,
}: {
  geom: NodeGeom;
  fill: string;
  stroke: string;
}) {
  const { x, y, w, h } = geom;
  const ry = 9;
  return (
    <g fill={fill} stroke={stroke} strokeWidth={1.5}>
      <path
        d={`M${x},${y + ry} L${x},${y + h - ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + h - ry} L${x + w},${y + ry}`}
      />
      <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} />
    </g>
  );
}

export function Edge({
  from,
  to,
  variant,
  label,
  labelOffset = 0,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  variant: EdgeVariant;
  label?: string;
  /** Nudge the label perpendicular to the line to avoid overlaps. */
  labelOffset?: number;
}) {
  const color = edgeColors[variant];
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 + labelOffset;

  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={1.75}
        strokeDasharray={edgeDash[variant]}
        markerEnd={`url(#arrow-${variant})`}
      />
      {label && (
        <EdgeLabel x={midX} y={midY} text={label} color={color} />
      )}
    </g>
  );
}

export function EdgeLabel({
  x,
  y,
  text,
  color,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
}) {
  const width = text.length * 6.2 + 10;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 9}
        width={width}
        height={18}
        rx={5}
        fill="var(--canvas)"
        opacity={0.92}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: color, fontSize: 10.5, fontWeight: 600 }}
      >
        {text}
      </text>
    </g>
  );
}

export function Legend({
  x,
  y,
  items,
}: {
  x: number;
  y: number;
  items: { variant?: EdgeVariant; kind?: NodeKind; label: string }[];
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      {items.map((item, i) => {
        const ix = (i % 3) * 200;
        const iy = Math.floor(i / 3) * 22;
        return (
          <g key={item.label} transform={`translate(${ix},${iy})`}>
            {item.variant ? (
              <line
                x1={0}
                y1={6}
                x2={26}
                y2={6}
                stroke={edgeColors[item.variant]}
                strokeWidth={2}
                strokeDasharray={edgeDash[item.variant]}
                markerEnd={`url(#arrow-${item.variant})`}
              />
            ) : (
              <rect
                x={4}
                y={0}
                width={20}
                height={12}
                rx={item.kind === "cache" ? 6 : 3}
                fill={item.kind ? nodeStyles[item.kind].fill : "none"}
                stroke={item.kind ? nodeStyles[item.kind].stroke : "none"}
                strokeWidth={1.5}
                strokeDasharray={item.kind === "external" ? "4 3" : undefined}
              />
            )}
            <text
              x={34}
              y={6}
              dominantBaseline="middle"
              style={{ fill: "var(--ink-muted)", fontSize: 11 }}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Section/title text inside a diagram. */
export function DiagramText({
  x,
  y,
  children,
  muted,
  bold,
  size = 11,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: ReactNode;
  muted?: boolean;
  bold?: boolean;
  size?: number;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      style={{
        fill: muted ? "var(--ink-faint)" : "var(--ink)",
        fontSize: size,
        fontWeight: bold ? 700 : 400,
        letterSpacing: bold ? "0.04em" : undefined,
      }}
    >
      {children}
    </text>
  );
}
