import { describe, it, expect } from "vitest";
import { calculateNotificationCapacity } from "@/lib/notification-estimates";

describe("calculateNotificationCapacity", () => {
  const result = calculateNotificationCapacity({
    notificationsPerDay: 500_000_000,
    fanoutFactor: 2,
    peakMultiplier: 4,
    retryOverheadPercent: 20,
    avgPayloadBytes: 1000,
  });

  it("derives average accept QPS from daily volume", () => {
    expect(result.averageSendQps).toBeCloseTo(5787.04, 2);
  });
  it("amplifies deliveries by the fan-out factor", () => {
    expect(result.averageDeliveryQps).toBeCloseTo(11574.07, 1);
  });
  it("derives peak delivery QPS", () => {
    expect(result.peakDeliveryQps).toBeCloseTo(46296.3, 1);
  });
  it("adds retry overhead to delivery attempts", () => {
    expect(result.deliveryAttemptsPerSecond).toBeCloseTo(13888.89, 1);
  });
  it("derives total daily deliveries", () => {
    expect(result.dailyDeliveries).toBe(1_000_000_000);
  });
});
