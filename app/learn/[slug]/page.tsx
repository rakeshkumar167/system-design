import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { getTutorial, tutorials } from "@/lib/tutorial-registry";
import { TutorialLayout } from "@/components/tutorial/tutorial-layout";
import UrlShortenerContent from "@/content/tutorials/url-shortener.mdx";
import RateLimiterContent from "@/content/tutorials/rate-limiter.mdx";
import PastebinContent from "@/content/tutorials/pastebin.mdx";
import NotificationServiceContent from "@/content/tutorials/notification-service.mdx";
import TicketBookingContent from "@/content/tutorials/ticket-booking.mdx";
import VideoStreamingContent from "@/content/tutorials/video-streaming.mdx";
import DistributedCacheContent from "@/content/tutorials/distributed-cache.mdx";
import CollaborativeDocEditorContent from "@/content/tutorials/collaborative-doc-editor.mdx";
import CloudDriveContent from "@/content/tutorials/cloud-drive.mdx";
import PaymentSystemContent from "@/content/tutorials/payment-system.mdx";
import DistributedLoggingContent from "@/content/tutorials/distributed-logging.mdx";
import DistributedJobSchedulerContent from "@/content/tutorials/distributed-job-scheduler.mdx";
import MapsNavigationContent from "@/content/tutorials/maps-navigation.mdx";
import ApiGatewayContent from "@/content/tutorials/api-gateway.mdx";
import WebCrawlerContent from "@/content/tutorials/web-crawler.mdx";
import SearchAutocompleteContent from "@/content/tutorials/search-autocomplete.mdx";

/** Maps each registered slug to its compiled MDX content component. */
const content: Record<string, ComponentType> = {
  "url-shortener": UrlShortenerContent,
  "rate-limiter": RateLimiterContent,
  "pastebin": PastebinContent,
  "notification-service": NotificationServiceContent,
  "distributed-cache": DistributedCacheContent,
  "ticket-booking": TicketBookingContent,
  "video-streaming": VideoStreamingContent,
  "collaborative-doc-editor": CollaborativeDocEditorContent,
  "cloud-drive": CloudDriveContent,
  "payment-system": PaymentSystemContent,
  "distributed-logging": DistributedLoggingContent,
  "distributed-job-scheduler": DistributedJobSchedulerContent,
  "maps-navigation": MapsNavigationContent,
  "api-gateway": ApiGatewayContent,
  "web-crawler": WebCrawlerContent,
  "search-autocomplete": SearchAutocompleteContent,
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
