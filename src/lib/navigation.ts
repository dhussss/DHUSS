const moreRoutePrefixes = [
  "/more",
  "/settings",
  "/insights",
  "/expenses",
  "/hours-export",
  "/business-profile",
  "/team",
  "/tutorials",
  "/account"
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

export function withInternalPathParams(
  value: string | null | undefined,
  params: Record<string, string>,
  fallback = "/"
) {
  const path = safeInternalPath(value, fallback);
  const parsed = new URL(path, "https://internal.local");
  for (const [key, paramValue] of Object.entries(params)) parsed.searchParams.set(key, paramValue);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function shouldHideAppNavigation(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/support" || pathname.startsWith("/legal/") || pathname.startsWith("/onboarding") || pathname.startsWith("/auth/") || pathname.startsWith("/public/");
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return moreRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
  return pathname.startsWith(href);
}
