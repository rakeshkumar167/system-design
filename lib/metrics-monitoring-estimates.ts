const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface MetricsCapacityAssumptions {
  /** Number of monitored targets (hosts, containers, services). */
  monitoredTargets: number;
  /** Active time series exposed per target. */
  seriesPerTarget: number;
  /** Scrape/collection interval in seconds. */
  scrapeIntervalSec: number;
  /** Uncompressed bytes per sample (timestamp + value). */
  rawBytesPerSample: number;
  /** Bytes per sample after time-series compression. */
  compressedBytesPerSample: number;
}

export interface MetricsCapacityResults {
  activeSeries: number;
  ingestSamplesPerSec: number;
  rawStoragePerDayTb: number;
  compressedStoragePerDayTb: number;
  compressionRatio: number;
}

/**
 * Pure, deterministic capacity model. The lesson: monitoring is a write-firehose problem. 200M active
 * series scraped every 10s is 20M samples/sec, which raw would be ~27.6 TB/day; time-series compression
 * (delta-of-delta timestamps + XOR float values, Gorilla-style) shrinks each sample from 16 to ~2 bytes
 * (8×) to ~3.5 TB/day, and downsampling/retention bound the long tail. Reads (dashboards, alert
 * evaluation) are comparatively modest recent-range scans, so the system is sized by ingest throughput
 * and storage — and its memory is bounded by cardinality, not sample volume — not by query latency.
 */
export function calculateMetricsCapacity(
  a: MetricsCapacityAssumptions,
): MetricsCapacityResults {
  const activeSeries = a.monitoredTargets * a.seriesPerTarget;
  const ingestSamplesPerSec = activeSeries / a.scrapeIntervalSec;
  const rawStoragePerDayTb =
    (ingestSamplesPerSec * a.rawBytesPerSample * SECONDS_PER_DAY) / BYTES_PER_TB;
  const compressedStoragePerDayTb =
    (ingestSamplesPerSec * a.compressedBytesPerSample * SECONDS_PER_DAY) / BYTES_PER_TB;
  const compressionRatio = a.rawBytesPerSample / a.compressedBytesPerSample;

  return {
    activeSeries,
    ingestSamplesPerSec,
    rawStoragePerDayTb,
    compressedStoragePerDayTb,
    compressionRatio,
  };
}
