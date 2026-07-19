import {
  calculateMetricsCapacity,
  type MetricsCapacityAssumptions,
} from "@/lib/metrics-monitoring-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function MetricsCapacity({
  assumptions,
}: {
  assumptions: MetricsCapacityAssumptions;
}) {
  const r = calculateMetricsCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Monitored targets", value: fmt(assumptions.monitoredTargets) },
    { label: "Series / target", value: fmt(assumptions.seriesPerTarget) },
    { label: "Scrape interval", value: `${fmt(assumptions.scrapeIntervalSec)} s` },
    { label: "Raw bytes / sample", value: `${fmt(assumptions.rawBytesPerSample)} B` },
    { label: "Compressed bytes / sample", value: `${fmt(assumptions.compressedBytesPerSample)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Active time series", value: fmt(r.activeSeries), consequence: "The cardinality — distinct label sets — that bounds index and head-block memory. High-cardinality labels explode this." },
    { label: "Ingest rate", value: `${fmt(r.ingestSamplesPerSec)} /s`, consequence: "The write firehose: every series, every scrape interval. Ingestion must sustain this without ever backpressuring producers." },
    { label: "Raw storage / day", value: `${fmt(r.rawStoragePerDayTb, 3)} TB`, consequence: "What the firehose would cost uncompressed — untenable to keep at scale." },
    { label: "Compressed storage / day", value: `${fmt(r.compressedStoragePerDayTb, 3)} TB`, consequence: "After delta-of-delta timestamps + XOR values — regular, slow-changing points compress hard." },
    { label: "Compression ratio", value: `${fmt(r.compressionRatio)}×`, consequence: "The lever that makes a metrics store affordable; downsampling + retention then bound the long tail." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
