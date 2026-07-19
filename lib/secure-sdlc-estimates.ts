export interface SecureSdlcCapacityAssumptions {
  /** Security flaws introduced per release. */
  vulnsPerRelease: number;
  /** Cost to fix one flaw caught early (design/implementation), in currency units. */
  costFixInDesign: number;
  /** How much more a flaw costs to fix once it reaches production (multiplier). */
  prodCostMultiplier: number;
  /** Fraction of flaws a Secure SDLC catches before production (0–1). */
  shiftLeftCatchRate: number;
}

export interface SecureSdlcCapacityResults {
  prodCostPerVuln: number;
  baselineCostAllInProd: number;
  shiftLeftTotalCost: number;
  costSaved: number;
}

/**
 * Pure, deterministic capacity model. The lesson: shifting left is not just safer, it's far cheaper.
 * A flaw fixed early costs ~1×; the same flaw found in production (emergency patch, incident, possible
 * breach) costs ~100× more. If a release's 100 flaws were all found in production that's $1,000,000;
 * catching 90% early with a Secure SDLC cuts the total to $109,000 — an ~89% saving. That steep cost
 * curve is the business case for threat modeling and SAST/SCA in the IDE and CI: the earliest phase you
 * can catch a flaw is the cheapest.
 */
export function calculateSecureSdlcCapacity(
  a: SecureSdlcCapacityAssumptions,
): SecureSdlcCapacityResults {
  const prodCostPerVuln = a.costFixInDesign * a.prodCostMultiplier;
  const baselineCostAllInProd = a.vulnsPerRelease * prodCostPerVuln;
  const reachProd = a.vulnsPerRelease - a.vulnsPerRelease * a.shiftLeftCatchRate;
  const caughtEarly = a.vulnsPerRelease - reachProd;
  const shiftLeftTotalCost = caughtEarly * a.costFixInDesign + reachProd * prodCostPerVuln;
  const costSaved = baselineCostAllInProd - shiftLeftTotalCost;

  return {
    prodCostPerVuln,
    baselineCostAllInProd,
    shiftLeftTotalCost,
    costSaved,
  };
}
