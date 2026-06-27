import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Topic } from "@/lib/types";

export function TopicCard({
  topic,
  categorySlug,
}: {
  topic: Topic;
  categorySlug: string;
}) {
  if (topic.status === "available") {
    return (
      <Link
        href={`/topics/${categorySlug}/${topic.slug}`}
        className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong"
      >
        <h3 className="text-base font-semibold tracking-tight">{topic.title}</h3>
        {topic.blurb ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{topic.blurb}</p>
        ) : null}
        <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium text-accent">
          Read topic
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </Link>
    );
  }

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
