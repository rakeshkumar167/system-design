import {
  calculateChatSystemCapacity,
  type ChatSystemCapacityAssumptions,
} from "@/lib/chat-system-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ChatSystemCapacity({
  assumptions,
}: {
  assumptions: ChatSystemCapacityAssumptions;
}) {
  const r = calculateChatSystemCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Messages / user / day", value: fmt(assumptions.messagesPerUserPerDay) },
    { label: "Peak online fraction", value: `${fmt(assumptions.peakOnlineFraction * 100)}%` },
    { label: "Connections / server", value: fmt(assumptions.connectionsPerServer) },
    { label: "Avg message size", value: `${fmt(assumptions.avgMessageBytes)} B` },
    { label: "Memory / connection", value: `${fmt(assumptions.bytesPerConnection / 1000)} KB` },
  ];

  const results: ResultRow[] = [
    { label: "Messages / sec", value: `${fmt(r.messagesPerSec)} /s`, consequence: "The message write rate is ordinary — a routine throughput problem, not the hard part." },
    { label: "Concurrent connections", value: fmt(r.concurrentConnections), consequence: "The signature constraint: millions of long-lived WebSocket connections held open at once — what makes chat unlike a request/response service." },
    { label: "Gateway servers", value: fmt(r.gatewayServersNeeded), consequence: "Sized by concurrent connections ÷ connections-per-server; the gateways are stateful, holding the open sockets." },
    { label: "Daily message storage", value: `${fmt(r.dailyStorageTb)} TB`, consequence: "Durable history accumulates steadily — an ordinary storage growth rate." },
    { label: "Connection memory", value: `${fmt(r.connectionMemoryTb)} TB`, consequence: "Each open connection costs server memory (buffers + state); millions of them add up across the fleet." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
