export interface AssumptionRow {
  label: string;
  value: string;
}

export interface ResultRow {
  label: string;
  value: string;
  consequence: string;
}

export function CapacityTable({
  assumptions,
  results,
}: {
  assumptions: AssumptionRow[];
  results: ResultRow[];
}) {
  return (
    <div className="not-prose my-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Assumptions
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {assumptions.map((row) => (
            <div key={row.label} className="flex flex-col">
              <dt className="text-xs text-ink-muted">{row.label}</dt>
              <dd className="font-mono text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((res) => (
          <div key={res.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-muted">{res.label}</p>
              <p className="font-mono text-lg font-semibold text-accent">{res.value}</p>
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
