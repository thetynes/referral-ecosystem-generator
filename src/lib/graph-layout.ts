/**
 * Radial layout for the ecosystem map: the business at the centre, one sector per
 * relationship type, a hub node per type (collapsible), and partner nodes on outer rings.
 * Pure function — unit tested.
 */
import type { RelationshipType, ScoredCategory } from "./schema";
import { TYPE_ORDER } from "./ui-meta";

export const NODE_SIZES = {
  center: { w: 220, h: 84 },
  hub: { w: 190, h: 44 },
  partner: { w: 228, h: 68 },
};

export interface LayoutNode {
  id: string;
  kind: "center" | "hub" | "partner";
  x: number;
  y: number;
  type?: RelationshipType;
  categoryId?: string;
  count?: number;
  collapsed?: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  kind: "spine" | "relationship";
  type?: RelationshipType;
  direction?: ScoredCategory["direction"];
  priority?: ScoredCategory["priority"];
  channelType?: ScoredCategory["channelType"];
  categoryId?: string;
}

export function layoutEcosystem(
  categories: ScoredCategory[],
  opts: { visibleTypes: Set<RelationshipType>; collapsed: Set<RelationshipType> },
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [{ id: "center", kind: "center", x: -NODE_SIZES.center.w / 2, y: -NODE_SIZES.center.h / 2 }];
  const edges: LayoutEdge[] = [];

  const groups = TYPE_ORDER.map((type) => ({ type, cats: categories.filter((c) => c.relationshipType === type) })).filter(
    (g) => g.cats.length > 0 && opts.visibleTypes.has(g.type),
  );
  if (groups.length === 0) return { nodes, edges };

  // Allocate angular space proportional to group size (min share for small groups).
  const weights = groups.map((g) => (opts.collapsed.has(g.type) ? 1 : Math.max(2, g.cats.length)));
  const total = weights.reduce((a, b) => a + b, 0);
  let angle = -Math.PI / 2 - (Math.PI * weights[0]) / total; // first group centred at the top

  // Ring radii scale with the number of visible partners so density stays readable.
  const visiblePartners = groups.reduce((n, g) => n + (opts.collapsed.has(g.type) ? 0 : g.cats.length), 0);
  const INNER_R = Math.max(380, Math.round((visiblePartners * 150) / (2 * Math.PI * 0.86)));
  const OUTER_R = INNER_R + 125;
  const HUB_R = Math.max(240, Math.round(INNER_R * 0.55));
  groups.forEach((g, gi) => {
    const span = (2 * Math.PI * weights[gi]) / total;
    const mid = angle + span / 2;
    const hubId = `hub-${g.type}`;
    const collapsed = opts.collapsed.has(g.type);
    nodes.push({
      id: hubId,
      kind: "hub",
      type: g.type,
      count: g.cats.length,
      collapsed,
      x: Math.cos(mid) * HUB_R - NODE_SIZES.hub.w / 2,
      y: Math.sin(mid) * HUB_R - NODE_SIZES.hub.h / 2,
    });
    edges.push({ id: `spine-${g.type}`, source: hubId, target: "center", kind: "spine", type: g.type });

    if (!collapsed) {
      const n = g.cats.length;
      const usable = span * 0.86;
      g.cats.forEach((c, i) => {
        const a = n === 1 ? mid : mid - usable / 2 + (usable * i) / (n - 1);
        const r = n > 2 ? (i % 2 === 0 ? INNER_R : OUTER_R) : INNER_R + 40;
        const nodeId = `cat-${c.id}`;
        nodes.push({
          id: nodeId,
          kind: "partner",
          type: g.type,
          categoryId: c.id,
          x: Math.cos(a) * r - NODE_SIZES.partner.w / 2,
          y: Math.sin(a) * r - NODE_SIZES.partner.h / 2,
        });
        // Edge direction encodes who refers whom; reciprocal edges get arrows on both ends.
        const towardBusiness = c.direction !== "outbound";
        edges.push({
          id: `rel-${c.id}`,
          source: towardBusiness ? nodeId : hubId,
          target: towardBusiness ? hubId : nodeId,
          kind: "relationship",
          type: g.type,
          direction: c.direction,
          priority: c.priority,
          channelType: c.channelType,
          categoryId: c.id,
        });
      });
    }
    angle += span;
  });

  resolveCollisions(nodes);
  return { nodes, edges };
}

const GAP = 14;

function overlaps(a: LayoutNode, b: LayoutNode): boolean {
  const sa = NODE_SIZES[a.kind];
  const sb = NODE_SIZES[b.kind];
  return a.x < b.x + sb.w + GAP && b.x < a.x + sa.w + GAP && a.y < b.y + sb.h + GAP && b.y < a.y + sa.h + GAP;
}

/** Push partner nodes outward along their ray until they no longer overlap any earlier node. */
function resolveCollisions(nodes: LayoutNode[]) {
  const placed: LayoutNode[] = nodes.filter((n) => n.kind !== "partner");
  for (const n of nodes) {
    if (n.kind !== "partner") continue;
    const s = NODE_SIZES.partner;
    let cx = n.x + s.w / 2;
    let cy = n.y + s.h / 2;
    const len = Math.hypot(cx, cy) || 1;
    const ux = cx / len;
    const uy = cy / len;
    for (let i = 0; i < 40 && placed.some((p) => overlaps(n, p)); i++) {
      cx += ux * 30;
      cy += uy * 30;
      n.x = cx - s.w / 2;
      n.y = cy - s.h / 2;
    }
    placed.push(n);
  }
}
