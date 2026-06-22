import {
  calculateUrlShortenerCapacity,
  type CapacityAssumptions,
} from "@/lib/url-shortener-estimates";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const assumptionRows: { key: keyof CapacityAssumptions; label: string; unit: string }[] = [
  { key: "newLinksPerMonth", label: "New links / month", unit: "" },
  { key: "readWriteRatio", label: "Read : write ratio", unit: ":1" },
  { key: "peakMultiplier", label: "Peak multiplier", unit: "×" },
  { key: "bytesPerMapping", label: "Bytes / mapping", unit: " B" },
  { key: "retentionYears", label: "Retention", unit: " yr" },
  { key: "cacheCoveragePercent", label: "Cache coverage", unit: "%" },
];

export function CapacityModel({
  assumptions,
}: {
  assumptions: CapacityAssumptions;
}) {
  const r = calculateUrlShortenerCapacity(assumptions);

  const results: { label: string; value: string; consequence: string }[] = [
    {
      label: "Average write QPS",
      value: fmt(r.averageWriteQps, 0),
      consequence:
        "Tiny. A single write node handles this — writes are never the bottleneck.",
    },
    {
      label: "Average read QPS",
      value: fmt(r.averageReadQps, 0),
      consequence:
        "Reads dominate by 100×. The redirect path is what we must scale and cache.",
    },
    {
      label: "Peak read QPS",
      value: fmt(r.peakReadQps, 0),
      consequence:
        "Provision for peak, not average. Drives cache sizing and replica count.",
    },
    {
      label: "Total stored mappings",
      value: fmt(r.totalMappings, 0),
      consequence:
        "Billions of rows over 5 years — too big for one node, so we partition.",
    },
    {
      label: "Mapping storage",
      value: `${fmt(r.mappingStorageTB, 1)} TB`,
      consequence:
        "Modest for a sharded key-value store; metadata, not media, dominates.",
    },
    {
      label: "Cache working set",
      value: `${fmt(r.cacheWorkingSetGB, 0)} GB`,
      consequence:
        "Hot set fits in a distributed in-memory cache — most reads never touch disk.",
    },
  ];

  return (
    <div className="not-prose my-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Assumptions
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {assumptionRows.map((row) => (
            <div key={row.key} className="flex flex-col">
              <dt className="text-xs text-ink-muted">{row.label}</dt>
              <dd className="font-mono text-sm font-medium text-ink">
                {fmt(assumptions[row.key])}
                {row.unit}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((res) => (
          <div
            key={res.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-muted">{res.label}</p>
              <p className="font-mono text-lg font-semibold text-accent">
                {res.value}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {res.consequence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
