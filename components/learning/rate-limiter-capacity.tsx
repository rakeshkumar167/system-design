import {
  calculateRateLimiterCapacity,
  type RateLimiterCapacityAssumptions,
} from "@/lib/rate-limiter-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function RateLimiterCapacity({
  assumptions,
}: {
  assumptions: RateLimiterCapacityAssumptions;
}) {
  const r = calculateRateLimiterCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Peak requests / sec", value: fmt(assumptions.peakRequestsPerSecond) },
    { label: "Checks / request", value: fmt(assumptions.checksPerRequest) },
    { label: "Active counter keys", value: fmt(assumptions.activeKeys) },
    { label: "Bytes / counter", value: `${fmt(assumptions.bytesPerCounter)} B` },
    { label: "Redis ops / node", value: fmt(assumptions.redisOpsPerNode) },
  ];

  const results: ResultRow[] = [
    { label: "Counter ops / sec", value: fmt(r.counterOpsPerSecond), consequence: "Every request is one atomic increment — this is the load the counter tier must absorb." },
    { label: "Counter memory", value: `${fmt(r.counterMemoryGB, 1)} GB`, consequence: "Counters are tiny; the whole working set fits in memory, so reads never touch disk." },
    { label: "Redis nodes (for ops)", value: fmt(r.redisNodesForOps), consequence: "Ops/sec, not memory, sizes the cluster — drives sharding by counter key." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
