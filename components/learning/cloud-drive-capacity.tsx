import {
  calculateCloudDriveCapacity,
  type CloudDriveCapacityAssumptions,
} from "@/lib/cloud-drive-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CloudDriveCapacity({
  assumptions,
}: {
  assumptions: CloudDriveCapacityAssumptions;
}) {
  const r = calculateCloudDriveCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Total users", value: fmt(assumptions.totalUsers) },
    { label: "Storage / user", value: `${fmt(assumptions.avgStorageGbPerUser)} GB` },
    { label: "Dedup ratio", value: `${fmt(assumptions.dedupRatio * 100)}%` },
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Edits / active user / day", value: fmt(assumptions.avgDailyEditsPerActiveUser) },
    { label: "Avg edited file", value: `${fmt(assumptions.avgEditBytes / 1_000_000)} MB` },
    { label: "Delta-sync fraction", value: `${fmt(assumptions.deltaSyncFraction * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Raw stored data", value: `${fmt(r.rawStorageEb, 1)} EB`, consequence: "Exabyte scale — content must live in object storage, never a database." },
    { label: "After deduplication", value: `${fmt(r.physicalStorageEb, 1)} EB`, consequence: "Storing each unique block once removes a large slice of the bill — dedup is load-bearing, not an optimization." },
    { label: "Metadata writes / sec", value: fmt(r.metadataWritesPerSecond), consequence: "Metadata is tiny in bytes but high-QPS — it needs a separate, sharded, transactional store, split from the blocks." },
    { label: "Naive upload bandwidth", value: `${fmt(r.naiveUploadGbPerSecond)} GB/s`, consequence: "If every edit re-sent the whole file, ingress bandwidth would be enormous." },
    { label: "Delta-sync bandwidth", value: `${fmt(r.deltaUploadGbPerSecond)} GB/s`, consequence: "Sending only changed chunks cuts upload bandwidth ~10× — the reason chunking + delta sync exist." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
