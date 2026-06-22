export interface FailureRow {
  failure: string;
  impact: string;
  detection: string;
  mitigation: string;
  recovery: string;
}

const headers: { key: keyof FailureRow; label: string }[] = [
  { key: "failure", label: "Failure" },
  { key: "impact", label: "User impact" },
  { key: "detection", label: "Detection" },
  { key: "mitigation", label: "Mitigation" },
  { key: "recovery", label: "Recovery" },
];

export function FailureMatrix({ rows }: { rows: FailureRow[] }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-ink-faint">
            {headers.map((h) => (
              <th key={h.key} className="px-4 py-3 font-medium">
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.failure} className="border-b border-border last:border-0">
              <td className="px-4 py-3 align-top font-medium text-ink">
                {row.failure}
              </td>
              <td className="px-4 py-3 align-top text-ink-muted">{row.impact}</td>
              <td className="px-4 py-3 align-top text-ink-muted">{row.detection}</td>
              <td className="px-4 py-3 align-top text-ink-muted">{row.mitigation}</td>
              <td className="px-4 py-3 align-top text-ink-muted">{row.recovery}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
