export interface PastebinCapacityAssumptions {
  /** New pastes created per month. */
  newPastesPerMonth: number;
  /** Read requests per create (write). */
  readWriteRatio: number;
  /** Peak-to-average traffic multiplier. */
  peakMultiplier: number;
  /** Average paste content size, in KB (decimal: 1 KB = 1000 bytes). */
  avgPasteSizeKb: number;
  /** Effective retention horizon for stored (unexpired) pastes, in years. */
  retentionYears: number;
  /** Metadata bytes per paste (row + indexes), excluding the blob. */
  metadataBytesPerPaste: number;
}

export interface PastebinCapacityResults {
  averageWriteQps: number;
  averageReadQps: number;
  peakReadQps: number;
  totalPastes: number;
  blobStorageTB: number;
  metadataStorageGB: number;
}

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. Storage uses decimal units
 * (TB = 10^12 bytes, GB = 10^9 bytes, KB = 10^3 bytes), as cloud storage is billed.
 */
export function calculatePastebinCapacity(
  a: PastebinCapacityAssumptions,
): PastebinCapacityResults {
  const averageWriteQps = a.newPastesPerMonth / SECONDS_PER_MONTH;
  const averageReadQps = averageWriteQps * a.readWriteRatio;
  const peakReadQps = averageReadQps * a.peakMultiplier;

  const totalPastes = a.newPastesPerMonth * a.retentionYears * 12;
  const blobStorageTB = (totalPastes * a.avgPasteSizeKb * 1e3) / 1e12;
  const metadataStorageGB = (totalPastes * a.metadataBytesPerPaste) / 1e9;

  return {
    averageWriteQps,
    averageReadQps,
    peakReadQps,
    totalPastes,
    blobStorageTB,
    metadataStorageGB,
  };
}
