import {
  calculateSecureSdlcCapacity,
  type SecureSdlcCapacityAssumptions,
} from "@/lib/secure-sdlc-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function SecureSdlcCapacity({
  assumptions,
}: {
  assumptions: SecureSdlcCapacityAssumptions;
}) {
  const r = calculateSecureSdlcCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Flaws / release", value: fmt(assumptions.vulnsPerRelease) },
    { label: "Cost to fix early", value: `$${fmt(assumptions.costFixInDesign)}` },
    { label: "Production cost multiplier", value: `${fmt(assumptions.prodCostMultiplier)}×` },
    { label: "Caught early (Secure SDLC)", value: `${fmt(assumptions.shiftLeftCatchRate * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Cost per flaw in production", value: `$${fmt(r.prodCostPerVuln)}`, consequence: "A flaw found in production — emergency patch, incident, possible breach — costs ~100× one caught on the whiteboard." },
    { label: "Cost if all found in prod", value: `$${fmt(r.baselineCostAllInProd)}`, consequence: "The 'test at the end' worst case: every flaw surfaces where it's most expensive to fix." },
    { label: "Cost with 90% shift-left", value: `$${fmt(r.shiftLeftTotalCost)}`, consequence: "Catching most flaws early — threat modeling, SAST/SCA in CI — collapses the total." },
    { label: "Cost saved", value: `$${fmt(r.costSaved)}`, consequence: "An ~89% saving. Shift-left is not just safer, it's dramatically cheaper — the business case for the whole Secure SDLC." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
