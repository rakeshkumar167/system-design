import {
  calculateApiSecurityCapacity,
  type ApiSecurityCapacityAssumptions,
} from "@/lib/api-security-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ApiSecurityCapacity({
  assumptions,
}: {
  assumptions: ApiSecurityCapacityAssumptions;
}) {
  const r = calculateApiSecurityCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Requests / sec", value: fmt(assumptions.requestsPerSec) },
    { label: "Abusive / unauthenticated traffic", value: `${fmt(assumptions.abusiveFraction * 100)}%` },
    { label: "Edge check CPU / request", value: `${fmt(assumptions.gatewayCheckCpuMs, 2)} ms` },
    { label: "Backend CPU / request", value: `${fmt(assumptions.backendCpuMs)} ms` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
  ];

  const results: ResultRow[] = [
    { label: "Edge security cores", value: fmt(r.gatewaySecurityCores), consequence: "The security tax: verifying a token and checking a rate limit on every request — cheap relative to serving it." },
    { label: "Backend cores (no filtering)", value: fmt(r.backendCoresWithoutFiltering), consequence: "If the gateway lets everything through, the backend must serve abusive traffic too — the full, expensive fleet." },
    { label: "Backend cores (edge filtering)", value: fmt(r.backendCoresWithFiltering), consequence: "Rejecting abusive traffic at the edge halves the backend — only legitimate requests reach the expensive path." },
    { label: "Net cores saved", value: fmt(r.netCoresSaved), consequence: "Even counting the gateway's own cost, filtering early is a large net win — edge security is also a capacity optimization." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
