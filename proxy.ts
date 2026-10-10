import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

// Every page and API route sits behind the dashboard password. These two
// authenticate themselves: the cron with CRON_SECRET, the Etsy callback
// with the one-time OAuth state cookie.
const SELF_AUTHENTICATED = ["/api/cron", "/api/etsy/callback"];

function matches(supplied: string, expected: string) {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (SELF_AUTHENTICATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    // Fail closed: an unset password must not mean an open dashboard.
    return new NextResponse("EtsyMind is locked: set DASHBOARD_PASSWORD in Vercel.", { status: 503 });
  }

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (matches(supplied, password)) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="EtsyMind", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|placeholder).*)"],
};
