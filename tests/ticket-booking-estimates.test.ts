import { describe, it, expect } from "vitest";
import { calculateTicketBookingCapacity } from "@/lib/ticket-booking-estimates";

describe("calculateTicketBookingCapacity", () => {
  const result = calculateTicketBookingCapacity({
    eventsPerDay: 1000,
    seatsPerEvent: 50_000,
    peakConcurrentUsers: 1_000_000,
    onsaleWindowSeconds: 60,
    availabilityReadsPerHold: 20,
  });

  it("derives the daily seat inventory", () => {
    expect(result.dailyInventory).toBe(50_000_000);
  });
  it("derives the contention ratio (users per seat)", () => {
    expect(result.contentionRatio).toBe(20);
  });
  it("derives peak hold attempts per second across the on-sale window", () => {
    expect(result.peakHoldAttemptsPerSecond).toBeCloseTo(16666.67, 2);
  });
  it("derives peak availability reads per second", () => {
    expect(result.peakAvailabilityReadsPerSecond).toBeCloseTo(333333.33, 1);
  });
});
