import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Tracker",
    short_name: "Expenses",
    description: "Telegram-synced personal expense dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
