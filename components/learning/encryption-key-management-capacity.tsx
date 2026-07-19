import {
  calculateEncryptionCapacity,
  type EncryptionCapacityAssumptions,
} from "@/lib/encryption-key-management-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function EncryptionCapacity({
  assumptions,
}: {
  assumptions: EncryptionCapacityAssumptions;
}) {
  const r = calculateEncryptionCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Encrypt/decrypt ops / sec", value: fmt(assumptions.operationsPerSec) },
    { label: "KMS unwrap call", value: `${fmt(assumptions.kmsUnwrapMs)} ms` },
    { label: "DEK cache hit rate", value: `${fmt(assumptions.dekCacheHitRate * 100, 1)}%` },
    { label: "Local AES / op", value: `${fmt(assumptions.aesEncryptMs, 2)} ms` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
  ];

  const results: ResultRow[] = [
    { label: "KMS calls / sec (no cache)", value: `${fmt(r.naiveKmsCallsPerSec)} /s`, consequence: "Unwrapping a data key per operation means one KMS call per op — far beyond KMS quotas, with a network hop each." },
    { label: "KMS calls / sec (DEK cache)", value: `${fmt(r.cachedKmsCallsPerSec)} /s`, consequence: "One data key protects many objects, so a short-TTL DEK cache serves nearly every op without touching the KMS." },
    { label: "KMS-call reduction", value: `${fmt(r.kmsReductionFactor)}×`, consequence: "Caching data keys is what makes envelope encryption scale — the KMS is consulted per key, not per object." },
    { label: "Local crypto cores", value: fmt(r.localCryptoCores), consequence: "The cipher itself is nearly free and hardware-accelerated. Encryption is bounded by KMS calls, not AES throughput." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
