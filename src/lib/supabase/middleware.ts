import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isStaleRefreshTokenError, isSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";
import { canSkipSessionLookup } from "@/lib/supabase/middleware-routes";

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!isSupabaseAuthCookie(name)) return;
    request.cookies.delete(name);
    response.cookies.delete(name);
  });
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (canSkipSessionLookup(path)) return NextResponse.next({ request });

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

  const isAuthPage = path === "/login" || path === "/signup";

  if (!user && path === "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/forgot-password";
    url.search = "";
    url.searchParams.set("error", "reset_expired");
    const redirectResponse = NextResponse.redirect(url);
    if (shouldClearStaleSession) clearSupabaseAuthCookies(request, redirectResponse);
    return redirectResponse;
  }

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    if (shouldClearStaleSession) clearSupabaseAuthCookies(request, redirectResponse);
    return redirectResponse;
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
