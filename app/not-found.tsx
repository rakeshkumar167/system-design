import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-24 text-center">
      <p className="font-mono text-sm text-ink-faint">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-ink"
        >
          Go home
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
