import {
  calculateDistributedLoggingCapacity,
  type DistributedLoggingCapacityAssumptions,
} from "@/lib/distributed-logging-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedLoggingCapacity({
  assumptions,
}: {
  assumptions: DistributedLoggingCapacityAssumptions;
}) {
  const r = calculateDistributedLoggingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily log events", value: fmt(assumptions.dailyLogEvents) },
    { label: "Avg event size", value: `${fmt(assumptions.avgEventBytes)} B` },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Compression", value: `${fmt(assumptions.compressionRatio * 100)}%` },
    { label: "Index fraction", value: `${fmt(assumptions.indexFraction * 100)}%` },
    { label: "Hot retention", value: `${fmt(assumptions.hotRetentionDays)} d` },
    { label: "Cold retention", value: `${fmt(assumptions.coldRetentionDays)} d` },
  ];

  const results: ResultRow[] = [
    { label: "Avg events / sec", value: fmt(r.avgEventsPerSecond), consequence: "A firehose of writes — the most write-heavy system in the curriculum; reads are rare by comparison." },
    { label: "Peak events / sec", value: fmt(r.peakEventsPerSecond), consequence: "Spikes are large, so a durable buffer must absorb them and never backpressure the producing services." },
    { label: "Daily raw volume", value: `${fmt(r.dailyRawTb)} TB`, consequence: "Enormous ingest — the pipeline, not query latency, is the design's center of gravity." },
    { label: "Index size (hot)", value: `${fmt(r.indexStorageTb)} TB`, consequence: "A full index over just the hot window costs more than the compressed logs — so index only hot data, or only labels." },
    { label: "Cold storage (1 yr)", value: `${fmt(r.coldStoragePb, 3)} PB`, consequence: "Even compressed 10×, a year of logs is petabytes — cold data lives in cheap, unindexed object storage." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
