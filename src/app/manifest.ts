import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: `${APP_NAME}: Company Finances`,
    short_name: APP_NAME,
    description: "Invoices, expenses, payroll and tax for Nigerian companies.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5F0",
    theme_color: "#0E7A55",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New invoice", url: "/app/invoices/new" },
      { name: "Add expense", url: "/app/expenses/new" },
      { name: "Run payroll", url: "/app/payroll" },
    ],
  };
}
