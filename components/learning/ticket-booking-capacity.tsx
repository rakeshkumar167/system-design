import {
  calculateTicketBookingCapacity,
  type TicketBookingCapacityAssumptions,
} from "@/lib/ticket-booking-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function TicketBookingCapacity({
  assumptions,
}: {
  assumptions: TicketBookingCapacityAssumptions;
}) {
  const r = calculateTicketBookingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Events / day", value: fmt(assumptions.eventsPerDay) },
    { label: "Seats / event", value: fmt(assumptions.seatsPerEvent) },
    { label: "Peak concurrent users", value: fmt(assumptions.peakConcurrentUsers) },
    { label: "On-sale window", value: `${fmt(assumptions.onsaleWindowSeconds)} s` },
    { label: "Reads / hold", value: fmt(assumptions.availabilityReadsPerHold) },
  ];

  const results: ResultRow[] = [
    { label: "Daily inventory", value: fmt(r.dailyInventory), consequence: "Seats sold per day — a bounded, finite resource, unlike unbounded content systems." },
    { label: "Contention ratio", value: `${fmt(r.contentionRatio)}:1`, consequence: "Users competing per seat. 19 of every 20 hold attempts on a hot seat must be rejected — instantly and correctly." },
    { label: "Peak hold attempts / sec", value: fmt(r.peakHoldAttemptsPerSecond), consequence: "Modest raw QPS, but every attempt contends on a tiny, strongly-consistent inventory — correctness, not throughput, is the challenge." },
    { label: "Peak availability reads / sec", value: fmt(r.peakAvailabilityReadsPerSecond), consequence: "Reads dominate by 20×; the seat-map display is cached and approximate, while the hold is the authoritative write." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
