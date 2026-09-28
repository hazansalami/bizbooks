import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { allArticles } from "@/lib/insights";
import { TOOLS } from "@/lib/tools";
import { SOLUTIONS } from "./(site)/solutions/data";
import { COMPARE_PAGES } from "@/lib/compare";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const u = (p: string) => new URL(p, base).toString();
  const pages = ["/", "/pricing", "/advisors", "/insights", "/tools", "/signup", "/terms", "/privacy", ...SOLUTIONS.map((s) => `/solutions/${s.slug}`), ...COMPARE_PAGES.map((c) => `/compare/${c.slug}`), ...TOOLS.map((t) => t.href)];
  return [
    ...pages.map((path) => ({ url: u(path), changeFrequency: "monthly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...allArticles().map((a) => ({ url: u(`/insights/${a.slug}`), lastModified: a.updated, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
