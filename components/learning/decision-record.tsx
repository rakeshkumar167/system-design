import { CheckCircle2 } from "lucide-react";

export function DecisionRecord({
  title,
  choice,
  rationale,
  alternatives,
  revisitWhen,
}: {
  title: string;
  choice: string;
  rationale: string;
  alternatives?: string;
  revisitWhen?: string;
}) {
  return (
    <div className="not-prose my-6 rounded-xl border border-success/40 bg-success-soft p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} aria-hidden className="text-success" />
        <p className="text-xs font-semibold uppercase tracking-wide text-success">
          Decision · {title}
        </p>
      </div>

      <p className="mt-2 font-medium text-ink">{choice}</p>

      <dl className="mt-3 space-y-2 text-sm">
        <Row term="Why">{rationale}</Row>
        {alternatives && <Row term="Instead of">{alternatives}</Row>}
        {revisitWhen && <Row term="Revisit when">{revisitWhen}</Row>}
      </dl>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="sm:flex sm:gap-3">
      <dt className="shrink-0 font-medium text-ink sm:w-28">{term}</dt>
      <dd className="text-ink-muted">{children}</dd>
    </div>
  );
}
