/**
 * Signed entitlement tokens. Issued only after server-side payment verification
 * (Stripe webhook or Checkout Session lookup) or in explicit development mode.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";

export type Tier = "basic" | "comprehensive";

export interface Entitlement {
  analysisId: string;
  tier: Tier;
  exp: number; // epoch seconds
  dev?: boolean;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueEntitlement(e: Omit<Entitlement, "exp">, ttlDays = 365): string {
  const secret = config().entitlementSecret;
  if (!secret) throw new Error("ENTITLEMENT_SECRET is not configured.");
  const payload = b64(JSON.stringify({ ...e, exp: Math.floor(Date.now() / 1000) + ttlDays * 86400 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyEntitlement(token: string | null | undefined, analysisId: string): Entitlement | null {
  const secret = config().entitlementSecret;
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const e = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Entitlement;
    if (e.analysisId !== analysisId) return null;
    if (e.exp < Date.now() / 1000) return null;
    if (e.tier !== "basic" && e.tier !== "comprehensive") return null;
    if (e.dev && !config().devMode) return null;
    return e;
  } catch {
    return null;
  }
}
