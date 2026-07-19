import {
  calculatePasswordHashingCapacity,
  type PasswordHashingCapacityAssumptions,
} from "@/lib/password-hashing-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PasswordHashingCapacity({
  assumptions,
}: {
  assumptions: PasswordHashingCapacityAssumptions;
}) {
  const r = calculatePasswordHashingCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Logins / sec", value: fmt(assumptions.loginsPerSec) },
    { label: "Hash cost (tuned)", value: `${fmt(assumptions.hashCostMs)} ms` },
    { label: "Memory / hash (memory-hard)", value: `${fmt(assumptions.hashMemoryMiB)} MiB` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
    { label: "Attacker fast-hash rate (GPU)", value: `${fmt(assumptions.attackerFastHashesPerSec)} /s` },
    { label: "Attacker slow-hash rate (GPU)", value: `${fmt(assumptions.attackerSlowHashesPerSec)} /s` },
  ];

  const results: ResultRow[] = [
    { label: "Hashing cores needed", value: fmt(r.hashCoresNeeded), consequence: "Deliberate slowness makes hashing the dominant login cost — size for peak login rate, and hash only at login, never per request." },
    { label: "Peak concurrent hashes", value: fmt(r.peakConcurrentHashes), consequence: "By Little's law, login rate × hash duration — the hashes in flight at once, which sets both the CPU and the RAM demand." },
    { label: "Peak hash memory", value: `${fmt(r.peakHashMemoryMiB)} MiB`, consequence: "A memory-hard function costs RAM, not just CPU — ~78 GiB here. That RAM appetite is exactly what starves GPUs and ASICs." },
    { label: "Attacker slowdown", value: `${fmt(r.attackerSlowdownFactor)}×`, consequence: "The same GPU that tries 10 billion fast hashes/sec manages only 2,000 memory-hard ones — turning a minutes-long crack of a breached database into geological time." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
