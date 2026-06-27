import {
  calculateAuthenticationCapacity,
  type AuthenticationCapacityAssumptions,
} from "@/lib/authentication-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function AuthenticationCapacity({
  assumptions,
}: {
  assumptions: AuthenticationCapacityAssumptions;
}) {
  const r = calculateAuthenticationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Auth requests / user / day", value: fmt(assumptions.authedRequestsPerUserPerDay) },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Session reads / node", value: `${fmt(assumptions.sessionStoreReadsPerNode)} /s` },
  ];

  const results: ResultRow[] = [
    { label: "Avg auth checks / sec", value: `${fmt(r.avgRequestsPerSec)} /s`, consequence: "Every authenticated request must verify identity — this part is unavoidable, whatever the mechanism." },
    { label: "Peak auth checks / sec", value: `${fmt(r.peakRequestsPerSec)} /s`, consequence: "The hot-path load the verification mechanism must absorb at peak." },
    { label: "Stateful session reads / sec", value: `${fmt(r.statefulSessionReadsPerSec)} /s`, consequence: "Stateful sessions hit a central session store on EVERY request — a network read on the hot path." },
    { label: "Session-store nodes", value: fmt(r.statefulSessionStoreNodes), consequence: "The session store becomes a sized, replicated, must-stay-available dependency in front of every request." },
    { label: "Stateless verify reads / sec", value: fmt(r.statelessVerifyReadsPerSec), consequence: "Stateless JWT verification is local CPU (a signature check) — the per-request central lookup disappears. This is why tokens scale." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
