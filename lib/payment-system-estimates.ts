const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;
const BYTES_PER_TB = 1_000_000_000_000;

export interface PaymentSystemCapacityAssumptions {
  /** Payments processed per day. */
  dailyPayments: number;
  /** Average value of a payment, in USD. */
  avgPaymentValueUsd: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Immutable ledger entries written per payment (double-entry + fees). */
  ledgerEntriesPerPayment: number;
  /** Average serialized size of one ledger entry, in bytes. */
  avgEntryBytes: number;
  /** Years the immutable ledger is retained. */
  retentionYears: number;
}

export interface PaymentSystemCapacityResults {
  avgPaymentsPerSecond: number;
  peakPaymentsPerSecond: number;
  dailyVolumeUsd: number;
  ledgerEntriesPerSecond: number;
  ledgerStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a payment system is NOT a
 * high-QPS problem (a few thousand payments/sec at peak) — the weight is that each payment
 * fans into several immutable ledger entries retained for years, and billions of dollars a
 * day flow through, so the design optimizes for correctness, durability, and auditability
 * rather than raw scale.
 */
export function calculatePaymentSystemCapacity(
  a: PaymentSystemCapacityAssumptions,
): PaymentSystemCapacityResults {
  const avgPaymentsPerSecond = a.dailyPayments / SECONDS_PER_DAY;
  const peakPaymentsPerSecond = avgPaymentsPerSecond * a.peakFactor;
  const dailyVolumeUsd = a.dailyPayments * a.avgPaymentValueUsd;
  const ledgerEntriesPerSecond = avgPaymentsPerSecond * a.ledgerEntriesPerPayment;
  const ledgerStorageTb =
    (a.dailyPayments *
      a.ledgerEntriesPerPayment *
      a.avgEntryBytes *
      DAYS_PER_YEAR *
      a.retentionYears) /
    BYTES_PER_TB;

  return {
    avgPaymentsPerSecond,
    peakPaymentsPerSecond,
    dailyVolumeUsd,
    ledgerEntriesPerSecond,
    ledgerStorageTb,
  };
}
