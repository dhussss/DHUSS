import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";

export const metadata: Metadata = {
  title: "Trade Invoice Tracker",
  description: "Mobile-first time, item, invoice and hours export tracker for sole traders.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Trade Tracker",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f9f8f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <ServiceWorkerRegister />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
