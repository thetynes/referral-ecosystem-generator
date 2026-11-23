"use client";
/** Fire-and-forget client analytics. Never throws, never blocks the UI. */
const sent = new Set<string>();

export function trackClient(
  name: string,
  data: { analysisId?: string; props?: Record<string, string | number | boolean | null>; once?: string } = {},
) {
  try {
    if (data.once) {
      if (sent.has(data.once)) return;
      sent.add(data.once);
    }
    const body = JSON.stringify({ name, analysisId: data.analysisId, props: data.props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}
