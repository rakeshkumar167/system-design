import {
  calculatePastebinCapacity,
  type PastebinCapacityAssumptions,
} from "@/lib/pastebin-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PastebinCapacity({
  assumptions,
}: {
  assumptions: PastebinCapacityAssumptions;
}) {
  const r = calculatePastebinCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New pastes / month", value: fmt(assumptions.newPastesPerMonth) },
    { label: "Read : write ratio", value: `${fmt(assumptions.readWriteRatio)}:1` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Avg paste size", value: `${fmt(assumptions.avgPasteSizeKb)} KB` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
    { label: "Bytes / metadata row", value: `${fmt(assumptions.metadataBytesPerPaste)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Average write QPS", value: fmt(r.averageWriteQps), consequence: "Writes are light — a single partitioned database absorbs ingest comfortably." },
    { label: "Average read QPS", value: fmt(r.averageReadQps), consequence: "Reads dominate writes 10×; the read path is what we cache and scale." },
    { label: "Peak read QPS", value: fmt(r.peakReadQps), consequence: "Provision for peak. A CDN serves most of this so the origin sees a fraction." },
    { label: "Total stored pastes", value: fmt(r.totalPastes), consequence: "Hundreds of millions of objects — too many for one node, so metadata partitions." },
    { label: "Content (blob) storage", value: `${fmt(r.blobStorageTB, 1)} TB`, consequence: "Content dominates by ~25× even at 10 KB; it belongs in object storage, not the DB." },
    { label: "Metadata storage", value: `${fmt(r.metadataStorageGB)} GB`, consequence: "Tiny beside the blobs; pointers + attributes fit in a partitioned database." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
