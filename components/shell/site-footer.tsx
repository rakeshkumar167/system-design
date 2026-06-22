import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          A study companion for system design interviews. Built for clear
          thinking, not memorization.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <Link href="/curriculum" className="hover:text-ink">
            Curriculum
          </Link>
        </nav>
      </div>
    </footer>
  );
}
