import { DiagramDefs, DiagramText } from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

interface Stage {
  n: number;
  title: string;
  detail: string;
  trigger: string;
  cost: string;
}

const stages: Stage[] = [
  {
    n: 1,
    title: "Single region",
    detail: "One service tier, one primary DB, a read replica.",
    trigger: "Launch / modest traffic",
    cost: "Simple, but one region of latency and blast radius.",
  },
  {
    n: 2,
    title: "Partition + cache",
    detail: "Shard the mapping store; add a distributed cache for reads.",
    trigger: "DB hot / read QPS climbs",
    cost: "Rebalancing and cache invalidation to operate.",
  },
  {
    n: 3,
    title: "Multi-region reads",
    detail: "Replicate read-only mappings; serve redirects regionally.",
    trigger: "Global users, latency SLO",
    cost: "Replication lag; writes still home to one region.",
  },
  {
    n: 4,
    title: "Globally distributed",
    detail: "Edge-cached redirects; active-active or CRDT-style writes.",
    trigger: "Edge-latency targets",
    cost: "Conflict handling and far higher operational complexity.",
  },
];

const CARD_W = 224;
const CARD_H = 184;
const GAP = 24;
const TOP = 16;

export function ScaleEvolution() {
  const width = stages.length * CARD_W + (stages.length - 1) * GAP;
  const height = TOP + CARD_H + 56;

  return (
    <DiagramFrame
      title="Scaling evolution: four stages from single region to globally distributed"
      viewBox={`0 0 ${width} ${height}`}
      caption="Each stage is triggered by a specific pressure and buys capacity at a specific operational cost. Don't jump ahead — add complexity only when its trigger actually arrives."
    >
      <DiagramDefs />

      {stages.map((stage, i) => {
        const x = i * (CARD_W + GAP);
        return (
          <g key={stage.n}>
            {i < stages.length - 1 && (
              <line
                x1={x + CARD_W}
                y1={TOP + CARD_H / 2}
                x2={x + CARD_W + GAP}
                y2={TOP + CARD_H / 2}
                stroke="var(--accent)"
                strokeWidth={2}
                markerEnd="url(#arrow-create)"
              />
            )}

            <rect
              x={x}
              y={TOP}
              width={CARD_W}
              height={CARD_H}
              rx={12}
              fill="var(--surface)"
              stroke="var(--border-strong)"
              strokeWidth={1.5}
            />

            <circle cx={x + 26} cy={TOP + 26} r={13} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} />
            <text x={x + 26} y={TOP + 26} textAnchor="middle" dominantBaseline="middle" style={{ fill: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
              {stage.n}
            </text>

            <DiagramText x={x + 48} y={TOP + 30} bold size={13}>
              {stage.title}
            </DiagramText>

            <foreignObject x={x + 16} y={TOP + 44} width={CARD_W - 32} height={CARD_H - 50}>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: "var(--ink-muted)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <p style={{ color: "var(--ink)" }}>{stage.detail}</p>
                <p style={{ marginTop: 6 }}>
                  <strong style={{ color: "var(--accent)" }}>Trigger:</strong> {stage.trigger}
                </p>
                <p style={{ marginTop: 4 }}>
                  <strong style={{ color: "var(--warning)" }}>Cost:</strong> {stage.cost}
                </p>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </DiagramFrame>
  );
}
