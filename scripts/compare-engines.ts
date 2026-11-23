/**
 * Live comparison of the AI pipeline against the curated knowledge base.
 *
 *   OPENAI_API_KEY=... LLM_PROVIDER=openai OPENAI_MODEL=gpt-5.5 npm run compare:engines
 *   (or ANTHROPIC_API_KEY=... LLM_PROVIDER=anthropic)
 *
 * Spend is capped by AI_DAILY_BUDGET_USD / AI_MONTHLY_BUDGET_USD exactly like the app.
 * Writes docs/beta/samples/<slug>.{curated,ai}.json and docs/beta/samples/comparison.json.
 * Pass a slug as the first argument to run a single sample.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAnalysis } from "@/lib/engine";
import { rankCategories } from "@/lib/scoring";
import { spendSummary } from "@/lib/ai-budget";
import { MemoryStore, setStoreForTesting } from "@/lib/store";
import type { Analysis } from "@/lib/schema";
import { SAMPLES } from "./samples";

setStoreForTesting(new MemoryStore());

const outDir = path.resolve("docs/beta/samples");
mkdirSync(outDir, { recursive: true });

const STOP = new Set(["and", "with", "that", "your", "firms", "companies", "services", "providers", "contractors", "their"]);
function words(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => w.replace(/s$/, "")),
  );
}
function similar(a: string, b: string) {
  const A = words(a);
  const B = words(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

function summary(a: Analysis) {
  return rankCategories(a.categories).map((c) => ({
    name: c.name,
    type: c.relationshipType,
    priority: c.priority,
    score: c.score,
    overlooked: c.overlooked,
    decisionMaker: c.decisionMaker,
  }));
}

async function main() {
  const only = process.argv[2];
  const comparison: Record<string, unknown>[] = [];
  for (const s of SAMPLES.filter((x) => !only || x.slug === only)) {
    const curated = await generateAnalysis(s.input, { forceKnowledgeBase: true });
    writeFileSync(path.join(outDir, `${s.slug}.curated.json`), JSON.stringify(curated, null, 2));
    const t0 = Date.now();
    const ai = await generateAnalysis(s.input, { ai: { requested: true, tester: "eval" } });
    const seconds = Math.round((Date.now() - t0) / 1000);
    writeFileSync(path.join(outDir, `${s.slug}.ai.json`), JSON.stringify(ai, null, 2));

    const cNames = curated.categories.map((c) => c.name);
    const aNames = ai.categories.map((c) => c.name);
    const matched = aNames.filter((n) => cNames.some((c) => similar(n, c) >= 0.5));
    comparison.push({
      slug: s.slug,
      curatedProfile: curated.engine.archetypeLabel,
      aiMode: ai.engine.mode,
      aiModel: ai.engine.model,
      aiNotes: ai.engine.notes,
      seconds,
      costUsd: ai.engine.costUsd ?? null,
      curatedCount: cNames.length,
      aiCount: aNames.length,
      overlapApprox: matched.length,
      aiOnly: aNames.filter((n) => !matched.includes(n)),
      curatedOnly: cNames.filter((c) => !aNames.some((n) => similar(n, c) >= 0.5)),
      curated: summary(curated),
      ai: summary(ai),
    });
    console.log(
      `== ${s.slug}: ${ai.engine.mode} (${seconds}s, $${(ai.engine.costUsd ?? 0).toFixed(3)}) curated=${cNames.length} ai=${aNames.length} overlap~${matched.length}`,
    );
    if (ai.engine.notes.length) console.log("   notes:", ai.engine.notes.join(" | "));
  }
  writeFileSync(path.join(outDir, only ? `comparison.${only}.json` : "comparison.json"), JSON.stringify(comparison, null, 2));
  console.log("spend:", JSON.stringify(await spendSummary()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
