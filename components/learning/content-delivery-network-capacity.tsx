import {
  calculateCdnCapacity,
  type CdnCapacityAssumptions,
} from "@/lib/content-delivery-network-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CdnCapacity({
  assumptions,
}: {
  assumptions: CdnCapacityAssumptions;
}) {
  const r = calculateCdnCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily requests", value: fmt(assumptions.dailyRequests) },
    { label: "Cache-hit ratio", value: `${assumptions.cacheHitPercent}%` },
    { label: "Improved hit ratio", value: `${assumptions.improvedHitPercent}%` },
    { label: "Avg object size", value: `${fmt(assumptions.avgObjectBytes)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Edge requests / sec", value: `${fmt(r.edgeRequestsPerSec)} /s`, consequence: "The full firehose the edge fleet absorbs." },
    { label: "Origin requests / sec", value: `${fmt(r.originRequestsPerSec)} /s`, consequence: "At a 95% hit ratio only the 5% of misses reach the origin." },
    { label: "Origin offload", value: `${fmt(r.offloadFactor)}×`, consequence: "A 95% hit ratio means the origin sees 1/20th of the traffic — the whole point of a CDN." },
    { label: "Origin req/s at 99% hit", value: `${fmt(r.originRequestsAtImprovedHitRatio)} /s`, consequence: "Raising the hit ratio 95%→99% cuts origin load another 5×: origin traffic scales with the *miss* ratio, so the last few percent matter most." },
    { label: "Edge egress", value: `${fmt(r.edgeEgressGbPerSec)} GB/s`, consequence: "Bandwidth served from the edge, close to users." },
    { label: "Origin egress", value: `${fmt(r.originEgressGbPerSec)} GB/s`, consequence: "Bandwidth the origin must supply — 20× less than the edge serves." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
