"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Problem, ProblemDifficulty } from "@/lib/types";
import { ProblemCard } from "./problem-card";

type Filter = "All" | ProblemDifficulty;

const filters: Filter[] = ["All", "Foundational", "Intermediate", "Advanced"];

export function CurriculumBrowser({
  problems,
}: {
  problems: readonly Problem[];
}) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      const matchesDifficulty =
        difficulty === "All" || p.difficulty === difficulty;
      const matchesQuery =
        q === "" ||
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.concepts.some((c) => c.toLowerCase().includes(q));
      return matchesDifficulty && matchesQuery;
    });
  }, [problems, query, difficulty]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search problems"
            placeholder="Search problems or concepts…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by difficulty">
          {filters.map((f) => {
            const active = difficulty === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setDifficulty(f)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border text-ink-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
        Showing {filtered.length} of {problems.length} problems
      </p>

      {filtered.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-surface-2 p-10 text-center text-ink-muted">
          No problems match your search.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((problem) => (
            <ProblemCard key={problem.slug} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
}
