import { describe, it, expect } from "vitest";
import { calculateChatSystemCapacity } from "@/lib/chat-system-estimates";

describe("calculateChatSystemCapacity", () => {
  const result = calculateChatSystemCapacity({
    dailyActiveUsers: 500_000_000,
    messagesPerUserPerDay: 40,
    peakOnlineFraction: 0.2,
    connectionsPerServer: 100_000,
    avgMessageBytes: 200,
    bytesPerConnection: 10_000,
  });

  it("derives messages per second", () => {
    expect(result.messagesPerSec).toBeCloseTo(231481.48, 1);
  });
  it("derives peak concurrent connections", () => {
    expect(result.concurrentConnections).toBe(100_000_000);
  });
  it("derives the gateway server fleet size", () => {
    expect(result.gatewayServersNeeded).toBe(1000);
  });
  it("derives daily message storage in TB", () => {
    expect(result.dailyStorageTb).toBe(4);
  });
  it("derives total connection memory in TB", () => {
    expect(result.connectionMemoryTb).toBe(1);
  });
});
