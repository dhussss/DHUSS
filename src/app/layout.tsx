import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
  themeColor: "#f6f4ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={inter.variable}>
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
