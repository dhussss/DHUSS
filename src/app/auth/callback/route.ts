import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = safeInternalPath(requestedNext);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failurePath = next === "/reset-password"
        ? "/forgot-password?error=reset_expired"
        : "/login?error=auth_callback_failed";
      return NextResponse.redirect(new URL(failurePath, request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
