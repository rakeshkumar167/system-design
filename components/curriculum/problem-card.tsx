import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Problem, ProblemDifficulty } from "@/lib/types";

const difficultyStyles: Record<ProblemDifficulty, string> = {
  Foundational: "text-fundamentals border-fundamentals/30 bg-fundamentals/8",
  Intermediate: "text-interview border-interview/30 bg-interview/8",
  Advanced: "text-advanced border-advanced/30 bg-advanced/8",
};

function CardInner({ problem }: { problem: Problem }) {
  const available = problem.status === "available";
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-ink-faint">
          {String(problem.sequence).padStart(2, "0")}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${difficultyStyles[problem.difficulty]}`}
        >
          {problem.difficulty}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold tracking-tight">
        {problem.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        {problem.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {problem.concepts.map((concept) => (
          <span
            key={concept}
            className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted"
          >
            {concept}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium">
        {available ? (
          <span className="inline-flex items-center gap-1.5 text-accent">
            Start tutorial
            <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-ink-faint">
            <Lock size={13} aria-hidden />
            Coming soon
          </span>
        )}
      </div>
    </>
  );
}

export function ProblemCard({ problem }: { problem: Problem }) {
  const baseClass =
    "relative flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm";

  if (problem.status === "available") {
    return (
      <Link
        href={`/learn/${problem.slug}`}
        className={`group ${baseClass} transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md`}
      >
        <CardInner problem={problem} />
      </Link>
    );
  }

  return (
    <div className={`${baseClass} opacity-75`} aria-disabled="true">
      <CardInner problem={problem} />
    </div>
  );
}
