import type { Metadata, Viewport } from "next";
import { Google_Sans_Flex } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { APP_NAME } from "@/lib/constants";
import { EARLY_INSTALL_CAPTURE, RegisterServiceWorker } from "@/components/pwa";

// Same family the ECDI portal uses: bold, modern and not on the "AI default" font lists.
const googleSans = Google_Sans_Flex({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-google-sans",
  adjustFontFallback: false,
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const DESCRIPTION =
  "Accounting, invoicing, payroll and tax tracking for Nigerian companies. See cash flow and profit at a glance, get paid through your own Paystack or Flutterwave, run payroll with PAYE worked out, and stay ahead of VAT, WHT and PAYE deadlines.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  applicationName: APP_NAME,
  title: { default: `${APP_NAME}: Accounting, invoicing and payroll for Nigerian companies`, template: `%s | ${APP_NAME}` },
  description: DESCRIPTION,
  keywords: ["accounting software Nigeria", "invoicing software Nigeria", "payroll software Nigeria", "PAYE calculator 2026", "Paystack invoice", "VAT Nigeria", "Wave alternative Nigeria", "Zoho Books alternative Nigeria", "Zoho Books vs Wave", "agency accounting software"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: APP_NAME, locale: "en_NG", url: "/", title: `${APP_NAME}: Your company's finances, clear at a glance`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${APP_NAME}: Your company's finances, clear at a glance`, description: DESCRIPTION },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0E7A55",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={googleSans.variable}>
      <head>
        {/* Chrome fires its install offer once, often before React loads; keep it for the install buttons. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_INSTALL_CAPTURE }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
