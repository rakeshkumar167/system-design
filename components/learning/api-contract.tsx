export interface StatusCode {
  code: string;
  meaning: string;
}

const methodColors: Record<string, string> = {
  GET: "text-fundamentals border-fundamentals/30 bg-fundamentals/8",
  POST: "text-success border-success/40 bg-success-soft",
  PUT: "text-warning border-warning/40 bg-warning-soft",
  PATCH: "text-warning border-warning/40 bg-warning-soft",
  DELETE: "text-danger border-danger/40 bg-danger-soft",
};

export function ApiContract({
  method,
  path,
  summary,
  request,
  response,
  statusCodes,
  notes,
}: {
  method: string;
  path: string;
  summary: string;
  request?: string;
  response?: string;
  statusCodes?: StatusCode[];
  notes?: string;
}) {
  const methodClass =
    methodColors[method.toUpperCase()] ??
    "text-ink border-border bg-surface-2";

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${methodClass}`}
        >
          {method.toUpperCase()}
        </span>
        <code className="font-mono text-sm text-ink">{path}</code>
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-ink-muted">{summary}</p>

        {request && (
          <Block label="Request">{request}</Block>
        )}
        {response && (
          <Block label="Response">{response}</Block>
        )}

        {statusCodes && statusCodes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Status codes
            </p>
            <ul className="space-y-1 text-sm">
              {statusCodes.map((sc) => (
                <li key={sc.code} className="flex gap-3">
                  <code className="font-mono font-medium text-ink">{sc.code}</code>
                  <span className="text-ink-muted">{sc.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes && (
          <p className="border-t border-border pt-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">Notes — </span>
            {notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[13px] leading-relaxed text-ink">
        {children}
      </pre>
    </div>
  );
}
