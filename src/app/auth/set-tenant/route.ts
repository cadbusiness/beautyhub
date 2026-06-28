import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TENANT_SLUG_COOKIE } from "@/lib/tenant/cookie";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const next = request.nextUrl.searchParams.get("next")?.trim() || "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  const jar = await cookies();
  jar.set(TENANT_SLUG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.redirect(new URL(safeNext, request.url));
}
