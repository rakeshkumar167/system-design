import {
  calculateSessionCapacity,
  type SessionCapacityAssumptions,
} from "@/lib/session-management-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function SessionCapacity({
  assumptions,
}: {
  assumptions: SessionCapacityAssumptions;
}) {
  const r = calculateSessionCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Authenticated requests / sec", value: fmt(assumptions.requestsPerSec) },
    { label: "Active sessions", value: fmt(assumptions.activeSessions) },
    { label: "State per session", value: `${fmt(assumptions.sessionBytes)} B` },
    { label: "Session cache hit rate", value: `${fmt(assumptions.cacheHitRate * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Store lookups / sec (no cache)", value: `${fmt(r.storeLookupsWithoutCache)} /s`, consequence: "Stateful sessions need a store lookup on every authenticated request — the store's load equals the request rate." },
    { label: "Store lookups / sec (cache)", value: `${fmt(r.storeLookupsWithCache)} /s`, consequence: "A short-TTL session cache absorbs the repeats, so only misses reach the store." },
    { label: "Lookup reduction", value: `${fmt(r.lookupReductionFactor)}×`, consequence: "Caching is what keeps the session store from becoming the bottleneck on the hot path." },
    { label: "Session store memory", value: `${fmt(r.sessionStoreMemoryGb)} GB`, consequence: "Every active session must be held in memory. Stateless sessions avoid both this and the lookup — but can't be revoked before expiry." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
