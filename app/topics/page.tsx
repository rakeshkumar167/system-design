import type { Metadata } from "next";
import { topicCategories } from "@/lib/topics";
import { TopicCard } from "@/components/topics/topic-card";

const topicCount = topicCategories.reduce(
  (total, category) => total + category.topics.length,
  0,
);

export const metadata: Metadata = {
  title: "Topics",
  description: `Cross-cutting engineering topics grouped into categories — ${topicCount} topics across ${topicCategories.length} ${topicCategories.length === 1 ? "category" : "categories"}, starting with Security.`,
};

export default function TopicsPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Topics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Topics by category
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Cross-cutting engineering topics that show up across every system —
          grouped into categories so you can go deep on a theme. Each topic
          becomes a focused walkthrough as the library grows.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {topicCategories.map((category) => (
          <div key={category.slug}>
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">
                {category.title}
              </h2>
              <p className="mt-2 text-ink-muted">{category.summary}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.topics.map((topic) => (
                <TopicCard key={topic.slug} topic={topic} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
