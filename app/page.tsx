import Link from "next/link";
import { ArrowRight, Compass, Layers, Mountain } from "lucide-react";
import { problems, getProblem } from "@/lib/curriculum";
import { ProblemCard } from "@/components/curriculum/problem-card";

const depths = [
  {
    icon: Compass,
    name: "Fundamentals",
    color: "text-fundamentals",
    body: "Terminology, constraints, and the core building blocks — so the rest of the design has a foundation to stand on.",
  },
  {
    icon: Layers,
    name: "Interview-ready",
    color: "text-interview",
    body: "Requirements, estimates, APIs, data, and architecture, walked through in the exact order an interviewer expects.",
  },
  {
    icon: Mountain,
    name: "Advanced",
    color: "text-advanced",
    body: "Failure modes, distributed-system trade-offs, alternative designs, and how the system evolves under real scale.",
  },
];

export default function HomePage() {
  const featured = getProblem("url-shortener")!;
  const preview = problems.slice(0, 6);
  const liveCount = problems.filter((p) => p.status === "available").length;
  const inProgressCount = problems.length - liveCount;

  return (
    <>
      {/* Hero */}
      <section className="graph-paper border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {liveCount} {liveCount === 1 ? "tutorial" : "tutorials"} live ·{" "}
            {inProgressCount} more in progress
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Learn system design the way it&rsquo;s actually practiced
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-muted">
            Real interview problems worked end to end — requirements, capacity
            math, APIs, data models, precise architecture diagrams, trade-offs,
            and failure modes — so you reason from first principles instead of
            memorizing diagrams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/learn/url-shortener"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-accent-ink"
            >
              Start URL Shortener
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link
              href="/curriculum"
              className="rounded-lg border border-border-strong bg-surface px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Browse curriculum
            </Link>
          </div>
        </div>
      </section>

      {/* Three depths */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Three depths, one coherent tutorial
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Every problem is layered so you can skim for a refresher or go deep
          before a senior interview.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {depths.map(({ icon: Icon, name, color, body }) => (
            <div
              key={name}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <Icon size={22} aria-hidden className={color} />
              <h3 className="mt-3 text-lg font-semibold">{name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured + preview */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Start here
            </h2>
            <p className="mt-2 max-w-2xl text-ink-muted">
              The pilot tutorial sets the bar for everything that follows.
            </p>
          </div>
          <Link
            href="/curriculum"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-ink sm:inline-flex"
          >
            All {problems.length} problems
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProblemCard problem={featured} />
          {preview
            .filter((p) => p.slug !== featured.slug)
            .slice(0, 5)
            .map((problem) => (
              <ProblemCard key={problem.slug} problem={problem} />
            ))}
        </div>
      </section>
    </>
  );
}
