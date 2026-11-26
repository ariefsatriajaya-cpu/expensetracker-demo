import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(COOKIE)?.value, process.env.SESSION_SECRET ?? "");
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/", "/settings", "/api/expenses", "/api/expenses/:path*", "/api/settings"],
};
