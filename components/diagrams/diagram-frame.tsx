"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

/**
 * Wraps hand-authored SVG content in an accessible, responsive figure with a
 * caption and an optional full-screen view. The SVG scales to container width;
 * the caption is the adjacent text explanation required for comprehension
 * without the visual.
 */
export function DiagramFrame({
  title,
  caption,
  viewBox,
  children,
}: {
  title: string;
  caption: string;
  viewBox: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const svg = (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      {children}
    </svg>
  );

  return (
    <figure className="not-prose my-7">
      <div className="relative overflow-x-auto rounded-xl border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="View diagram full screen"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-canvas/80 text-ink-muted backdrop-blur transition-colors hover:text-ink"
        >
          <Maximize2 size={15} aria-hidden />
        </button>
        <div className="min-w-[640px]">{svg}</div>
      </div>
      <figcaption className="mt-2.5 text-sm text-ink-muted">{caption}</figcaption>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full screen`}
          className="fixed inset-0 z-[100] flex flex-col bg-canvas/95 p-4 backdrop-blur sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close full screen"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-5xl">{svg}</div>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-ink-muted">
            {caption}
          </p>
        </div>
      )}
    </figure>
  );
}
