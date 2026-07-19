import {
  calculateLeaderboardCapacity,
  type LeaderboardCapacityAssumptions,
} from "@/lib/leaderboard-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function LeaderboardCapacity({
  assumptions,
}: {
  assumptions: LeaderboardCapacityAssumptions;
}) {
  const r = calculateLeaderboardCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Players", value: fmt(assumptions.players) },
    { label: "Bytes / entry", value: `${fmt(assumptions.bytesPerEntry)} B` },
    { label: "Score updates / day", value: fmt(assumptions.scoreUpdatesPerDay) },
    { label: "Reads / update", value: fmt(assumptions.readsPerUpdate) },
    { label: "Ops / node / sec", value: fmt(assumptions.opsPerNode) },
  ];

  const results: ResultRow[] = [
    { label: "Score-update QPS", value: `${fmt(r.updateQps)} /s`, consequence: "The write rate: each is an O(log N) ZINCRBY into the sorted set — cheap, but durably recorded to the DB." },
    { label: "Read QPS", value: `${fmt(r.readQps)} /s`, consequence: "Top-K and rank lookups dominate ~10:1 — the system is read-heavy, so the hot top-K is cached." },
    { label: "Total ops QPS", value: `${fmt(r.totalOpsQps)} /s`, consequence: "Every op is O(log N), so the fleet is sized by this throughput, not by data volume." },
    { label: "Ranked set in RAM", value: `${fmt(r.leaderboardMemoryGb)} GB`, consequence: "50M players is tiny — the whole board fits in memory on one node. Storage is never the constraint." },
    { label: "Nodes for throughput", value: fmt(r.nodesForThroughput), consequence: "A small replicated in-memory fleet carries the load; the hard problems are hot boards and cross-shard rank, not storage." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
