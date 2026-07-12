const moreRoutePrefixes = [
  "/more",
  "/settings",
  "/insights",
  "/expenses",
  "/hours-export",
  "/business-profile",
  "/team"
];

export function shouldHideAppNavigation(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/") || pathname.startsWith("/public/");
}

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return moreRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
  return pathname.startsWith(href);
}
