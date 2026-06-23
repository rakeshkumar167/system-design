import {
  calculateUrlShortenerCapacity,
  type CapacityAssumptions,
} from "@/lib/url-shortener-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CapacityModel({ assumptions }: { assumptions: CapacityAssumptions }) {
  const r = calculateUrlShortenerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New links / month", value: fmt(assumptions.newLinksPerMonth) },
    { label: "Read : write ratio", value: `${fmt(assumptions.readWriteRatio)}:1` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Bytes / mapping", value: `${fmt(assumptions.bytesPerMapping)} B` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
    { label: "Cache coverage", value: `${fmt(assumptions.cacheCoveragePercent)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Average write QPS", value: fmt(r.averageWriteQps), consequence: "Tiny. A single write node handles this — writes are never the bottleneck." },
    { label: "Average read QPS", value: fmt(r.averageReadQps), consequence: "Reads dominate by 100×. The redirect path is what we must scale and cache." },
    { label: "Peak read QPS", value: fmt(r.peakReadQps), consequence: "Provision for peak, not average. Drives cache sizing and replica count." },
    { label: "Total stored mappings", value: fmt(r.totalMappings), consequence: "Billions of rows over 5 years — too big for one node, so we partition." },
    { label: "Mapping storage", value: `${fmt(r.mappingStorageTB, 1)} TB`, consequence: "Modest for a sharded key-value store; metadata, not media, dominates." },
    { label: "Cache working set", value: `${fmt(r.cacheWorkingSetGB)} GB`, consequence: "Hot set fits in a distributed in-memory cache — most reads never touch disk." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
