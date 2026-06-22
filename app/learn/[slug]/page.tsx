import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { getTutorial, tutorials } from "@/lib/tutorial-registry";
import { TutorialLayout } from "@/components/tutorial/tutorial-layout";
import UrlShortenerContent from "@/content/tutorials/url-shortener.mdx";

/** Maps each registered slug to its compiled MDX content component. */
const content: Record<string, ComponentType> = {
  "url-shortener": UrlShortenerContent,
};

export function generateStaticParams() {
  return Object.keys(tutorials).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getTutorial(slug);
  if (!meta) return { title: "Tutorial not found" };
  return { title: meta.title, description: meta.description };
}

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getTutorial(slug);
  const Content = content[slug];
  if (!meta || !Content) notFound();

  return (
    <TutorialLayout meta={meta}>
      <Content />
    </TutorialLayout>
  );
}
