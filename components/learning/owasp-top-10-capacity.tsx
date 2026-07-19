import {
  calculateOwaspRiskCapacity,
  type OwaspRiskCapacityAssumptions,
} from "@/lib/owasp-top-10-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function OwaspRiskCapacity({
  assumptions,
}: {
  assumptions: OwaspRiskCapacityAssumptions;
}) {
  const r = calculateOwaspRiskCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Attack attempts / day", value: fmt(assumptions.attackAttemptsPerDay) },
    { label: "Blocked per control layer", value: `${fmt(assumptions.blockRatePerLayer * 100)}%` },
    { label: "Independent control layers", value: fmt(assumptions.layers) },
  ];

  const results: ResultRow[] = [
    { label: "Breaches / day (1 control)", value: `${fmt(r.singleControlBreaches)} /day`, consequence: "Even a strong 90%-effective control leaves a huge residual — no single defense is enough." },
    { label: "Breaches / day (3 layers)", value: `${fmt(r.layeredBreaches)} /day`, consequence: "Three independent 90% layers let only 0.1% through — the controls multiply because each catches what the last missed." },
    { label: "Defense-in-depth factor", value: `${fmt(r.defenseInDepthFactor)}×`, consequence: "Three layers are 100× better than one. This is why Top 10 defenses stack rather than compete." },
    { label: "Overall reduction", value: `${fmt(r.overallReductionFactor)}×`, consequence: "1,000× fewer breaches than an unprotected app — but the 1,000/day that remain are why logging & monitoring (A09) is itself a Top 10 item." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
