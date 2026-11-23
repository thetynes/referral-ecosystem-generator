import { NextResponse } from "next/server";
import { z } from "zod";
import { CLIENT_EVENTS, track } from "@/lib/analytics";
import { readCookie, SESSION_COOKIE, testerFromRequest } from "@/lib/beta";
import { DEMO_ID } from "@/lib/demo";
import { limitOrNull, readJson } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.enum(CLIENT_EVENTS),
  analysisId: z.string().max(64).optional(),
  props: z.record(z.string().max(40), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(req: Request) {
  const limited = limitOrNull(req, "events", 120);
  if (limited) return limited;
  try {
    const parsed = BodySchema.safeParse(await readJson(req, 4000));
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
    const props = Object.fromEntries(Object.entries(parsed.data.props ?? {}).slice(0, 10));
    await track(parsed.data.name, {
      tester: await testerFromRequest(req),
      session: readCookie(req, SESSION_COOKIE),
      analysisId: parsed.data.analysisId ?? null,
      simulated: parsed.data.analysisId === DEMO_ID,
      props,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
