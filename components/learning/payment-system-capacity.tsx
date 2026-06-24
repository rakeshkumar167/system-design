import {
  calculatePaymentSystemCapacity,
  type PaymentSystemCapacityAssumptions,
} from "@/lib/payment-system-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PaymentSystemCapacity({
  assumptions,
}: {
  assumptions: PaymentSystemCapacityAssumptions;
}) {
  const r = calculatePaymentSystemCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily payments", value: fmt(assumptions.dailyPayments) },
    { label: "Avg payment value", value: `$${fmt(assumptions.avgPaymentValueUsd)}` },
    { label: "Peak factor", value: `${fmt(assumptions.peakFactor)}×` },
    { label: "Ledger entries / payment", value: fmt(assumptions.ledgerEntriesPerPayment) },
    { label: "Avg entry size", value: `${fmt(assumptions.avgEntryBytes)} B` },
    { label: "Retention", value: `${fmt(assumptions.retentionYears)} yr` },
  ];

  const results: ResultRow[] = [
    { label: "Avg payments / sec", value: fmt(r.avgPaymentsPerSecond), consequence: "Throughput is modest — this is not a high-QPS problem; correctness is the constraint, not scale." },
    { label: "Peak payments / sec", value: fmt(r.peakPaymentsPerSecond), consequence: "Even at peak, a few thousand a second — a single well-built node could nearly serve it." },
    { label: "Daily money volume", value: `$${fmt(r.dailyVolumeUsd)}`, consequence: "Billions a day flow through — one double-charge or lost payment is real money and a compliance incident." },
    { label: "Ledger entries / sec", value: fmt(r.ledgerEntriesPerSecond), consequence: "Each payment fans into several immutable double-entry rows — the ledger is the write-heavy, append-only core." },
    { label: "Ledger storage (7 yr)", value: `${fmt(r.ledgerStorageTb)} TB`, consequence: "The ledger is append-only and retained for years for audit — it is never mutated, only grown." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
