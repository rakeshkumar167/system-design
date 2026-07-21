import {
  calculateSnowflakeCapacity,
  type SnowflakeCapacityAssumptions,
} from "@/lib/unique-id-generator-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function SnowflakeCapacity({
  assumptions,
}: {
  assumptions: SnowflakeCapacityAssumptions;
}) {
  const r = calculateSnowflakeCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Timestamp bits", value: fmt(assumptions.timeBits) },
    { label: "Machine-id bits", value: fmt(assumptions.machineBits) },
    { label: "Sequence bits", value: fmt(assumptions.sequenceBits) },
    { label: "Peak demand", value: `${fmt(assumptions.peakIdsPerSec)} /s` },
  ];

  const results: ResultRow[] = [
    { label: "Total bits", value: fmt(r.totalBits), consequence: "1 sign + 41 time + 10 machine + 12 sequence — one signed 64-bit integer." },
    { label: "IDs / ms / node", value: fmt(r.idsPerMsPerNode), consequence: "12 sequence bits: 4,096 distinct IDs per millisecond per node." },
    { label: "IDs / sec / node", value: `${fmt(r.idsPerSecPerNode)} /s`, consequence: "One node, minted locally with no network call or coordination." },
    { label: "Max nodes", value: fmt(r.maxNodes), consequence: "10 machine bits cap the fleet at 1,024 distinct machine ids." },
    { label: "Max IDs / sec (full fleet)", value: `${fmt(r.maxIdsPerSec)} /s`, consequence: "All 1,024 nodes at once — ~4.19 billion/sec, far beyond any real need." },
    { label: "Lifespan", value: `~${fmt(r.lifespanYears, 1)} years`, consequence: "41 time bits of milliseconds from a custom epoch before the clock wraps." },
    { label: "Nodes for peak demand", value: fmt(r.nodesForPeakDemand), consequence: "Even 1,000,000 IDs/sec fits on a single node — throughput is a non-problem; the budget is bits." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
