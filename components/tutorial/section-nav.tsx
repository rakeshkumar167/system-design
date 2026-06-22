import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { problems } from "@/lib/curriculum";

export function SectionNav({ slug }: { slug: string }) {
  const index = problems.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? problems[index - 1] : undefined;
  const next = index >= 0 && index < problems.length - 1 ? problems[index + 1] : undefined;

  return (
    <nav
      aria-label="Tutorial navigation"
      className="mt-16 grid grid-cols-1 gap-3 border-t border-border pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <NavCard problem={prev} direction="prev" />
      ) : (
        <Link
          href="/curriculum"
          className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted transition-colors hover:bg-surface-2"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to curriculum
        </Link>
      )}

      {next && <NavCard problem={next} direction="next" />}
    </nav>
  );
}

function NavCard({
  problem,
  direction,
}: {
  problem: (typeof problems)[number];
  direction: "prev" | "next";
}) {
  const available = problem.status === "available";
  const label = direction === "prev" ? "Previous" : "Next";

  const inner = (
    <>
      <span
        className={`flex items-center gap-1.5 text-xs text-ink-faint ${
          direction === "next" ? "justify-end" : ""
        }`}
      >
        {direction === "prev" && <ArrowLeft size={13} aria-hidden />}
        {label}
        {direction === "next" && <ArrowRight size={13} aria-hidden />}
      </span>
      <span
        className={`mt-1 flex items-center gap-1.5 font-medium ${
          direction === "next" ? "justify-end" : ""
        }`}
      >
        {!available && <Lock size={13} aria-hidden className="text-ink-faint" />}
        {problem.title}
      </span>
    </>
  );

  if (available) {
    return (
      <Link
        href={`/learn/${problem.slug}`}
        className="rounded-xl border border-border bg-surface p-4 text-sm transition-colors hover:border-accent/40 hover:bg-surface-2"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-surface p-4 text-sm opacity-75"
      aria-disabled="true"
    >
      {inner}
    </div>
  );
}
