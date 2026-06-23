export interface NotificationCapacityAssumptions {
  /** Logical notifications accepted per day. */
  notificationsPerDay: number;
  /** Average channels per notification (the fan-out amplification). */
  fanoutFactor: number;
  /** Peak-to-average traffic multiplier. */
  peakMultiplier: number;
  /** Extra delivery attempts from retries, as a percent (20 = +20%). */
  retryOverheadPercent: number;
  /** Average rendered payload size per delivery, in bytes. */
  avgPayloadBytes: number;
}

export interface NotificationCapacityResults {
  averageSendQps: number;
  averageDeliveryQps: number;
  peakDeliveryQps: number;
  deliveryAttemptsPerSecond: number;
  dailyDeliveries: number;
}

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. The point it teaches: fan-out and
 * retries amplify load downstream, so the delivery tier — not ingestion — is sized.
 */
export function calculateNotificationCapacity(
  a: NotificationCapacityAssumptions,
): NotificationCapacityResults {
  const averageSendQps = a.notificationsPerDay / SECONDS_PER_DAY;
  const averageDeliveryQps = averageSendQps * a.fanoutFactor;
  const peakDeliveryQps = averageDeliveryQps * a.peakMultiplier;
  const deliveryAttemptsPerSecond =
    averageDeliveryQps * (1 + a.retryOverheadPercent / 100);
  const dailyDeliveries = a.notificationsPerDay * a.fanoutFactor;

  return {
    averageSendQps,
    averageDeliveryQps,
    peakDeliveryQps,
    deliveryAttemptsPerSecond,
    dailyDeliveries,
  };
}
