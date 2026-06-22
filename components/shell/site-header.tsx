import Link from "next/link";
import { Network } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong bg-surface text-accent shadow-sm">
            <Network size={18} aria-hidden />
          </span>
          <span className="text-[15px]">
            System Design<span className="text-ink-faint"> / </span>
            <span className="text-accent">Tutorials</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1.5">
          <Link
            href="/curriculum"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Curriculum
          </Link>
          <Link
            href="/learn/url-shortener"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink sm:inline-block"
          >
            URL Shortener
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
