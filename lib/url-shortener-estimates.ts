export interface CapacityAssumptions {
  /** New short links created per month. */
  newLinksPerMonth: number;
  /** Redirect (read) requests per create (write). */
  readWriteRatio: number;
  /** Peak-to-average traffic multiplier. */
  peakMultiplier: number;
  /** Stored bytes per mapping, including indexes and metadata. */
  bytesPerMapping: number;
  /** How long mappings are retained, in years. */
  retentionYears: number;
  /** Share of total mappings kept hot in cache, as a percentage. */
  cacheCoveragePercent: number;
}

export interface CapacityResults {
  averageWriteQps: number;
  averageReadQps: number;
  peakReadQps: number;
  totalMappings: number;
  mappingStorageTB: number;
  cacheWorkingSetGB: number;
}

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting
 * and rounding are the presentation layer's job. Storage uses decimal units
 * (TB = 10^12 bytes, GB = 10^9 bytes), which is how cloud storage is billed.
 */
export function calculateUrlShortenerCapacity(
  a: CapacityAssumptions,
): CapacityResults {
  const averageWriteQps = a.newLinksPerMonth / SECONDS_PER_MONTH;
  const averageReadQps = averageWriteQps * a.readWriteRatio;
  const peakReadQps = averageReadQps * a.peakMultiplier;

  const totalMappings = a.newLinksPerMonth * a.retentionYears * 12;
  const mappingStorageBytes = totalMappings * a.bytesPerMapping;
  const mappingStorageTB = mappingStorageBytes / 1e12;

  const cachedMappings = totalMappings * (a.cacheCoveragePercent / 100);
  const cacheWorkingSetGB = (cachedMappings * a.bytesPerMapping) / 1e9;

  return {
    averageWriteQps,
    averageReadQps,
    peakReadQps,
    totalMappings,
    mappingStorageTB,
    cacheWorkingSetGB,
  };
}
