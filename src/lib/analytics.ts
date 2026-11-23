/**
 * Minimal first-party product analytics for the beta.
 *
 * Every event records the deployment environment and a `simulated` flag so development,
 * demo, dev-unlock and Stripe test-mode activity is never mixed with real customer activity.
 * No personal data: testers are identified by invite label, visitors by a random session id.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "./config";
import { getSqlPool } from "./store";

export const CLIENT_EVENTS = [
  "intake_started",
  "website_read",
  "relationship_explored",
  "view_changed",
  "export_downloaded",
  "report_requested",
  "report_printed",
  "upgrade_viewed",
] as const;

export const SERVER_EVENTS = [
  "intake_completed",
  "map_generated",
  "ai_run",
  "ai_fallback",
  "checkout_started",
  "purchase_completed",
  "dev_unlock",
  "csv_imported",
] as const;

export type EventName = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

export interface AnalyticsEvent {
  name: EventName;
  ts: string;
  env: string;
  simulated: boolean;
  tester: string | null;
  session: string | null;
  analysisId: string | null;
  props: Record<string, string | number | boolean | null>;
}

export const EVENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  env TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT false,
  tester TEXT NULL,
  session TEXT NULL,
  analysis_id TEXT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb
)`;

const memory: AnalyticsEvent[] = [];
let tableReady: Promise<unknown> | null = null;

export function isSimulatedContext(): boolean {
  const c = config();
  return c.devMode || c.appEnv === "development";
}

export async function track(
  name: EventName,
  ctx: { tester?: string | null; session?: string | null; analysisId?: string | null; simulated?: boolean; props?: AnalyticsEvent["props"] } = {},
): Promise<void> {
  const c = config();
  const event: AnalyticsEvent = {
    name,
    ts: new Date().toISOString(),
    env: c.appEnv,
    simulated: Boolean(ctx.simulated) || isSimulatedContext(),
    tester: ctx.tester ?? null,
    session: ctx.session ?? null,
    analysisId: ctx.analysisId ?? null,
    props: ctx.props ?? {},
  };
  try {
    const pool = await getSqlPool();
    if (pool) {
      tableReady ??= pool.query(EVENTS_TABLE_SQL);
      await tableReady;
      await pool.query(
        "INSERT INTO analytics_events (ts, name, env, simulated, tester, session, analysis_id, props) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [event.ts, event.name, event.env, event.simulated, event.tester, event.session, event.analysisId, JSON.stringify(event.props)],
      );
    } else if (c.store.driver === "file") {
      const file = path.resolve(c.store.dataDir, "analytics.jsonl");
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, JSON.stringify(event) + "\n");
    } else {
      memory.push(event);
      if (memory.length > 5000) memory.shift();
    }
  } catch (err) {
    // Analytics must never break the product.
    console.error("analytics write failed", err instanceof Error ? err.message : err);
  }
}

export interface AnalyticsSummary {
  sinceDays: number;
  counts: { name: string; real: number; simulated: number }[];
  testers: { tester: string; events: number; maps: number; explored: number; reports: number }[];
  uniqueSessions: { real: number; simulated: number };
}

async function loadEvents(sinceIso: string): Promise<AnalyticsEvent[]> {
  const c = config();
  const pool = await getSqlPool();
  if (pool) {
    tableReady ??= pool.query(EVENTS_TABLE_SQL);
    await tableReady;
    const { rows } = await pool.query(
      "SELECT ts, name, env, simulated, tester, session, analysis_id, props FROM analytics_events WHERE ts >= $1 ORDER BY ts DESC LIMIT 20000",
      [sinceIso],
    );
    return rows.map((r) => ({
      ts: new Date(r.ts as string).toISOString(),
      name: r.name as EventName,
      env: r.env as string,
      simulated: Boolean(r.simulated),
      tester: (r.tester as string) ?? null,
      session: (r.session as string) ?? null,
      analysisId: (r.analysis_id as string) ?? null,
      props: (typeof r.props === "string" ? JSON.parse(r.props) : r.props) ?? {},
    }));
  }
  if (c.store.driver === "file") {
    try {
      const raw = await fs.readFile(path.resolve(c.store.dataDir, "analytics.jsonl"), "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as AnalyticsEvent)
        .filter((e) => e.ts >= sinceIso);
    } catch {
      return [];
    }
  }
  return memory.filter((e) => e.ts >= sinceIso);
}

export async function summarize(sinceDays = 30): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const events = await loadEvents(since);
  const counts = new Map<string, { real: number; simulated: number }>();
  const testers = new Map<string, { events: number; maps: number; explored: number; reports: number }>();
  const sessions = { real: new Set<string>(), simulated: new Set<string>() };
  for (const e of events) {
    const row = counts.get(e.name) ?? { real: 0, simulated: 0 };
    if (e.simulated) row.simulated++;
    else row.real++;
    counts.set(e.name, row);
    if (e.session) (e.simulated ? sessions.simulated : sessions.real).add(e.session);
    if (e.tester) {
      const t = testers.get(e.tester) ?? { events: 0, maps: 0, explored: 0, reports: 0 };
      t.events++;
      if (e.name === "map_generated") t.maps++;
      if (e.name === "relationship_explored") t.explored++;
      if (e.name === "report_requested") t.reports++;
      testers.set(e.tester, t);
    }
  }
  const order: string[] = [...CLIENT_EVENTS, ...SERVER_EVENTS];
  return {
    sinceDays,
    counts: [...counts.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)),
    testers: [...testers.entries()].map(([tester, v]) => ({ tester, ...v })).sort((a, b) => b.events - a.events),
    uniqueSessions: { real: sessions.real.size, simulated: sessions.simulated.size },
  };
}

export function _resetMemoryAnalyticsForTesting() {
  memory.length = 0;
}
