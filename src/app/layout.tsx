import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BuildIndicator } from "@/components/BuildIndicator";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeVars } from "@/components/ThemeVars";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { platform } from "@/lib/platform";

export const runtime = "nodejs";
export const preferredRegion = "syd1";

const metadataBase = resolveAppBaseUrl();

export const metadata: Metadata = {
  metadataBase: metadataBase ? new URL(metadataBase) : undefined,
  title: {
    default: platform.name,
    template: `%s | ${platform.name}`
  },
  description: platform.description,
  applicationName: platform.name,
  manifest: "/manifest.webmanifest",
  alternates: metadataBase ? { canonical: "/" } : undefined,
  openGraph: {
    type: "website",
    title: platform.name,
    description: platform.description,
    siteName: platform.name
  },
  appleWebApp: {
    capable: true,
    title: platform.shortName,
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#f7f8f6",
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
