import { Lock } from "lucide-react";
import type { Topic } from "@/lib/types";

export function TopicCard({ topic }: { topic: Topic }) {
  // All topics are coming-soon placeholders for now; render as a non-clickable
  // card. When a topic goes `available`, wrap this in a Link to its route.
  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm opacity-75"
      aria-disabled="true"
    >
      <h3 className="text-base font-semibold tracking-tight">{topic.title}</h3>
      {topic.blurb ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{topic.blurb}</p>
      ) : null}

      <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium">
        <span className="inline-flex items-center gap-1.5 text-ink-faint">
          <Lock size={13} aria-hidden />
          Coming soon
        </span>
      </div>
    </div>
  );
}
