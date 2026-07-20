import { describe, it, expect } from "vitest";
import { calculatePhotoSharingCapacity } from "@/lib/photo-sharing-estimates";

describe("calculatePhotoSharingCapacity", () => {
  const result = calculatePhotoSharingCapacity({
    uploadsPerDay: 100_000_000,
    derivativesPerPhoto: 5,
    originalBytes: 4_000_000,
    derivativeBytes: 400_000,
    viewsPerUpload: 100,
    cdnHitRate: 0.98,
  });

  it("derives the upload rate", () => {
    expect(result.uploadsPerSec).toBeCloseTo(1157.41, 1);
  });
  it("derives daily new storage (original + derivatives)", () => {
    expect(result.dailyStorageTb).toBe(600);
  });
  it("derives the image view QPS (read-dominated)", () => {
    expect(result.viewQps).toBeCloseTo(115_740.74, 1);
  });
  it("derives the origin QPS after CDN offload", () => {
    expect(result.originQps).toBeCloseTo(2_314.81, 1);
  });
  it("derives the CDN offload factor", () => {
    expect(result.cdnOffloadFactor).toBeCloseTo(50, 5);
  });
});
