import {
  calculateRideHailingCapacity,
  type RideHailingCapacityAssumptions,
} from "@/lib/ride-hailing-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function RideHailingCapacity({
  assumptions,
}: {
  assumptions: RideHailingCapacityAssumptions;
}) {
  const r = calculateRideHailingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Active drivers", value: fmt(assumptions.activeDrivers) },
    { label: "Ping interval", value: `${fmt(assumptions.pingIntervalSec)} s` },
    { label: "Bytes / location update", value: `${fmt(assumptions.locationBytes)} B` },
    { label: "Rides / day", value: fmt(assumptions.ridesPerDay) },
    { label: "Candidates / match", value: fmt(assumptions.candidatesPerMatch) },
  ];

  const results: ResultRow[] = [
    { label: "Location updates / sec", value: `${fmt(r.locationUpdatesPerSec)} /s`, consequence: "The firehose: every driver, every few seconds. Kept in memory as latest-position-only, never durably persisted per ping." },
    { label: "Location write bandwidth", value: `${fmt(r.locationWriteMbPerSec)} MB/s`, consequence: "A continuous write stream the geo-index must absorb — the dominant load in the system." },
    { label: "Ride requests / sec", value: `${fmt(r.ridesPerSec, 1)} /s`, consequence: "The actual matching work — tiny next to the location writes." },
    { label: "Writes ÷ requests", value: `${fmt(r.writeToRequestRatio)}×`, consequence: "Location updates dwarf ride requests ~2160×, which is why driver location is ephemeral in-memory state, not a database." },
    { label: "Candidate evals / sec", value: `${fmt(r.candidateEvaluationsPerSec, 0)} /s`, consequence: "Matching = a geo query plus ranking ~10 candidates per request — cheap compute against the live index." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
