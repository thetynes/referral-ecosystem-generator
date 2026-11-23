import { NextResponse } from "next/server";
import { z } from "zod";
import { extractFromWebsite } from "@/lib/extract";
import { UnsafeUrlError } from "@/lib/extract/ssrf";
import { jsonError, limitOrNull, readJson } from "@/lib/http";
import { readCookie, SESSION_COOKIE, testerFromRequest } from "@/lib/beta";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({ url: z.string().trim().min(3).max(300) });

export async function POST(req: Request) {
  const limited = limitOrNull(req, "extract", 6);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readJson(req, 4000);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter a website address.", 400);
  try {
    const tester = await testerFromRequest(req);
    const result = await extractFromWebsite(parsed.data.url, tester);
    await track("website_read", { tester, session: readCookie(req, SESSION_COOKIE), props: { method: result.method } });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return jsonError(err.message, 422);
    return jsonError("We couldn't read that website. You can fill in the details manually.", 422);
  }
}
