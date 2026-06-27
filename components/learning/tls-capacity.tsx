import {
  calculateTlsCapacity,
  type TlsCapacityAssumptions,
} from "@/lib/tls-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function TlsCapacity({
  assumptions,
}: {
  assumptions: TlsCapacityAssumptions;
}) {
  const r = calculateTlsCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New connections / sec", value: fmt(assumptions.newConnectionsPerSec) },
    { label: "Full handshake CPU", value: `${fmt(assumptions.fullHandshakeCpuMs, 1)} ms` },
    { label: "Resumed handshake CPU", value: `${fmt(assumptions.resumedHandshakeCpuMs, 1)} ms` },
    { label: "Resumption rate", value: `${fmt(assumptions.resumptionRate * 100)}%` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
  ];

  const results: ResultRow[] = [
    { label: "Full handshakes / sec", value: `${fmt(r.fullHandshakesPerSec)} /s`, consequence: "The expensive asymmetric handshakes — new sessions with no prior state to resume." },
    { label: "Resumed handshakes / sec", value: `${fmt(r.resumedHandshakesPerSec)} /s`, consequence: "Cheap resumed sessions — roughly 20× less CPU than a full handshake." },
    { label: "Handshake CPU / sec", value: `${fmt(r.handshakeCpuMsPerSec)} ms/s`, consequence: "Total handshake CPU demand — dominated by the full handshakes, not the bytes transferred." },
    { label: "TLS cores (with resumption)", value: fmt(r.coresWithResumption), consequence: "Sized by handshakes/sec, not throughput. Resumption keeps the fleet small." },
    { label: "TLS cores (no resumption)", value: fmt(r.coresWithoutResumption), consequence: "Without resumption every connection pays the full handshake — ~4× the CPU. This is why resumption and edge termination matter." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
