import { NextResponse } from "next/server";
import { z } from "zod";
import { BETA_COOKIE, findInvite, signTester } from "@/lib/beta";
import { jsonError, limitOrNull, readJson } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({ code: z.string().trim().min(1).max(100) });

export async function POST(req: Request) {
  const limited = limitOrNull(req, "beta-join", 8);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readJson(req, 1000);
  } catch {
    return jsonError("Invalid request.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter your invite code.", 400);
  const label = findInvite(parsed.data.code);
  if (!label) return jsonError("That invite code isn't valid.", 403);
  const token = await signTester(label);
  if (!token) {
    console.error("beta join: BETA_SECRET/ENTITLEMENT_SECRET is not configured");
    return jsonError("Access isn't available right now. Please contact the person who invited you.", 503);
  }
  const res = NextResponse.json({ ok: true, tester: label });
  res.cookies.set(BETA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
