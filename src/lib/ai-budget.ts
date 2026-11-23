/**
 * AI spend controls: who may use AI, daily/monthly USD caps, and per-tester daily run limits.
 * Costs are estimated from token usage × configured per-million-token prices.
 *
 * The store is not transactional, so concurrent requests can overshoot a cap slightly; the
 * pre-run reservation check (estimated cost per run) keeps the overshoot to roughly one run.
 */
import { config } from "./config";
import { getStore } from "./store";
import type { TokenUsage } from "./llm";

const day = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

interface SpendRecord {
  usd: number;
  inputTokens: number;
  outputTokens: number;
  runs: number;
}
const EMPTY: SpendRecord = { usd: 0, inputTokens: 0, outputTokens: 0, runs: 0 };

export function costOf(usage: TokenUsage): number {
  const { llm } = config();
  return (usage.inputTokens * llm.priceInputPerMTok + usage.outputTokens * llm.priceOutputPerMTok) / 1_000_000;
}

export type AiDecision = { allowed: true } | { allowed: false; reason: string; silent?: boolean };

/** Decide whether this request may use the AI provider (assumes a provider is configured). */
export async function checkAiAllowance(tester: string | null): Promise<AiDecision> {
  const { llm } = config();
  if (llm.access === "none") return { allowed: false, reason: "AI analysis is disabled.", silent: true };
  if (llm.access === "testers" && !tester) return { allowed: false, reason: "AI analysis is limited to invited testers.", silent: true };

  const store = await getStore();
  const [d, m] = await Promise.all([
    store.get<SpendRecord>("ai_budget", `day:${day()}`),
    store.get<SpendRecord>("ai_budget", `month:${month()}`),
  ]);
  const est = llm.estimatedRunCostUsd;
  if ((d?.usd ?? 0) + est > llm.dailyBudgetUsd) return { allowed: false, reason: "Today's AI budget has been reached." };
  if ((m?.usd ?? 0) + est > llm.monthlyBudgetUsd) return { allowed: false, reason: "This month's AI budget has been reached." };
  if (tester) {
    const runs = (await store.get<number>("ai_budget", `tester:${tester}:${day()}`)) ?? 0;
    if (runs >= llm.perTesterDailyRuns) return { allowed: false, reason: "You've reached today's AI analysis limit." };
  }
  return { allowed: true };
}

/** Record actual spend after a run (or a partial run that failed after spending tokens). */
export async function recordAiSpend(usage: TokenUsage, tester: string | null, countRun = true): Promise<number> {
  const usd = costOf(usage);
  const store = await getStore();
  const add = (r: SpendRecord | null): SpendRecord => ({
    usd: (r?.usd ?? 0) + usd,
    inputTokens: (r?.inputTokens ?? 0) + usage.inputTokens,
    outputTokens: (r?.outputTokens ?? 0) + usage.outputTokens,
    runs: (r?.runs ?? 0) + (countRun ? 1 : 0),
  });
  const dk = `day:${day()}`;
  const mk = `month:${month()}`;
  await store.set("ai_budget", dk, add(await store.get<SpendRecord>("ai_budget", dk)), 60 * 60 * 24 * 40);
  await store.set("ai_budget", mk, add(await store.get<SpendRecord>("ai_budget", mk)), 60 * 60 * 24 * 400);
  if (tester && countRun) {
    const tk = `tester:${tester}:${day()}`;
    await store.set("ai_budget", tk, ((await store.get<number>("ai_budget", tk)) ?? 0) + 1, 60 * 60 * 48);
  }
  return usd;
}

export async function spendSummary() {
  const store = await getStore();
  const { llm } = config();
  const [d, m] = await Promise.all([
    store.get<SpendRecord>("ai_budget", `day:${day()}`),
    store.get<SpendRecord>("ai_budget", `month:${month()}`),
  ]);
  return {
    today: d ?? EMPTY,
    month: m ?? EMPTY,
    dailyBudgetUsd: llm.dailyBudgetUsd,
    monthlyBudgetUsd: llm.monthlyBudgetUsd,
    pricing: { inputPerMTok: llm.priceInputPerMTok, outputPerMTok: llm.priceOutputPerMTok },
  };
}
