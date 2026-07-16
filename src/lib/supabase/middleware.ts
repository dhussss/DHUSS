import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isStaleRefreshTokenError, isSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!isSupabaseAuthCookie(name)) return;
    request.cookies.delete(name);
    response.cookies.delete(name);
  });
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  let user: User | null = null;
  let shouldClearStaleSession = false;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    shouldClearStaleSession = isStaleRefreshTokenError(result.error);
  } catch (error) {
    shouldClearStaleSession = isStaleRefreshTokenError(error);
  }

  if (shouldClearStaleSession) clearSupabaseAuthCookies(request, response);

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/signup" || path === "/forgot-password";
  const isAuthCallback = path.startsWith("/auth/callback");
  const isPublicInvoice = path.startsWith("/public/invoices/");
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/icons") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js" ||
    path === "/favicon.ico";

  if (!user && !isAuthPage && !isAuthCallback && !isPublicInvoice && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    if (shouldClearStaleSession) clearSupabaseAuthCookies(request, redirectResponse);
    return redirectResponse;
  }

  if (user && isAuthPage && path !== "/forgot-password") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
