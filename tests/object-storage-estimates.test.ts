import { describe, it, expect } from "vitest";
import { calculateObjectStorageCapacity } from "@/lib/object-storage-estimates";

describe("calculateObjectStorageCapacity", () => {
  const result = calculateObjectStorageCapacity({
    objectsStored: 1_000_000_000_000,
    avgObjectBytes: 1_000_000,
    dataShards: 8,
    parityShards: 4,
    replicationFactor: 3,
  });

  it("derives the logical data volume", () => {
    expect(result.logicalDataPb).toBe(1000);
  });
  it("derives the raw storage with erasure coding", () => {
    expect(result.erasureStoredPb).toBe(1500);
  });
  it("derives the raw storage with replication", () => {
    expect(result.replicationStoredPb).toBe(3000);
  });
  it("derives the storage saved by erasure coding", () => {
    expect(result.storageSavedPb).toBe(1500);
  });
  it("derives the number of fragment failures tolerated", () => {
    expect(result.fragmentFailuresTolerated).toBe(4);
  });
});
