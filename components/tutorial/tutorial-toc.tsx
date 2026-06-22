"use client";

import { useEffect, useState } from "react";
import type { TutorialSection } from "@/lib/types";

export function TutorialToc({
  sections,
}: {
  sections: readonly TutorialSection[];
}) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 font-medium text-ink-faint">On this page</p>
      <ol className="space-y-0.5 border-l border-border">
        {sections.map((section, i) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? "location" : undefined}
                className={`-ml-px flex gap-2 border-l-2 py-1 pl-3 transition-colors ${
                  active
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-ink-muted hover:border-border-strong hover:text-ink"
                }`}
              >
                <span className="font-mono text-xs text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{section.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
