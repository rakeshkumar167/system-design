import { describe, it, expect } from "vitest";
import { calculateVideoStreamingCapacity } from "@/lib/video-streaming-estimates";

describe("calculateVideoStreamingCapacity", () => {
  const result = calculateVideoStreamingCapacity({
    uploadsPerDay: 500_000,
    avgVideoMinutes: 10,
    renditionCount: 5,
    mbPerMinutePerRendition: 12,
    peakConcurrentStreams: 5_000_000,
    streamBitrateMbps: 5,
    cdnHitRatio: 0.95,
  });

  it("derives the daily ingest hours of source video", () => {
    expect(result.dailyIngestHours).toBeCloseTo(83333.33, 2);
  });
  it("derives storage per video across the rendition ladder", () => {
    expect(result.storagePerVideoGb).toBeCloseTo(0.6, 5);
  });
  it("derives daily storage growth in TB", () => {
    expect(result.dailyStorageTb).toBe(300);
  });
  it("derives peak delivery egress in Tbps", () => {
    expect(result.peakEgressTbps).toBe(25);
  });
  it("derives origin egress after CDN offload", () => {
    expect(result.originEgressTbps).toBeCloseTo(1.25, 2);
  });
});
