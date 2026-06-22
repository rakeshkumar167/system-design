export interface NonFunctional {
  goal: string;
  target: string;
}

export function RequirementsTable({
  functional,
  nonFunctional,
}: {
  functional: string[];
  nonFunctional: NonFunctional[];
}) {
  return (
    <div className="not-prose my-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="text-sm font-semibold text-ink">Functional</h4>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          {functional.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="text-sm font-semibold text-ink">Non-functional</h4>
        <dl className="mt-3 space-y-2.5 text-sm">
          {nonFunctional.map((nf) => (
            <div key={nf.goal} className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">{nf.goal}</dt>
              <dd className="shrink-0 text-right font-mono text-[13px] font-medium text-ink">
                {nf.target}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
