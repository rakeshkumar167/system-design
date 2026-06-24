import {
  calculateCollaborativeDocEditorCapacity,
  type CollaborativeDocEditorCapacityAssumptions,
} from "@/lib/collaborative-doc-editor-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CollaborativeDocEditorCapacity({
  assumptions,
}: {
  assumptions: CollaborativeDocEditorCapacityAssumptions;
}) {
  const r = calculateCollaborativeDocEditorCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Peak concurrent editors", value: fmt(assumptions.peakConcurrentEditors) },
    { label: "Ops / editor / sec", value: fmt(assumptions.opsPerEditorPerSecond) },
    { label: "Collaborators / doc", value: fmt(assumptions.collaboratorsPerDoc) },
    { label: "Bytes / op", value: fmt(assumptions.bytesPerOp) },
    { label: "Daily edited docs", value: fmt(assumptions.dailyEditedDocs) },
    { label: "Ops / doc / day", value: fmt(assumptions.opsPerDocPerDay) },
  ];

  const results: ResultRow[] = [
    { label: "Peak inbound ops / sec", value: fmt(r.peakInboundOpsPerSecond), consequence: "Every keystroke is an operation — the raw rate the collaboration servers must order and apply." },
    { label: "Peak fan-out msgs / sec", value: fmt(r.peakFanoutMessagesPerSecond), consequence: "Each op is rebroadcast to every other collaborator — fan-out, not bytes, is the dominant real-time load." },
    { label: "Live connections", value: fmt(r.liveConnections), consequence: "Persistent websockets held open at once — connection state, not CPU, is the scaling unit." },
    { label: "Daily operations", value: fmt(r.dailyOps), consequence: "Ten billion tiny ops a day — the append-only op log grows without bound unless compacted." },
    { label: "Daily op-log growth", value: `${fmt(r.dailyOpLogTb)} TB`, consequence: "Small per op but relentless; periodic snapshots plus log compaction keep storage and replay bounded." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
