import type { Metadata } from "next";
import { problems } from "@/lib/curriculum";
import { CurriculumBrowser } from "@/components/curriculum/curriculum-browser";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "The complete 25-problem system design curriculum, from foundational warm-ups to advanced distributed systems.",
};

export default function CurriculumPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Curriculum</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          25 system design problems
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          A progression from focused, single-concept warm-ups to full
          multi-subsystem designs. Each tutorial follows the same rigorous
          structure — so the skill, not just the answer, transfers between
          problems.
        </p>
      </header>

      <div className="mt-10">
        <CurriculumBrowser problems={problems} />
      </div>
    </section>
  );
}
