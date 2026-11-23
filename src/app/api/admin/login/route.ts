import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminCookieValue, adminKeyMatches } from "@/lib/beta";
import { jsonError, limitOrNull, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = limitOrNull(req, "admin-login", 5);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readJson(req, 1000);
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = z.object({ key: z.string().min(1).max(200) }).safeParse(body);
  if (!parsed.success || !adminKeyMatches(parsed.data.key)) return jsonError("Invalid key.", 403);
  const value = await adminCookieValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, value!, { httpOnly: true, sameSite: "strict", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}
