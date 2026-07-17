const moreRoutePrefixes = [
  "/more",
  "/settings",
  "/insights",
  "/expenses",
  "/hours-export",
  "/business-profile",
  "/team",
  "/tutorials"
];

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const base = new URL("https://internal.local");
    const parsed = new URL(value, base);
    return parsed.origin === base.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function shouldHideAppNavigation(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname.startsWith("/onboarding") || pathname.startsWith("/auth/") || pathname.startsWith("/public/");
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return moreRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
  return pathname.startsWith(href);
}
