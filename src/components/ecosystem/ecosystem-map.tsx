"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getStraightPath,
  getViewportForBounds,
  useInternalNode,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { ChevronDown, ChevronRight, Repeat2, Check } from "lucide-react";
import type { BusinessProfile, RelationshipType, ScoredCategory } from "@/lib/schema";
import { layoutEcosystem, NODE_SIZES } from "@/lib/graph-layout";
import { TYPE_META, DIRECTION_META } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

/* ---------------- nodes ---------------- */

type CenterData = { name: string; industry: string; area: string };
type HubData = { type: RelationshipType; count: number; collapsed: boolean; onToggle: (t: RelationshipType) => void };
type PartnerData = { category: ScoredCategory; selected: boolean; dimmed: boolean };

const hidden = { top: "50%", left: "50%" } as const;
function CenterHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={hidden} isConnectable={false} />
      <Handle type="source" position={Position.Top} style={hidden} isConnectable={false} />
    </>
  );
}

const CenterNode = memo(function CenterNode({ data }: NodeProps<Node<CenterData>>) {
  return (
    <div
      className="flex flex-col justify-center rounded-xl bg-ink px-4 text-white shadow-[0_8px_24px_rgba(14,17,22,0.18)]"
      style={{ width: NODE_SIZES.center.w, height: NODE_SIZES.center.h }}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">Your business</div>
      <div className="truncate text-[15px] font-semibold">{data.name}</div>
      <div className="truncate text-[11.5px] text-white/60">
        {data.industry} · {data.area}
      </div>
      <CenterHandles />
    </div>
  );
});

