const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface ChatSystemCapacityAssumptions {
  /** Daily active users. */
  dailyActiveUsers: number;
  /** Messages sent per user per day. */
  messagesPerUserPerDay: number;
  /** Fraction of users online (holding a connection) at peak. */
  peakOnlineFraction: number;
  /** Persistent connections one gateway server can hold. */
  connectionsPerServer: number;
  /** Average stored bytes per message. */
  avgMessageBytes: number;
  /** Server-side memory held per open connection (buffers + state). */
  bytesPerConnection: number;
}

export interface ChatSystemCapacityResults {
  messagesPerSec: number;
  concurrentConnections: number;
  gatewayServersNeeded: number;
  dailyStorageTb: number;
  connectionMemoryTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the message rate (~231k/sec, ~4 TB/day) is
 * ordinary, but the signature constraint is holding ~100M persistent WebSocket connections at peak —
 * forcing a fleet of ~1,000 stateful gateway servers (~100k connections each) and ~1 TB of connection
 * memory, plus a session registry to route to the one gateway a user is connected to. Chat scales by
 * holding millions of long-lived stateful connections, not by adding stateless boxes.
 */
export function calculateChatSystemCapacity(
  a: ChatSystemCapacityAssumptions,
): ChatSystemCapacityResults {
  const messagesPerSec = (a.dailyActiveUsers * a.messagesPerUserPerDay) / SECONDS_PER_DAY;
  const concurrentConnections = a.dailyActiveUsers * a.peakOnlineFraction;
  const gatewayServersNeeded = Math.ceil(concurrentConnections / a.connectionsPerServer);
  const dailyStorageTb =
    (a.dailyActiveUsers * a.messagesPerUserPerDay * a.avgMessageBytes) / BYTES_PER_TB;
  const connectionMemoryTb = (concurrentConnections * a.bytesPerConnection) / BYTES_PER_TB;

  return {
    messagesPerSec,
    concurrentConnections,
    gatewayServersNeeded,
    dailyStorageTb,
    connectionMemoryTb,
  };
}
