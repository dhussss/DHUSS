import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BuildIndicator } from "@/components/BuildIndicator";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeVars } from "@/components/ThemeVars";

export const runtime = "nodejs";
export const preferredRegion = "syd1";

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
  themeColor: "#f5f3ed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <ThemeVars />
        <ServiceWorkerRegister />
        <AppHeader />
        <BuildIndicator />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
