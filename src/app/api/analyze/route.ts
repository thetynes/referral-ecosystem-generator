import { NextResponse } from "next/server";
import { z } from "zod";
import { BusinessInputSchema } from "@/lib/schema";
import { generateAnalysis } from "@/lib/engine";
import { getStore } from "@/lib/store";
import { toView } from "@/lib/access";
import { config } from "@/lib/config";
import { jsonError, limitOrNull, readJson, zodMessage } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  input: BusinessInputSchema,
  archetypeId: z.string().max(60).optional(),
  forceKnowledgeBase: z.boolean().optional(),
});

const ANALYSIS_TTL = 60 * 60 * 24 * 180;

export async function POST(req: Request) {
  const limited = limitOrNull(req, "analyze");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400);

  try {
    const analysis = await generateAnalysis(parsed.data.input, {
      archetypeId: parsed.data.archetypeId,
      forceKnowledgeBase: parsed.data.forceKnowledgeBase,
    });
    const store = await getStore();
    await store.set("analyses", analysis.id, analysis, ANALYSIS_TTL);
    return NextResponse.json(toView(analysis, null, config().freeCategoryLimit));
  } catch (err) {
    console.error("analyze failed", err);
    return jsonError("We couldn't generate the ecosystem. Please try again.", 500);
  }
}
