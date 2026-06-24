const MINUTES_PER_HOUR = 60;
const MB_PER_TB = 1_000_000;
const MBPS_PER_TBPS = 1_000_000;

export interface VideoStreamingCapacityAssumptions {
  /** Videos uploaded per day. */
  uploadsPerDay: number;
  /** Average source video length in minutes. */
  avgVideoMinutes: number;
  /** Number of renditions in the bitrate/resolution ladder. */
  renditionCount: number;
  /** Stored MB per minute of one rendition (averaged across the ladder). */
  mbPerMinutePerRendition: number;
  /** Peak concurrent viewers streaming at once. */
  peakConcurrentStreams: number;
  /** Average delivered bitrate per stream, in Mbps. */
  streamBitrateMbps: number;
  /** Fraction of delivery bytes served from CDN cache (0..1). */
  cdnHitRatio: number;
}

export interface VideoStreamingCapacityResults {
  dailyIngestHours: number;
  storagePerVideoGb: number;
  dailyStorageTb: number;
  peakEgressTbps: number;
  originEgressTbps: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: storage explodes
 * because one source becomes a ladder of renditions, and delivery is a CDN/bandwidth
 * problem — peak egress is impossible from an origin, so the cache hit ratio is the
 * dominant lever (origin sees only the miss fraction).
 */
export function calculateVideoStreamingCapacity(
  a: VideoStreamingCapacityAssumptions,
): VideoStreamingCapacityResults {
  const dailyIngestHours = (a.uploadsPerDay * a.avgVideoMinutes) / MINUTES_PER_HOUR;

  const storagePerVideoMb =
    a.avgVideoMinutes * a.renditionCount * a.mbPerMinutePerRendition;
  const storagePerVideoGb = storagePerVideoMb / 1000;
  const dailyStorageTb = (a.uploadsPerDay * storagePerVideoMb) / MB_PER_TB;

  const peakEgressTbps =
    (a.peakConcurrentStreams * a.streamBitrateMbps) / MBPS_PER_TBPS;
  const originEgressTbps = peakEgressTbps * (1 - a.cdnHitRatio);

  return {
    dailyIngestHours,
    storagePerVideoGb,
    dailyStorageTb,
    peakEgressTbps,
    originEgressTbps,
  };
}
