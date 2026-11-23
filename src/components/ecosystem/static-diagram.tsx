import type { BusinessProfile, RelationshipType, ScoredCategory } from "@/lib/schema";
import { layoutEcosystem, NODE_SIZES } from "@/lib/graph-layout";
import { TYPE_META, TYPE_ORDER } from "@/lib/ui-meta";

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function wrap(text: string, max: number, lines = 2): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
      if (out.length === lines) break;
    } else cur = `${cur} ${w}`;
  }
  if (out.length < lines && cur.trim()) out.push(cur.trim());
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = `${truncate(out[lines - 1], max - 1).replace(/…$/, "")}…`;
  return out;
}

/** Non-interactive SVG rendering of the ecosystem — used in the printable report and on small screens. */
export function StaticDiagram({ profile, categories }: { profile: BusinessProfile; categories: ScoredCategory[] }) {
  const { nodes, edges } = layoutEcosystem(categories, { visibleTypes: new Set(TYPE_ORDER), collapsed: new Set<RelationshipType>() });
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const size = (k: string) => (k === "center" ? NODE_SIZES.center : k === "hub" ? NODE_SIZES.hub : NODE_SIZES.partner);
  const xs = nodes.flatMap((n) => [n.x, n.x + size(n.kind).w]);
  const ys = nodes.flatMap((n) => [n.y, n.y + size(n.kind).h]);
  const pad = 20;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const h = Math.max(...ys) - minY + pad;
  const center = (id: string) => {
    const n = pos.get(id)!;
    const s = size(n.kind);
    return { x: n.x + s.w / 2, y: n.y + s.h / 2 };
  };
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Referral ecosystem diagram">
      {edges.map((e) => {
        const a = center(e.source);
        const b = center(e.target);
        const color = e.type ? TYPE_META[e.type].color : "#999";
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={e.kind === "spine" ? 2.5 : e.priority === "High" ? 2.2 : 1.3}
            strokeDasharray={e.channelType === "occasional" ? "5 4" : undefined}
          />
        );
      })}
      {nodes.map((n) => {
        const s = size(n.kind);
        if (n.kind === "center") {
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={s.w} height={s.h} rx={12} fill="#0e1116" />
              <text x={n.x + 14} y={n.y + 34} fill="#fff" fontSize={15} fontWeight={600}>{truncate(profile.displayName, 24)}</text>
              <text x={n.x + 14} y={n.y + 54} fill="#ffffffa0" fontSize={11}>{truncate(profile.industry, 32)}</text>
            </g>
          );
        }
        if (n.kind === "hub") {
          const color = TYPE_META[n.type!].color;
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={s.w} height={s.h} rx={22} fill="#fff" stroke={color} />
              <circle cx={n.x + 16} cy={n.y + s.h / 2} r={4} fill={color} />
              <text x={n.x + 28} y={n.y + s.h / 2 + 4} fontSize={12.5} fontWeight={500} fill="#0e1116">{TYPE_META[n.type!].short} ({n.count})</text>
            </g>
          );
        }
        const c = byId.get(n.categoryId!)!;
        const lines = wrap(c.name, 30);
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={s.w} height={s.h} rx={8} fill="#fff" stroke="#e6e8ec" />
            <rect x={n.x} y={n.y} width={4} height={s.h} fill={TYPE_META[c.relationshipType].color} />
            {lines.map((l, i) => (
              <text key={i} x={n.x + 12} y={n.y + 22 + i * 15} fontSize={12} fontWeight={500} fill="#0e1116">{l}</text>
            ))}
            <text x={n.x + 12} y={n.y + s.h - 10} fontSize={10.5} fill="#6b7280">{c.priority} priority · {c.score}</text>
          </g>
        );
      })}
    </svg>
  );
}
