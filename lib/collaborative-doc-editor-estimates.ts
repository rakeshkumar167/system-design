const BYTES_PER_TB = 1_000_000_000_000;

export interface CollaborativeDocEditorCapacityAssumptions {
  /** Peak editors connected and editing simultaneously (≈ live websocket connections). */
  peakConcurrentEditors: number;
  /** Operations (keystrokes/edits) per active editor per second. */
  opsPerEditorPerSecond: number;
  /** Editors sharing one document session (the fan-out target). */
  collaboratorsPerDoc: number;
  /** Serialized size of one operation, in bytes. */
  bytesPerOp: number;
  /** Documents edited per day. */
  dailyEditedDocs: number;
  /** Average operations applied to an active document per day. */
  opsPerDocPerDay: number;
}

export interface CollaborativeDocEditorCapacityResults {
  peakInboundOpsPerSecond: number;
  peakFanoutMessagesPerSecond: number;
  liveConnections: number;
  dailyOps: number;
  dailyOpLogTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a collaborative editor's
 * load is fan-out and connection state, not bandwidth. Operations are tiny, but each is
 * rebroadcast to every collaborator and the system holds millions of persistent
 * websockets — so messages and connections are the scaling unit, and the op log grows
 * relentlessly, demanding snapshots and compaction.
 */
export function calculateCollaborativeDocEditorCapacity(
  a: CollaborativeDocEditorCapacityAssumptions,
): CollaborativeDocEditorCapacityResults {
  const peakInboundOpsPerSecond = a.peakConcurrentEditors * a.opsPerEditorPerSecond;
  const peakFanoutMessagesPerSecond =
    peakInboundOpsPerSecond * (a.collaboratorsPerDoc - 1);
  const liveConnections = a.peakConcurrentEditors;
  const dailyOps = a.dailyEditedDocs * a.opsPerDocPerDay;
  const dailyOpLogTb = (dailyOps * a.bytesPerOp) / BYTES_PER_TB;

  return {
    peakInboundOpsPerSecond,
    peakFanoutMessagesPerSecond,
    liveConnections,
    dailyOps,
    dailyOpLogTb,
  };
}
