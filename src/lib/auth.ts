import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email?: string;
};

export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { id: user.id, email: user.email ?? undefined };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId() {
  const user = await requireUser();
  return user.id;
}
