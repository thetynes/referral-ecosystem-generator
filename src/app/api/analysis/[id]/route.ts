import { NextResponse } from "next/server";
import type { Analysis } from "@/lib/schema";
import { getStore } from "@/lib/store";
import { toView } from "@/lib/access";
import { config } from "@/lib/config";
import { verifyEntitlement } from "@/lib/payments/entitlements";
import { getDemoAnalysis, DEMO_ID } from "@/lib/demo";
import { jsonError, limitOrNull } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = limitOrNull(req, "analysis", 60);
  if (limited) return limited;
  const { id } = await params;
  if (id === DEMO_ID) return NextResponse.json(toView(getDemoAnalysis(), null, 99));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Not found.", 404);
  const analysis = await (await getStore()).get<Analysis>("analyses", id);
  if (!analysis) return jsonError("We couldn't find this ecosystem. It may have expired.", 404);
  const ent = verifyEntitlement(req.headers.get("x-entitlement"), id);
  return NextResponse.json(toView(analysis, ent, config().freeCategoryLimit));
}
