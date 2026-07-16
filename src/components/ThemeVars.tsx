import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { getUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import { normaliseRgbValue, normaliseThemePreset, themePresets } from "@/lib/themes";

const getThemePreference = unstable_cache(
  async (ownerId: string) =>
    prisma.businessProfile.findUnique({
      where: { ownerId },
      select: { themeAccent: true, themeSecondary: true, themeMode: true }
    }),
  ["theme-preference"],
  { revalidate: 300, tags: [CACHE_TAGS.profile] }
);

export async function ThemeVars() {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  if (!hasAuthCookie) return null;

  const user = await getUser();
  if (!user) return null;

  const profile = await getThemePreference(user.id);
  const preset = themePresets[normaliseThemePreset(profile?.themeAccent)];
  const secondaryRgb = normaliseRgbValue(profile?.themeSecondary, preset.secondaryRgb);
  const mode = profile?.themeMode === "dark" ? "dark" : profile?.themeMode === "light" ? "light" : "light dark";

  return (
    <style
      id="user-theme"
      dangerouslySetInnerHTML={{
        __html: `:root{--color-accent-rgb:${preset.accentRgb};--color-secondary-rgb:${secondaryRgb};color-scheme:${mode};}`
      }}
    />
  );
}
