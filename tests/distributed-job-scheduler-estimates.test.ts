// tests/distributed-job-scheduler-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateDistributedJobSchedulerCapacity } from "@/lib/distributed-job-scheduler-estimates";

describe("calculateDistributedJobSchedulerCapacity", () => {
  const result = calculateDistributedJobSchedulerCapacity({
    scheduledJobs: 100_000_000,
    avgRunsPerJobPerDay: 24,
    peakFactor: 20,
    avgJobDurationSec: 30,
    avgRecordBytes: 1_000,
    historyRetentionDays: 30,
  });

  it("derives total daily executions", () => {
    expect(result.dailyExecutions).toBe(2_400_000_000);
  });
  it("derives average executions per second", () => {
    expect(result.avgExecutionsPerSecond).toBeCloseTo(27777.78, 1);
  });
  it("derives peak (thundering-herd) executions per second", () => {
    expect(result.peakExecutionsPerSecond).toBeCloseTo(555555.56, 1);
  });
  it("derives concurrent in-flight jobs (Little's law)", () => {
    expect(result.concurrentJobs).toBeCloseTo(833333.33, 1);
  });
  it("derives execution-history storage over the retention window in TB", () => {
    expect(result.historyStorageTb).toBe(72);
  });
});
