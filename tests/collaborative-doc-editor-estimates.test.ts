import { describe, it, expect } from "vitest";
import { calculateCollaborativeDocEditorCapacity } from "@/lib/collaborative-doc-editor-estimates";

describe("calculateCollaborativeDocEditorCapacity", () => {
  const result = calculateCollaborativeDocEditorCapacity({
    peakConcurrentEditors: 2_000_000,
    opsPerEditorPerSecond: 2,
    collaboratorsPerDoc: 4,
    bytesPerOp: 100,
    dailyEditedDocs: 5_000_000,
    opsPerDocPerDay: 2_000,
  });

  it("derives peak inbound operations per second", () => {
    expect(result.peakInboundOpsPerSecond).toBe(4_000_000);
  });
  it("derives peak fan-out broadcast messages per second", () => {
    expect(result.peakFanoutMessagesPerSecond).toBe(12_000_000);
  });
  it("derives live persistent websocket connections", () => {
    expect(result.liveConnections).toBe(2_000_000);
  });
  it("derives daily operation volume", () => {
    expect(result.dailyOps).toBe(10_000_000_000);
  });
  it("derives daily op-log storage growth in TB", () => {
    expect(result.dailyOpLogTb).toBe(1);
  });
});
