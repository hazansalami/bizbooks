/**
 * Absolute site URL for metadata and links. Tolerates an empty SITE_URL (Vercel sets unset
 * variables to ""), then falls back to Vercel's own domain variables, then localhost.
 */
export function siteUrl() {
  const candidates = [
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    try {
      return new URL(c.trim());
    } catch {}
  }
  return new URL("http://localhost:3000");
}
