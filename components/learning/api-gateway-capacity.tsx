import {
  calculateApiGatewayCapacity,
  type ApiGatewayCapacityAssumptions,
} from "@/lib/api-gateway-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ApiGatewayCapacity({
  assumptions,
}: {
  assumptions: ApiGatewayCapacityAssumptions;
}) {
  const r = calculateApiGatewayCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Requests / day", value: fmt(assumptions.requestsPerDay) },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Gateway overhead", value: `${fmt(assumptions.gatewayOverheadMs)} ms` },
    { label: "Avg backend latency", value: `${fmt(assumptions.avgBackendLatencyMs)} ms` },
    { label: "Instance capacity", value: `${fmt(assumptions.instanceCapacityRps)} RPS` },
    { label: "Auth cache hit rate", value: `${fmt(assumptions.authCacheHitRate * 100)}%` },
    { label: "Auth store latency", value: `${fmt(assumptions.authStoreLatencyMs)} ms` },
  ];

  const results: ResultRow[] = [
    { label: "Avg requests / sec", value: fmt(r.avgRps), consequence: "The gateway sees the sum of all service traffic — it's sized for aggregate load, not one service." },
    { label: "Peak requests / sec", value: fmt(r.peakRps), consequence: "Peak is what you provision for; the gateway must absorb the busiest moment across the whole platform." },
    { label: "Gateway instances (peak)", value: fmt(r.instancesNeeded), consequence: "Because the gateway is stateless, capacity is just peak ÷ per-instance throughput — scale horizontally behind a load balancer." },
    { label: "Latency overhead", value: `${fmt(r.latencyOverheadPct, 2)}%`, consequence: "The gateway is on every request's critical path, so its work must stay a small fraction of total latency — never a tax on the platform." },
    { label: "Effective auth latency", value: `${fmt(r.effectiveAuthLatencyMs, 2)} ms`, consequence: "A 95%-hit local token cache turns a 10 ms introspection into ~0.5 ms average — caching is what keeps edge auth cheap." },
    { label: "Auth-store QPS", value: fmt(r.authStoreQps), consequence: "Caching offloads the central token store ~20×; without it every request would hit it at peak RPS." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
