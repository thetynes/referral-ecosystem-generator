import { NextResponse } from "next/server";
import { z } from "zod";
import { BusinessInputSchema } from "@/lib/schema";
import { AiUnavailableError, generateAnalysis } from "@/lib/engine";
import { getStore } from "@/lib/store";
import { toView } from "@/lib/access";
import { config } from "@/lib/config";
import { readCookie, SESSION_COOKIE, testerFromRequest } from "@/lib/beta";
import { track } from "@/lib/analytics";
import { jsonError, limitOrNull, readJson, zodMessage } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 180;

const BodySchema = z.object({
  input: BusinessInputSchema,
  archetypeId: z.string().max(60).optional(),
  forceKnowledgeBase: z.boolean().optional(),
  /** Testers can opt out of AI to see the curated analysis. Ignored for visitors without AI access. */
  useAi: z.boolean().optional(),
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

  const tester = await testerFromRequest(req);
  const session = readCookie(req, SESSION_COOKIE);
  await track("intake_completed", { tester, session, props: { regenerate: Boolean(parsed.data.archetypeId) } });

  try {
    const analysis = await generateAnalysis(parsed.data.input, {
      archetypeId: parsed.data.archetypeId,
      forceKnowledgeBase: parsed.data.forceKnowledgeBase,
      ai: { requested: parsed.data.useAi !== false, tester },
    });
    const store = await getStore();
    await store.set("analyses", analysis.id, analysis, ANALYSIS_TTL);
    await track("map_generated", {
      tester,
      session,
      analysisId: analysis.id,
      props: {
        engine: analysis.engine.mode,
        profile: analysis.engine.archetypeId,
        confidence: analysis.engine.matchConfidence,
        categories: analysis.categories.length,
      },
    });
    if (analysis.engine.mode === "ai") {
      await track("ai_run", { tester, session, analysisId: analysis.id, props: { model: analysis.engine.model, costUsd: Number((analysis.engine.costUsd ?? 0).toFixed(4)) } });
    }
    for (const d of analysis.engine.diagnostics ?? []) {
      if (d.startsWith("AI failed") || /budget|limit/.test(d)) {
        await track("ai_fallback", { tester, session, analysisId: analysis.id, props: { reason: d.slice(0, 120) } });
      }
    }
    return NextResponse.json(toView(analysis, null, config().freeCategoryLimit));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("analyze failed", message);
    await track("server_error", { tester, session, props: { route: "analyze", message: message.slice(0, 120), aiUnavailable: err instanceof AiUnavailableError } });
    return jsonError("We couldn't build your ecosystem just now. Please try again in a few minutes.", err instanceof AiUnavailableError ? 503 : 500);
  }
}
