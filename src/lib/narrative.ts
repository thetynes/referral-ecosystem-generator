/**
 * Stage 7 helpers — deterministic narrative built only from the analysis data.
 * No new claims are introduced here.
 */
import type { Analysis, RelationshipType, ScoredCategory } from "./schema";
import { TYPE_META, TYPE_ORDER } from "./ui-meta";

export function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function executiveOverview(analysis: Analysis, ranked: ScoredCategory[]): string[] {
  const p = analysis.profile;
  const paras: string[] = [];
  paras.push(
    `${p.displayName} (${lc(p.industry)}) serves ${lc(p.idealCustomer.replace(/\.$/, ""))} in ${p.serviceArea}.${
      p.services.length ? ` Services include ${p.services.slice(0, 6).join(", ").toLowerCase()}.` : ""
    }`,
  );
  const top = ranked.slice(0, 3).map((c) => lc(c.name));
  const recurring = ranked.slice(0, 5).filter((c) => c.channelType === "recurring");
  if (top.length) {
    paras.push(
      `The highest-priority partner categories under the current weighting are ${list(top)}.${
        recurring.length
          ? ` ${recurring.length === Math.min(5, ranked.length) ? "All of the top five" : `${recurring.length} of the top five`} could become recurring channels rather than occasional referral sources.`
          : ""
      }`,
    );
  }
  const upstream = ranked.filter((c) => c.relationshipType === "upstream").slice(0, 3);
  if (upstream.length) {
    paras.push(
      `Upstream partners (${list(upstream.map((c) => lc(c.name)))}) encounter your customers before they need you. They are often the people who diagnose the problem or plan the work, so they can influence who gets hired before competitors are even considered.`,
    );
  }
  const existing = ranked.filter((c) => c.existingRelationship);
  if (existing.length) {
    paras.push(`You already have relationships in ${list(existing.map((c) => lc(c.name)))}. Deepening those may be faster than starting new ones.`);
  }
  return paras;
}

export function ecosystemFlow(ranked: ScoredCategory[]): { type: RelationshipType; text: string }[] {
  const out: { type: RelationshipType; text: string }[] = [];
  for (const type of TYPE_ORDER) {
    const cats = ranked.filter((c) => c.relationshipType === type);
    if (!cats.length) continue;
    const lead = cats[0];
    const trigger = lead.triggers[0];
    out.push({
      type,
      text: `${TYPE_META[type].short}: ${list(cats.slice(0, 3).map((c) => lc(c.name)))}${cats.length > 3 ? ` and ${cats.length - 3} more` : ""}. For example, ${lc(trigger.event.replace(/\.$/, ""))}, and ${lc(trigger.whoRecognizes)} is usually the first to see it.`,
    });
  }
  return out;
}

export interface ActionItem {
  rank: number;
  categoryId: string;
  name: string;
  priority: ScoredCategory["priority"];
  score: number;
  firstStep: string;
  watchFor: string;
  channelType: ScoredCategory["channelType"];
}

export function actionPlan(ranked: ScoredCategory[], n = 10): ActionItem[] {
  return ranked.slice(0, n).map((c, i) => ({
    rank: i + 1,
    categoryId: c.id,
    name: c.name,
    priority: c.priority,
    score: c.score,
    firstStep: firstSentence(c.approach),
    watchFor: c.triggers[0]?.event ?? "",
    channelType: c.channelType,
  }));
}
