import Link from "next/link";

export default function TutorialNotFound() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-24 text-center">
      <p className="text-sm font-medium text-accent">Not available</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        That tutorial isn&apos;t ready yet
      </h1>
      <p className="mt-3 text-ink-muted">
        Only the URL Shortener tutorial is published so far. The rest of the
        curriculum is on the way.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href="/learn/url-shortener"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-ink"
        >
          Open URL Shortener
        </Link>
        <Link
          href="/curriculum"
          className="rounded-lg border border-border-strong px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-2"
        >
          See curriculum
        </Link>
      </div>
    </section>
  );
}
