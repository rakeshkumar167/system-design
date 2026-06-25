import {
  calculateDistributedJobSchedulerCapacity,
  type DistributedJobSchedulerCapacityAssumptions,
} from "@/lib/distributed-job-scheduler-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedJobSchedulerCapacity({
  assumptions,
}: {
  assumptions: DistributedJobSchedulerCapacityAssumptions;
}) {
  const r = calculateDistributedJobSchedulerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Scheduled jobs", value: fmt(assumptions.scheduledJobs) },
    { label: "Runs / job / day", value: fmt(assumptions.avgRunsPerJobPerDay) },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Avg job duration", value: `${fmt(assumptions.avgJobDurationSec)} s` },
    { label: "Avg record size", value: `${fmt(assumptions.avgRecordBytes)} B` },
    { label: "History retention", value: `${fmt(assumptions.historyRetentionDays)} d` },
  ];

  const results: ResultRow[] = [
    { label: "Daily executions", value: fmt(r.dailyExecutions), consequence: "Billions of runs a day — but the rate, not the count, is what stresses the system." },
    { label: "Avg executions / sec", value: fmt(r.avgExecutionsPerSecond), consequence: "The steady-state trigger rate is modest — a single scheduler tier can find this many due jobs." },
    { label: "Peak executions / sec", value: fmt(r.peakExecutionsPerSecond), consequence: "Jobs cluster at round times (midnight, top of hour), so peak is ~20× the average — a thundering herd to shard and smear." },
    { label: "Concurrent jobs", value: fmt(r.concurrentJobs), consequence: "By Little's law (rate × duration), this many jobs run at once — the worker fleet is sized by concurrency, not trigger rate." },
    { label: "History storage (30 d)", value: `${fmt(r.historyStorageTb)} TB`, consequence: "Job definitions are tiny; the immutable record of every run is the storage driver — retained, then expired." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
