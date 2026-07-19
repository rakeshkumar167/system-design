export interface OwaspRiskCapacityAssumptions {
  /** Automated attack attempts hitting the application per day. */
  attackAttemptsPerDay: number;
  /** Fraction of attacks a single independent control blocks (0–1). */
  blockRatePerLayer: number;
  /** Number of independent, layered controls (defense in depth). */
  layers: number;
}

export interface OwaspRiskCapacityResults {
  singleControlBreaches: number;
  layeredBreaches: number;
  defenseInDepthFactor: number;
  overallReductionFactor: number;
}

/**
 * Pure, deterministic model. The lesson: no single control is perfect, but independent controls
 * multiply. If each layer blocks 90% of attacks, one control still lets 10% through; three
 * independent layers let only 0.1% through. Against a million attacks a day that's 100,000 vs 1,000
 * — a 100× improvement over one control and a 1,000× reduction over none. Security is multiplicative
 * layering, not a silver bullet; the residual that still gets through is why logging & monitoring
 * (A09) is itself a Top 10 item. Breach counts are rounded (discrete attacks; removes 0.1**3 float
 * noise).
 */
export function calculateOwaspRiskCapacity(
  a: OwaspRiskCapacityAssumptions,
): OwaspRiskCapacityResults {
  const letThrough = 1 - a.blockRatePerLayer;
  const singleControlBreaches = Math.round(a.attackAttemptsPerDay * letThrough);
  const layeredBreaches = Math.round(a.attackAttemptsPerDay * letThrough ** a.layers);
  const defenseInDepthFactor = Math.round(singleControlBreaches / layeredBreaches);
  const overallReductionFactor = Math.round(a.attackAttemptsPerDay / layeredBreaches);

  return {
    singleControlBreaches,
    layeredBreaches,
    defenseInDepthFactor,
    overallReductionFactor,
  };
}
