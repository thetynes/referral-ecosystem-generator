/**
 * Invite-only beta access. Testers enter an invite code once and receive a signed cookie
 * carrying their label (e.g. "acme-excavating"), which attributes analytics and AI usage.
 * Uses Web Crypto so it works in both the proxy and route handlers.
 */
import { config } from "./config";

export const BETA_COOKIE = "reg_beta";
export const SESSION_COOKIE = "reg_sid";
export const ADMIN_COOKIE = "reg_admin";

const enc = new TextEncoder();
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");

function secret(): string | null {
  return process.env.BETA_SECRET?.trim() || config().entitlementSecret || null;
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function findInvite(code: string): string | null {
  const c = code.trim();
  let found: string | null = null;
  for (const inv of config().beta.invites) if (safeEqual(inv.code, c)) found = inv.label;
  return found;
}

export async function signTester(label: string): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  const payload = Buffer.from(label).toString("base64url");
  return `${payload}.${await hmac(s, `tester:${payload}`)}`;
}

/** Returns the tester label if the cookie is valid AND the invite has not been revoked. */
export async function verifyTester(cookieValue: string | undefined | null): Promise<string | null> {
  const s = secret();
  if (!cookieValue || !s) return null;
  const [payload, sig] = cookieValue.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(await hmac(s, `tester:${payload}`), sig)) return null;
  const label = Buffer.from(payload, "base64url").toString("utf8");
  return config().beta.invites.some((i) => i.label === label) ? label : null;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * Identify the tester behind a request. In local development (DEV_MODE without BETA_MODE)
 * the developer is treated as tester "dev-local" so AI can be exercised locally.
 */
export async function testerFromRequest(req: Request): Promise<string | null> {
  const c = config();
  const label = await verifyTester(readCookie(req, BETA_COOKIE));
  if (label) return label;
  if (!c.beta.enabled && c.devMode) return "dev-local";
  return null;
}

export async function isAdmin(cookieValue: string | null | undefined): Promise<boolean> {
  const key = config().beta.adminKey;
  const s = secret();
  if (!key || !s || !cookieValue) return false;
  return safeEqual(cookieValue, await hmac(s, `admin:${key}`));
}

export async function adminCookieValue(): Promise<string | null> {
  const key = config().beta.adminKey;
  const s = secret();
  return key && s ? hmac(s, `admin:${key}`) : null;
}

export function adminKeyMatches(candidate: string): boolean {
  const key = config().beta.adminKey;
  return Boolean(key && safeEqual(key, candidate.trim()));
}
