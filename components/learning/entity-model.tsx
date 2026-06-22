import { KeyRound } from "lucide-react";

export interface EntityField {
  name: string;
  type: string;
  notes?: string;
}

export function EntityModel({
  name,
  description,
  fields,
  keys,
}: {
  name: string;
  description?: string;
  fields: EntityField[];
  keys?: string;
}) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-2 px-5 py-3">
        <h4 className="font-mono text-sm font-semibold text-ink">{name}</h4>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-2 font-medium">Field</th>
              <th className="px-5 py-2 font-medium">Type</th>
              <th className="px-5 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-5 py-2 font-mono text-[13px] font-medium text-ink">
                  {f.name}
                </td>
                <td className="whitespace-nowrap px-5 py-2 font-mono text-[13px] text-ink-muted">
                  {f.type}
                </td>
                <td className="px-5 py-2 text-ink-muted">{f.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {keys && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm">
          <KeyRound size={14} aria-hidden className="text-accent" />
          <span className="text-ink-muted">{keys}</span>
        </div>
      )}
    </div>
  );
}
