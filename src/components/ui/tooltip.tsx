"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";

export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="z-50 max-w-[260px] rounded-md bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-white shadow-lg">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
