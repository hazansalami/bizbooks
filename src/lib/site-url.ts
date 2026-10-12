/** The public address. Links in emails, invoices, receipts, payment callbacks and SEO tags all use it. */
export const CANONICAL_URL = "https://www.bizbooks.name.ng";

const isVercelHost = (u: string) => /\.vercel\.app$/i.test(new URL(u).hostname);

/**
 * Absolute site URL for metadata and links. Production always uses the real domain (a SITE_URL still
 * pointing at the old *.vercel.app address is ignored). Preview deployments use their own Vercel URL, and
 * local development falls back to localhost. Tolerates empty variables (Vercel sets unset ones to "").
 */
export function siteUrl() {
  const production = process.env.VERCEL_ENV === "production";
  const candidates = [
    process.env.SITE_URL,
    production ? CANONICAL_URL : undefined,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    try {
      if (production && isVercelHost(c.trim())) continue;
      return new URL(c.trim());
    } catch {}
  }
  return new URL("http://localhost:3000");
}
