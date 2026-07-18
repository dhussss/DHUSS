export function canSkipSessionLookup(path: string) {
  return path === "/forgot-password" ||
    path === "/support" ||
    path.startsWith("/legal/") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/public/invoices/") ||
    path.startsWith("/_next") ||
    path.startsWith("/icons") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path === "/favicon.ico";
}
