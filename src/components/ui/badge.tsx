import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", {
  variants: {
    variant: {
      neutral: "bg-subtle text-ink-2 ring-1 ring-inset ring-line",
      high: "bg-high-soft text-high",
      medium: "bg-medium-soft text-medium",
      low: "bg-low-soft text-low",
      accent: "bg-accent-soft text-accent",
      outline: "ring-1 ring-inset ring-line-2 text-ink-2",
      warn: "bg-[#fff4e5] text-[#8a4b00] ring-1 ring-inset ring-[#f5d9a8]",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function PriorityBadge({ priority, score }: { priority: "High" | "Medium" | "Low"; score?: number }) {
  const v = priority === "High" ? "high" : priority === "Medium" ? "medium" : "low";
  return (
    <Badge variant={v}>
      {priority}
      {score !== undefined && <span className="font-mono opacity-70">{score}</span>}
    </Badge>
  );
}
