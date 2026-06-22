import { ChevronRight } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="not-prose my-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium text-ink marker:hidden hover:bg-surface-2">
            <span>{item.question}</span>
            <ChevronRight
              size={17}
              aria-hidden
              className="shrink-0 text-ink-faint transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
