export interface TicketBookingCapacityAssumptions {
  /** Events going on sale per day. */
  eventsPerDay: number;
  /** Seats per event (the contended inventory). */
  seatsPerEvent: number;
  /** Peak concurrent users at a hot on-sale. */
  peakConcurrentUsers: number;
  /** Seconds over which the on-sale crush arrives. */
  onsaleWindowSeconds: number;
  /** Availability (seat-map) reads per hold attempt. */
  availabilityReadsPerHold: number;
}

export interface TicketBookingCapacityResults {
  dailyInventory: number;
  contentionRatio: number;
  peakHoldAttemptsPerSecond: number;
  peakAvailabilityReadsPerSecond: number;
}

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting and
 * rounding are the presentation layer's job. The point it teaches: the write path is
 * modest in raw QPS but brutally contended (many users per seat), while reads dominate
 * and can be cached.
 */
export function calculateTicketBookingCapacity(
  a: TicketBookingCapacityAssumptions,
): TicketBookingCapacityResults {
  const dailyInventory = a.eventsPerDay * a.seatsPerEvent;
  const contentionRatio = a.peakConcurrentUsers / a.seatsPerEvent;
  const peakHoldAttemptsPerSecond = a.peakConcurrentUsers / a.onsaleWindowSeconds;
  const peakAvailabilityReadsPerSecond =
    peakHoldAttemptsPerSecond * a.availabilityReadsPerHold;

  return {
    dailyInventory,
    contentionRatio,
    peakHoldAttemptsPerSecond,
    peakAvailabilityReadsPerSecond,
  };
}
