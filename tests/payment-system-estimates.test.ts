// tests/payment-system-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculatePaymentSystemCapacity } from "@/lib/payment-system-estimates";

describe("calculatePaymentSystemCapacity", () => {
  const result = calculatePaymentSystemCapacity({
    dailyPayments: 100_000_000,
    avgPaymentValueUsd: 50,
    peakFactor: 5,
    ledgerEntriesPerPayment: 4,
    avgEntryBytes: 500,
    retentionYears: 7,
  });

  it("derives average payments per second", () => {
    expect(result.avgPaymentsPerSecond).toBeCloseTo(1157.41, 1);
  });
  it("derives peak payments per second", () => {
    expect(result.peakPaymentsPerSecond).toBeCloseTo(5787.04, 1);
  });
  it("derives daily money volume in USD", () => {
    expect(result.dailyVolumeUsd).toBe(5_000_000_000);
  });
  it("derives ledger entries per second", () => {
    expect(result.ledgerEntriesPerSecond).toBeCloseTo(4629.63, 1);
  });
  it("derives ledger storage over the retention window in TB", () => {
    expect(result.ledgerStorageTb).toBeCloseTo(511, 5);
  });
});
