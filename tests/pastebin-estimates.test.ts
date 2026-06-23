import { describe, it, expect } from "vitest";
import { calculatePastebinCapacity } from "@/lib/pastebin-estimates";

describe("calculatePastebinCapacity", () => {
  const result = calculatePastebinCapacity({
    newPastesPerMonth: 30_000_000,
    readWriteRatio: 10,
    peakMultiplier: 5,
    avgPasteSizeKb: 10,
    retentionYears: 2,
    metadataBytesPerPaste: 400,
  });

  it("derives average write QPS from monthly volume", () => {
    expect(result.averageWriteQps).toBeCloseTo(11.57, 2);
  });
  it("derives read QPS from the read:write ratio", () => {
    expect(result.averageReadQps).toBeCloseTo(115.74, 1);
  });
  it("derives peak read QPS", () => {
    expect(result.peakReadQps).toBeCloseTo(578.7, 1);
  });
  it("derives the total retained paste count", () => {
    expect(result.totalPastes).toBe(720_000_000);
  });
  it("derives blob (content) storage in TB", () => {
    expect(result.blobStorageTB).toBeCloseTo(7.2, 3);
  });
  it("derives metadata storage in GB", () => {
    expect(result.metadataStorageGB).toBeCloseTo(288, 3);
  });
});
