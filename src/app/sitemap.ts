import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/siteOrigin";

type SitemapPage = {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

/**
 * Public pages only. Left out on purpose: /chair (private chair portal),
 * /api, and the post-action pages (every thanks page, the marketplace
 * checkout and the payment return routes), which only make sense right after
 * a submission.
 */
const PAGES: SitemapPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/register", changeFrequency: "weekly", priority: 0.9 },
  { path: "/marketplace", changeFrequency: "weekly", priority: 0.8 },
  { path: "/logistics", changeFrequency: "monthly", priority: 0.8 },
  { path: "/photos", changeFrequency: "monthly", priority: 0.6 },
  { path: "/feedback", changeFrequency: "monthly", priority: 0.5 },
  { path: "/remembrance", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();

  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, origin).toString(),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
