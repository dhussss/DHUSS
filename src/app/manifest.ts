import type { MetadataRoute } from "next";
import { platform } from "@/lib/platform";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: platform.name,
    short_name: platform.shortName,
    description: platform.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf6",
    theme_color: "#0f9f8f",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  };
}
