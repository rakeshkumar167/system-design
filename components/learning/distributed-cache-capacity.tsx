import {
  calculateDistributedCacheCapacity,
  type DistributedCacheCapacityAssumptions,
} from "@/lib/distributed-cache-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistributedCacheCapacity({
  assumptions,
}: {
  assumptions: DistributedCacheCapacityAssumptions;
}) {
  const r = calculateDistributedCacheCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Total items", value: fmt(assumptions.totalItems) },
    { label: "Avg item size", value: `${fmt(assumptions.avgItemBytes)} B` },
    { label: "Cacheable fraction", value: `${fmt(assumptions.cacheableFraction * 100)}%` },
    { label: "Memory / node", value: `${fmt(assumptions.memoryPerNodeGb)} GB` },
    { label: "Peak reads / sec", value: fmt(assumptions.peakReadsPerSecond) },
    { label: "Hit ratio", value: `${fmt(assumptions.hitRatio * 100)}%` },
  ];

  const results: ResultRow[] = [
    { label: "Total dataset", value: `${fmt(r.totalDatasetTb)} TB`, consequence: "The full keyspace — far larger than any single node, so the cache must be sharded." },
    { label: "Cached working set", value: `${fmt(r.workingSetGb)} GB`, consequence: "Only the hot fraction is kept; the cache is deliberately smaller than the data, so eviction quality decides the hit ratio." },
    { label: "Cache nodes needed", value: fmt(r.nodesNeeded), consequence: "Node count is set by memory to hold the working set — partition the keyspace across them with consistent hashing." },
    { label: "Backing-store reads / sec", value: fmt(r.backingStoreReadsPerSecond), consequence: "After a 95% hit ratio, only the miss fraction reaches the slow store — the cache's entire reason to exist." },
    { label: "Reads / node / sec", value: fmt(r.readsPerNodePerSecond), consequence: "Each node serves over a million reads a second — sub-ms in-memory access and hot-key spreading matter." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
