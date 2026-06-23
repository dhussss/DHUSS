import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normaliseThemePreset, themePresets } from "@/lib/themes";

export async function ThemeVars() {
  const user = await getUser();
  if (!user) return null;

  const profile = await prisma.businessProfile.findUnique({
    where: { ownerId: user.id },
    select: { themeAccent: true, themeSecondary: true, themeMode: true }
  });
  const preset = themePresets[normaliseThemePreset(profile?.themeAccent)];
  const secondaryRgb = profile?.themeSecondary || preset.secondaryRgb;
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
