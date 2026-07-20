import {
  calculatePhotoSharingCapacity,
  type PhotoSharingCapacityAssumptions,
} from "@/lib/photo-sharing-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PhotoSharingCapacity({
  assumptions,
}: {
  assumptions: PhotoSharingCapacityAssumptions;
}) {
  const r = calculatePhotoSharingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Uploads / day", value: fmt(assumptions.uploadsPerDay) },
    { label: "Derivatives / photo", value: fmt(assumptions.derivativesPerPhoto) },
    { label: "Original size", value: `${fmt(assumptions.originalBytes)} B` },
    { label: "Derivative size", value: `${fmt(assumptions.derivativeBytes)} B` },
    { label: "Views / upload", value: fmt(assumptions.viewsPerUpload) },
    { label: "CDN hit rate", value: `${fmt(assumptions.cdnHitRate * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Upload rate", value: `${fmt(r.uploadsPerSec)} /s`, consequence: "The write rate — modest, but each upload fans into an original plus several derivatives via the async pipeline." },
    { label: "New storage / day", value: `${fmt(r.dailyStorageTb)} TB`, consequence: "Write amplification: original + 5 derivatives ≈ 6 MB per photo. A durable object store is mandatory." },
    { label: "Image view QPS", value: `${fmt(r.viewQps)} /s`, consequence: "Reads dominate ~100:1 — this is a read-heavy delivery problem, not a write problem." },
    { label: "Origin QPS (after CDN)", value: `${fmt(r.originQps)} /s`, consequence: "A 98%-hit CDN means the object store sees a tiny fraction of reads; the app tier barely touches image bytes." },
    { label: "CDN offload factor", value: `${fmt(r.cdnOffloadFactor)}×`, consequence: "The CDN is what makes global read-dominated image serving affordable — 50× fewer requests reach the origin." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
