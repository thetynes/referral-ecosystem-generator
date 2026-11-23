"use client";
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...props}>
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-ink" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block size-3.5 rounded-full border border-ink bg-panel shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label={props["aria-label"]}
      />
    </SliderPrimitive.Root>
  );
}
