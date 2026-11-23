import { NextResponse, type NextRequest } from "next/server";
import { BETA_COOKIE, SESSION_COOKIE, verifyTester } from "@/lib/beta";
import { config as appConfig } from "@/lib/config";

/** Paths reachable without an invite (join flow, Stripe webhooks, static assets). */
const PUBLIC_PATHS = ["/beta/join", "/api/beta/join", "/api/stripe/webhook", "/beta/admin", "/api/admin/login"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const c = appConfig();
  let res: NextResponse;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (c.beta.enabled && !isPublic) {
    const tester = await verifyTester(req.cookies.get(BETA_COOKIE)?.value);
    if (!tester) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "This preview is invite-only." }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/beta/join";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      res = NextResponse.redirect(url);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }

  res = NextResponse.next();
  if (c.beta.enabled || c.appEnv !== "production") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Anonymous session id for funnel analytics (no personal data).
  if (!req.cookies.get(SESSION_COOKIE)) {
    res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 90, path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
