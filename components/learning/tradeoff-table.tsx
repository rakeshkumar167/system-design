import { Check } from "lucide-react";

export function TradeoffTable({
  columns,
  rows,
  recommendedRow,
}: {
  columns: string[];
  rows: string[][];
  /** Zero-based index of the row to highlight as the recommended option. */
  recommendedRow?: number;
}) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-ink-faint">
            {columns.map((col, i) => (
              <th key={col} className={`px-4 py-3 font-medium ${i === 0 ? "" : ""}`}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const recommended = ri === recommendedRow;
            return (
              <tr
                key={ri}
                className={`border-b border-border last:border-0 ${
                  recommended ? "bg-success-soft" : ""
                }`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3 align-top ${
                      ci === 0
                        ? "font-medium text-ink"
                        : "text-ink-muted"
                    }`}
                  >
                    {ci === 0 && recommended ? (
                      <span className="flex items-center gap-1.5">
                        <Check size={14} aria-hidden className="text-success" />
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
