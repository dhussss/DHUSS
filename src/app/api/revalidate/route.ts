import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import type { RevalidationRequest } from "@/lib/deferred-revalidation";

const MAX_ITEMS = 24;
const MAX_VALUE_LENGTH = 256;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as RevalidationRequest | null;
  if (!body || !Array.isArray(body.paths) || !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "Invalid revalidation request." }, { status: 400 });
  }

  const paths = body.paths.slice(0, MAX_ITEMS).filter((entry) =>
    entry && typeof entry.path === "string" && entry.path.startsWith("/") && !entry.path.startsWith("//") && entry.path.length <= MAX_VALUE_LENGTH
  );
  const tags = body.tags.slice(0, MAX_ITEMS).filter((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= MAX_VALUE_LENGTH);
  if (paths.length !== body.paths.length || tags.length !== body.tags.length) {
    return NextResponse.json({ error: "Invalid revalidation values." }, { status: 400 });
  }

  for (const { path, type } of paths) revalidatePath(path, type === "layout" || type === "page" ? type : undefined);
  for (const tag of tags) revalidateTag(tag);
  return NextResponse.json({ revalidated: true });
}
