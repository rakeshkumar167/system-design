const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface DistributedJobSchedulerCapacityAssumptions {
  /** Total scheduled jobs (one-time + recurring). */
  scheduledJobs: number;
  /** Average runs per job per day. */
  avgRunsPerJobPerDay: number;
  /** Peak-to-average multiplier from synchronized (round-time) firing. */
  peakFactor: number;
  /** Average job execution duration, in seconds. */
  avgJobDurationSec: number;
  /** Average serialized size of one execution-history record, in bytes. */
  avgRecordBytes: number;
  /** Days execution history is retained. */
  historyRetentionDays: number;
}

export interface DistributedJobSchedulerCapacityResults {
  dailyExecutions: number;
  avgExecutionsPerSecond: number;
  peakExecutionsPerSecond: number;
  concurrentJobs: number;
  historyStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the average trigger rate is
 * modest, but a thundering herd (jobs scheduled at round times) spikes it ~20×, so the system
 * is sized for the synchronized burst; by Little's law the worker fleet is sized by
 * concurrency (not trigger rate); and execution history — not the tiny job definitions — is
 * the storage driver.
 */
export function calculateDistributedJobSchedulerCapacity(
  a: DistributedJobSchedulerCapacityAssumptions,
): DistributedJobSchedulerCapacityResults {
  const dailyExecutions = a.scheduledJobs * a.avgRunsPerJobPerDay;
  const avgExecutionsPerSecond = dailyExecutions / SECONDS_PER_DAY;
  const peakExecutionsPerSecond = avgExecutionsPerSecond * a.peakFactor;
  const concurrentJobs = avgExecutionsPerSecond * a.avgJobDurationSec;
  const historyStorageTb =
    (dailyExecutions * a.avgRecordBytes * a.historyRetentionDays) / BYTES_PER_TB;

  return {
    dailyExecutions,
    avgExecutionsPerSecond,
    peakExecutionsPerSecond,
    concurrentJobs,
    historyStorageTb,
  };
}