const HubNode = memo(function HubNode({ data }: NodeProps<Node<HubData>>) {
  const meta = TYPE_META[data.type];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        data.onToggle(data.type);
      }}
      className="nodrag flex items-center gap-2 rounded-full border bg-panel px-3 text-left text-[12.5px] font-medium text-ink shadow-sm hover:bg-subtle"
      style={{ width: NODE_SIZES.hub.w, height: NODE_SIZES.hub.h, borderColor: meta.color }}
      aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${meta.label}`}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
      <span className="min-w-0 flex-1 truncate">{meta.short}</span>
      <span className="font-mono text-[11px] text-ink-3">{data.count}</span>
      {data.collapsed ? <ChevronRight className="size-3.5 text-ink-3" /> : <ChevronDown className="size-3.5 text-ink-3" />}
      <CenterHandles />
    </button>
  );
});

const PRIORITY_STYLE = {
  High: "bg-high-soft text-high",
  Medium: "bg-medium-soft text-medium",
  Low: "bg-low-soft text-low",
};

const PartnerNode = memo(function PartnerNode({ data }: NodeProps<Node<PartnerData>>) {
  const c = data.category;
  const meta = TYPE_META[c.relationshipType];
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border bg-panel text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[opacity,box-shadow]",
        data.selected ? "border-ink ring-2 ring-ink/10" : "border-line hover:border-line-2 hover:shadow-md",
        data.dimmed && "opacity-50",
      )}
      style={{ width: NODE_SIZES.partner.w, height: NODE_SIZES.partner.h }}
      data-testid={`node-${c.id}`}
    >
      <div className="w-1 shrink-0" style={{ background: meta.color }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2.5">
        <div className="line-clamp-2 text-[12.5px] font-medium leading-[1.25] text-ink">{c.name}</div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
          <span className={cn("rounded px-1.5 py-px font-medium", PRIORITY_STYLE[c.priority])}>
            {c.priority} <span className="font-mono opacity-70">{c.score}</span>
          </span>
          {c.channelType === "recurring" && (
            <span className="inline-flex items-center gap-0.5" title="Potential recurring channel">
              <Repeat2 className="size-3" /> recurring
            </span>
          )}
          {c.existingRelationship && (
            <span className="inline-flex items-center gap-0.5 text-high" title="You mentioned an existing relationship">
              <Check className="size-3" /> existing
            </span>
          )}
        </div>
      </div>
      <CenterHandles />
    </div>
  );
});

const nodeTypes = { center: CenterNode, hub: HubNode, partner: PartnerNode };

/* ---------------- floating edge ---------------- */

function rectIntersection(from: InternalNode, to: InternalNode) {
  const w = (from.measured.width ?? 0) / 2;
  const h = (from.measured.height ?? 0) / 2;
  const cx = from.internals.positionAbsolute.x + w;
  const cy = from.internals.positionAbsolute.y + h;
  const tx = to.internals.positionAbsolute.x + (to.measured.width ?? 0) / 2;
  const ty = to.internals.positionAbsolute.y + (to.measured.height ?? 0) / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w || 1), Math.abs(dy) / (h || 1));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

type EdgeData = { color: string; dashed: boolean; width: number; label?: string; showLabel: boolean };

function FloatingEdge({ id, source, target, markerEnd, markerStart, data }: EdgeProps<Edge<EdgeData>>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const a = rectIntersection(s, t);
  const b = rectIntersection(t, s);
  const [path, lx, ly] = getStraightPath({ sourceX: a.x, sourceY: a.y, targetX: b.x, targetY: b.y });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ stroke: data.color, strokeWidth: data.width, strokeDasharray: data.dashed ? "5 4" : undefined, opacity: 0.85 }}
      />
      {data.showLabel && data.label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-line bg-panel px-2 py-0.5 text-[10.5px] font-medium text-ink-2 shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { floating: FloatingEdge };

/* ---------------- map ---------------- */

export interface EcosystemMapHandle {
  exportPng: (filename: string) => Promise<void>;
  fit: () => void;
}

interface Props {
  profile: BusinessProfile;
  categories: ScoredCategory[];
  visibleTypes: Set<RelationshipType>;
  collapsed: Set<RelationshipType>;
  onToggleCollapse: (t: RelationshipType) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  interactive?: boolean;
}

const InnerMap = forwardRef<EcosystemMapHandle, Props>(function InnerMap(
  { profile, categories, visibleTypes, collapsed, onToggleCollapse, selectedId, onSelect, className, interactive = true },
  ref,
) {
  const rf = useReactFlow();
  const layout = useMemo(() => layoutEcosystem(categories, { visibleTypes, collapsed }), [categories, visibleTypes, collapsed]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const nodes: Node[] = useMemo(
    () =>
      layout.nodes.map((n) => {
        if (n.kind === "center") {
          return {
            id: n.id, type: "center", position: { x: n.x, y: n.y }, draggable: false, selectable: false,
            data: { name: profile.displayName, industry: profile.industry, area: profile.serviceArea } satisfies CenterData,
          };
        }
        if (n.kind === "hub") {
          return {
            id: n.id, type: "hub", position: { x: n.x, y: n.y }, draggable: false, selectable: false,
            data: { type: n.type!, count: n.count!, collapsed: Boolean(n.collapsed), onToggle: onToggleCollapse } satisfies HubData,
          };
        }
        const c = byId.get(n.categoryId!)!;
        return {
          id: n.id, type: "partner", position: { x: n.x, y: n.y }, draggable: interactive, selectable: false,
          data: { category: c, selected: selectedId === c.id, dimmed: Boolean(selectedId && selectedId !== c.id) } satisfies PartnerData,
        };
      }),
    [layout, byId, profile, selectedId, onToggleCollapse, interactive],
  );

  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((e) => {
        const color = e.type ? TYPE_META[e.type].color : "#999";
        if (e.kind === "spine") {
          return { id: e.id, source: e.source, target: e.target, type: "floating", data: { color, dashed: false, width: 2.25, showLabel: false } };
        }
        const marker = { type: MarkerType.ArrowClosed, color, width: 14, height: 14 };
        const width = e.priority === "High" ? 2.4 : e.priority === "Medium" ? 1.6 : 1.1;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "floating",
          markerEnd: marker,
          markerStart: e.direction === "reciprocal" ? marker : undefined,
          data: {
            color,
            dashed: e.channelType === "occasional",
            width,
            label: e.direction ? DIRECTION_META[e.direction].label : undefined,
            showLabel: selectedId === e.categoryId,
          },
        };
      }),
    [layout, selectedId],
  );

  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const t = setTimeout(() => rf.fitView({ padding: 0.08, duration: 250 }), 50);
    return () => clearTimeout(t);
  }, [rf, initialized, visibleTypes, collapsed, categories.length]);

  const exportPng = useCallback(
    async (filename: string) => {
      const all = rf.getNodes();
      const bounds = getNodesBounds(all);
      const width = Math.min(3200, Math.max(1200, bounds.width + 160));
      const height = Math.min(2400, Math.max(900, bounds.height + 160));
      const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.08);
      const el = document.querySelector<HTMLElement>(".ecosystem-map .react-flow__viewport");
      if (!el) throw new Error("Map not ready");
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        width,
        height,
        pixelRatio: 2,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    },
    [rf],
  );

  useImperativeHandle(ref, () => ({ exportPng, fit: () => rf.fitView({ padding: 0.12, duration: 300 }) }), [exportPng, rf]);

  return (
    <div className={cn("ecosystem-map relative h-full w-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, n) => {
          if (n.type === "partner") onSelect((n.data as PartnerData).category.id);
        }}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.2}
        maxZoom={1.8}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={interactive}
        panOnDrag={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={false}
        preventScrolling={interactive}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#e3e5ea" />
        {interactive && <Controls showInteractive={false} position="bottom-right" />}
      </ReactFlow>
    </div>
  );
});

export const EcosystemMap = forwardRef<EcosystemMapHandle, Props>(function EcosystemMap(props, ref) {
  return (
    <ReactFlowProvider>
      <InnerMap {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export function MapLegend({ types }: { types: RelationshipType[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-3">
      {types.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: TYPE_META[t].color }} />
          {TYPE_META[t].short}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#6b7280" strokeWidth="2" /></svg>
        recurring channel
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
        occasional
      </span>
      <span>Arrows show referral direction · line weight shows priority</span>
    </div>
  );
}
