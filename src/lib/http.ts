import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientIp, rateLimit } from "./rate-limit";
import { config } from "./config";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function zodMessage(err: ZodError): string {
  return err.issues.map((i) => i.message).slice(0, 3).join(" ");
}

/** Returns a 429 response if the caller exceeded the limit for this route, otherwise null. */
export function limitOrNull(req: Request, route: string, limit = config().rateLimitPerMinute) {
  const r = rateLimit(`${route}:${clientIp(req)}`, limit);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Request body too large.");
  return text ? JSON.parse(text) : {};
}
