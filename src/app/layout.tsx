import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Personal expense dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Expenses" },
};

export const viewport: Viewport = { themeColor: "#10b981", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
