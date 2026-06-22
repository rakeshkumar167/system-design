import { Clock, Signal } from "lucide-react";
import type { TutorialMeta } from "@/lib/types";
import { ReadingProgress } from "./reading-progress";
import { TutorialToc } from "./tutorial-toc";
import { SectionNav } from "./section-nav";

export function TutorialLayout({
  meta,
  children,
}: {
  meta: TutorialMeta;
  children: React.ReactNode;
}) {
  return (
    <>
      <ReadingProgress />

      <div className="mx-auto max-w-6xl px-5 py-12">
        {/* Tutorial header */}
        <header className="border-b border-border pb-8">
          <p className="text-sm font-medium text-accent">Tutorial</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-muted">
            {meta.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Signal size={15} aria-hidden />
              {meta.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} aria-hidden />
              {meta.readingMinutes} min read
            </span>
            <span className="flex flex-wrap gap-1.5">
              {meta.concepts.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px]"
                >
                  {c}
                </span>
              ))}
            </span>
          </div>
        </header>

        {/* Two-column: article + sticky TOC */}
        <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-12">
          <article className="prose-tutorial min-w-0 py-8">{children}</article>

          <aside className="hidden lg:block">
            <div className="sticky top-20 py-8">
              <TutorialToc sections={meta.sections} />
            </div>
          </aside>
        </div>

        <SectionNav slug={meta.slug} />
      </div>
    </>
  );
}
