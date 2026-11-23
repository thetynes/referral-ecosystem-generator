import type { Direction, RelationshipType } from "./schema";

export const TYPE_META: Record<RelationshipType, { label: string; short: string; color: string; description: string }> = {
  upstream: {
    label: "Upstream referral sources",
    short: "Upstream",
    color: "var(--color-upstream)",
    description: "Encounter your customer before they need you. Often they diagnose the problem, advise, or plan the work.",
  },
  complementary: {
    label: "Complementary providers",
    short: "Complementary",
    color: "var(--color-complementary)",
    description: "Serve the same customer without competing, with natural handoffs in both directions.",
  },
  downstream: {
    label: "Downstream relationships",
    short: "Downstream",
    color: "var(--color-downstream)",
    description: "Serve the customer after you, creating reciprocal and follow-on opportunities.",
  },
  shared_audience: {
    label: "Shared-audience partners",
    short: "Shared audience",
    color: "var(--color-shared)",
    description: "Reach the same customer profile. Best for education, content, and co-marketing.",
  },
  distribution: {
    label: "Commercial distribution channels",
    short: "Distribution",
    color: "var(--color-distribution)",
    description: "Organisations that could introduce your services repeatedly, not just occasionally.",
  },
};

export const TYPE_ORDER: RelationshipType[] = ["upstream", "distribution", "complementary", "downstream", "shared_audience"];

export const DIRECTION_META: Record<Direction, { label: string; arrow: string }> = {
  inbound: { label: "They refer to you", arrow: "→ you" },
  outbound: { label: "You refer to them", arrow: "you →" },
  reciprocal: { label: "Two-way referrals", arrow: "↔" },
};
