import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, BETA_COOKIE, SESSION_COOKIE, isAdmin, verifyTester } from "@/lib/beta";
import { config as appConfig } from "@/lib/config";

/**
 * Three experiences share this app:
 *  - Public marketing:      /, /ecosystem/demo
 *  - Customer application:  /generate, /ecosystem/*, /report/*, /saved, /checkout/*
 *  - Private administration: /admin and /api/admin/* (separate admin key; never linked from the customer UI)
 *
 * In beta mode everything except the invite page, Stripe webhooks and the admin area requires an invite.
 */
const INVITE_EXEMPT = ["/beta/join", "/api/beta/join", "/api/stripe/webhook", "/admin", "/api/admin"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const c = appConfig();

  // Private administration: APIs require the admin session (the /admin page shows its own sign-in form).
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (isAdminArea) {
    if (!c.beta.adminKey) return new NextResponse("Not found", { status: 404 });
    if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/login" && !(await isAdmin(req.cookies.get(ADMIN_COOKIE)?.value))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const exempt = INVITE_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (c.beta.enabled && !exempt) {
    const tester = await verifyTester(req.cookies.get(BETA_COOKIE)?.value);
    if (!tester) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "This preview is invite-only." }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/beta/join";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
      return redirect;
    }
  }

  const res = NextResponse.next();
  if (c.beta.enabled || c.appEnv !== "production") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Anonymous session id for funnel analytics (no personal data).
  if (!req.cookies.get(SESSION_COOKIE)) {
    res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
