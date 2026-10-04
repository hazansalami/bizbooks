import type { NextConfig } from "next";

/*
  Security headers on every response.
  - No framing: other sites can't show BizBooks inside a frame, which blocks clickjacking (tricking someone
    into clicking "Mark as paid" or "Delete" on a page hidden under another site). frame-ancestors is the
    modern form; X-Frame-Options covers older browsers.
  - nosniff: browsers use the declared file type instead of guessing, so an upload can't be run as a script.
  - Referrer: other sites see only the site address, never full page addresses like private invoice or payslip links.
  - Permissions: no microphone or location; camera allowed here only, for receipt photos.
  A full script-source Content-Security-Policy is a separate step: the site uses a few inline scripts
  (structured data, the install prompt) that would need nonces first.
*/
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
