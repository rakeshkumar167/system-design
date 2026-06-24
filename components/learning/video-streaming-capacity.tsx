import {
  calculateVideoStreamingCapacity,
  type VideoStreamingCapacityAssumptions,
} from "@/lib/video-streaming-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function VideoStreamingCapacity({
  assumptions,
}: {
  assumptions: VideoStreamingCapacityAssumptions;
}) {
  const r = calculateVideoStreamingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Uploads / day", value: fmt(assumptions.uploadsPerDay) },
    { label: "Avg video length", value: `${fmt(assumptions.avgVideoMinutes)} min` },
    { label: "Renditions / video", value: fmt(assumptions.renditionCount) },
    { label: "MB / min / rendition", value: fmt(assumptions.mbPerMinutePerRendition) },
    { label: "Peak concurrent streams", value: fmt(assumptions.peakConcurrentStreams) },
    { label: "Avg stream bitrate", value: `${fmt(assumptions.streamBitrateMbps)} Mbps` },
    { label: "CDN hit ratio", value: `${fmt(assumptions.cdnHitRatio * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Daily ingest", value: `${fmt(r.dailyIngestHours)} h`, consequence: "Hours of source video ingested per day — the transcode fleet must keep pace or a backlog forms." },
    { label: "Storage / video", value: `${fmt(r.storagePerVideoGb, 1)} GB`, consequence: "One source becomes a ladder of renditions, so stored bytes multiply by the rendition count." },
    { label: "Daily storage growth", value: `${fmt(r.dailyStorageTb)} TB`, consequence: "Storage grows relentlessly — tier hot vs cold and garbage-collect failed transcodes." },
    { label: "Peak egress", value: `${fmt(r.peakEgressTbps)} Tbps`, consequence: "Delivery bandwidth is impossible from an origin — this is fundamentally a CDN problem." },
    { label: "Origin egress (after CDN)", value: `${fmt(r.originEgressTbps, 2)} Tbps`, consequence: "A 95% cache hit ratio leaves the origin only the miss fraction — hit ratio is the dominant delivery lever." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
