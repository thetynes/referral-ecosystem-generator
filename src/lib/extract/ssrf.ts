/**
 * Safe fetching of user-supplied URLs: http(s) only, standard ports, public IPs only,
 * re-validated on every redirect, with size and time limits.
 *
 * Residual risk: DNS can change between the lookup and the connection (rebinding).
 * For hardened deployments, route these requests through an egress proxy that
 * blocks private ranges.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

export function parsePublicUrl(raw: string): URL {
  let url: URL;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw.trim()) && !/^https?:\/\//i.test(raw.trim()) && !/^[^:]+:\d+/.test(raw.trim())) {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid website address.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new UnsafeUrlError("Only http and https URLs are supported.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new UnsafeUrlError("Only standard web ports are allowed.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That address is not publicly accessible.");
  }
  if (net.isIP(host.replace(/^\[|\]$/g, "")) && isPrivateIp(host.replace(/^\[|\]$/g, ""))) {
    throw new UnsafeUrlError("That address is not publicly accessible.");
  }
  return url;
}

async function assertPublicHost(url: URL, resolver: typeof lookup) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("That address is not publicly accessible.");
    return;
  }
  const records = await resolver(host, { all: true }).catch(() => {
    throw new UnsafeUrlError("We couldn't find that website. Check the address.");
  });
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new UnsafeUrlError("That address is not publicly accessible.");
  }
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  resolver?: typeof lookup;
}

export async function safeFetchHtml(raw: string, opts: SafeFetchOptions = {}): Promise<{ url: string; html: string }> {
  const { maxBytes = 1_500_000, timeoutMs = 8000, maxRedirects = 3, fetchImpl = fetch, resolver = lookup } = opts;
  let url = parsePublicUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHost(url, resolver);
    const res = await fetchImpl(url, {
      redirect: "manual",
      headers: { "User-Agent": "ReferralEcosystemGenerator/1.0 (+website-intake)", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new UnsafeUrlError("The website returned an invalid redirect.");
      url = parsePublicUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new UnsafeUrlError(`The website responded with an error (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) throw new UnsafeUrlError("That address did not return a web page.");
    const reader = res.body?.getReader();
    if (!reader) return { url: url.toString(), html: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { url: url.toString(), html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  throw new UnsafeUrlError("Too many redirects.");
}
