import { NextRequest, NextResponse } from "next/server";
import { COOKIE, safeEqual, signSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pw = String(form.get("password") ?? "");
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expected || !safeEqual(pw, expected)) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), 303);
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, await signSession(process.env.SESSION_SECRET ?? ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
