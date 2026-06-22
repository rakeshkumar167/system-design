import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Master system design, one rigorous case at a time
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Work through real interview problems the way a senior architect would —
        from requirements to resiliency.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/learn/url-shortener"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-accent-ink"
        >
          Start URL Shortener
        </Link>
        <Link
          href="/curriculum"
          className="rounded-lg border border-border-strong px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-2"
        >
          Browse curriculum
        </Link>
      </div>
    </section>
  );
}
