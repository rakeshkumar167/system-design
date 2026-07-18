import {
  calculateAuthorizationCapacity,
  type AuthorizationCapacityAssumptions,
} from "@/lib/authorization-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function AuthorizationCapacity({
  assumptions,
}: {
  assumptions: AuthorizationCapacityAssumptions;
}) {
  const r = calculateAuthorizationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Requests / sec", value: fmt(assumptions.requestsPerSec) },
    { label: "Authz checks / request", value: fmt(assumptions.checksPerRequest) },
    { label: "Decision CPU (uncached)", value: `${fmt(assumptions.decisionCpuMs, 1)} ms` },
    { label: "Decision cache hit rate", value: `${fmt(assumptions.cacheHitRate * 100)}%` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
  ];

  const results: ResultRow[] = [
    { label: "Total checks / sec", value: `${fmt(r.totalChecksPerSec)} /s`, consequence: "Every request is authorized several times (gateway, service, object level), so checks far outnumber requests." },
    { label: "Cached checks / sec", value: `${fmt(r.cachedChecksPerSec)} /s`, consequence: "Repeat (subject, action, resource) decisions served from a short-TTL cache — nearly free." },
    { label: "Evaluated checks / sec", value: `${fmt(r.evaluatedChecksPerSec)} /s`, consequence: "The cache misses that actually run policy evaluation — the real CPU demand." },
    { label: "Decision cores (with cache)", value: fmt(r.coresWithCache), consequence: "Sized by evaluated checks/sec. A decision cache keeps the policy fleet small." },
    { label: "Decision cores (no cache)", value: fmt(r.coresWithoutCache), consequence: "Evaluating every check costs ~10× the CPU. This is why authz is cached and evaluated locally (sidecar) — traded against staleness." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
