import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const PRIVATE = ["/app", "/onboarding", "/i/", "/pay/", "/payslip/", "/api/", "/unsubscribe"];

// Search and AI-answer crawlers are welcome on public pages so guides can be cited; private areas stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "anthropic-ai", "Google-Extended", "Bingbot"], allow: "/", disallow: PRIVATE },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
