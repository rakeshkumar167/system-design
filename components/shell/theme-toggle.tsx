"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Moon size={17} aria-hidden className="dark:hidden" />
      <Sun size={17} aria-hidden className="hidden dark:block" />
    </button>
  );
}
