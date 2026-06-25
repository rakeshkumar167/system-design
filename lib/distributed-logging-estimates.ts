const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const TB_PER_PB = 1000;

export interface DistributedLoggingCapacityAssumptions {
  /** Log events ingested per day. */
  dailyLogEvents: number;
  /** Average serialized size of one event, in bytes. */
  avgEventBytes: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Stored size as a fraction of raw after compression (0..1). */
  compressionRatio: number;
  /** Index size as a fraction of raw data indexed (0..1). */
  indexFraction: number;
  /** Days kept in the hot (indexed) tier. */
  hotRetentionDays: number;
  /** Days kept in the cold (archived) tier. */
  coldRetentionDays: number;
}

export interface DistributedLoggingCapacityResults {
  avgEventsPerSecond: number;
  peakEventsPerSecond: number;
  dailyRawTb: number;
  indexStorageTb: number;
  coldStoragePb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a logging platform is the most
 * write-heavy system in the curriculum (millions of events/sec, reads rare), indexing costs
 * more than the logs themselves (so index only hot data), and multi-year retention forces
 * cheap tiered object storage for the cold archive.
 */
export function calculateDistributedLoggingCapacity(
  a: DistributedLoggingCapacityAssumptions,
): DistributedLoggingCapacityResults {
  const avgEventsPerSecond = a.dailyLogEvents / SECONDS_PER_DAY;
  const peakEventsPerSecond = avgEventsPerSecond * a.peakFactor;
  const dailyRawTb = (a.dailyLogEvents * a.avgEventBytes) / BYTES_PER_TB;
  const indexStorageTb = dailyRawTb * a.indexFraction * a.hotRetentionDays;
  const coldStoragePb =
    (dailyRawTb * a.compressionRatio * a.coldRetentionDays) / TB_PER_PB;

  return {
    avgEventsPerSecond,
    peakEventsPerSecond,
    dailyRawTb,
    indexStorageTb,
    coldStoragePb,
  };
}
