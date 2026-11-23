"use client";

import { RotateCcw } from "lucide-react";
import { CRITERIA } from "@/lib/schema";
import { CRITERION_META, WEIGHT_PRESETS, type Weights } from "@/lib/scoring";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function WeightsPanel({
  preset,
  weights,
  onChange,
}: {
  preset: string;
  weights: Weights;
  onChange: (preset: string, weights: Weights) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Prioritisation preset</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(WEIGHT_PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key, { ...p.weights })}
              className={cn(
                "rounded-md border px-2.5 py-2 text-left transition-colors",
                preset === key ? "border-ink bg-ink text-white" : "border-line bg-panel hover:bg-subtle",
              )}
            >
              <div className="text-[12.5px] font-medium">{p.label}</div>
              <div className={cn("text-[11px] leading-snug", preset === key ? "text-white/70" : "text-ink-3")}>{p.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Criteria weights</div>
          <button
            type="button"
            onClick={() => onChange("balanced", { ...WEIGHT_PRESETS.balanced.weights })}
            className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-ink"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        </div>
        <ul className="space-y-2.5">
          {CRITERIA.map((k) => (
            <li key={k}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-ink-2" title={CRITERION_META[k].question}>{CRITERION_META[k].label}</span>
                <span className="font-mono text-[11px] text-ink-3">{weights[k]}</span>
              </div>
              <Slider
                min={0}
                max={3}
                step={1}
                value={[weights[k]]}
                onValueChange={([v]) => onChange("custom", { ...weights, [k]: v })}
                aria-label={`${CRITERION_META[k].label} weight`}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
          Scores are a weighted average of 1–5 strategic ratings. They rank where to start. They do not estimate referral volume,
          conversion rates, or revenue.
        </p>
      </div>
    </div>
  );
}
