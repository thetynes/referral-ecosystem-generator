import { NextResponse } from "next/server";
import { capabilities } from "@/lib/config";
import { testerFromRequest } from "@/lib/beta";
import { checkAiAllowance } from "@/lib/ai-budget";
import { getLLMProvider } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tester = await testerFromRequest(req);
  const ai = getLLMProvider() ? await checkAiAllowance(tester) : ({ allowed: false, reason: null, silent: true } as const);
  return NextResponse.json({
    ...capabilities(),
    tester,
    aiForYou: ai.allowed ? { available: true, reason: null } : { available: false, reason: "silent" in ai && ai.silent ? null : ai.reason },
  });
}
