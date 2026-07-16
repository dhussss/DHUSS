import "server-only";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LOGO_BUCKET = "business-logos";

export async function createBusinessLogoSignedUrl(path: string, expiresInSeconds: number) {
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data } = await admin.storage.from(LOGO_BUCKET).createSignedUrl(path, expiresInSeconds);
    if (data?.signedUrl) return data.signedUrl;
  }

  const supabase = await createClient();
  const { data } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

export async function loadBusinessLogoBuffer(path: string | null) {
  if (!path) return null;

  try {
    const signedUrl = await createBusinessLogoSignedUrl(path, 60 * 5);
    if (!signedUrl) return null;

    const response = await fetch(signedUrl, { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) return null;

    const image = Buffer.from(await response.arrayBuffer());
    if (contentType.includes("png") || contentType.includes("jpeg") || contentType.includes("jpg")) return image;

    if (contentType.includes("webp") || contentType.includes("svg")) {
      return sharp(image, { limitInputPixels: 16_000_000 }).png().toBuffer();
    }

    return null;
  } catch {
    return null;
  }
}
