import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { getTopic, topicMetas } from "@/lib/topic-registry";
import { getTopicCategory } from "@/lib/topics";
import { TopicLayout } from "@/components/topic/topic-layout";
import AuthenticationContent from "@/content/topics/authentication.mdx";
import TlsContent from "@/content/topics/tls-https-certificates.mdx";

/** Maps each registered topic slug to its compiled MDX content component. */
const content: Record<string, ComponentType> = {
  authentication: AuthenticationContent,
  "tls-https-certificates": TlsContent,
};

export function generateStaticParams() {
  return Object.values(topicMetas).map((t) => ({
    category: t.categorySlug,
    slug: t.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getTopic(slug);
  if (!meta) return { title: "Topic not found" };
  return { title: meta.title, description: meta.description };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const meta = getTopic(slug);
  const Content = content[slug];
  if (!meta || !Content || meta.categorySlug !== category) notFound();
  const cat = getTopicCategory(category);

  return (
    <TopicLayout meta={meta} categoryTitle={cat?.title ?? meta.categorySlug}>
      <Content />
    </TopicLayout>
  );
}
