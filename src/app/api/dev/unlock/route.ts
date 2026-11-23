import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { issueEntitlement } from "@/lib/payments/entitlements";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({ analysisId: z.string().uuid(), tier: z.enum(["basic", "comprehensive"]) });

/** Development/testing only: unlock paid features without payment. Disabled unless DEV_MODE=true. */
export async function POST(req: Request) {
  if (!config().devMode) return jsonError("Not found.", 404);
  let body: unknown;
  try {
    body = await readJson(req, 2000);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid request.", 400);
  const token = issueEntitlement({ ...parsed.data, dev: true }, 30);
  return NextResponse.json({ token, tier: parsed.data.tier, dev: true });
}
