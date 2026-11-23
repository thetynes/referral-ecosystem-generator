"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { clientStore, type SavedSummary } from "@/lib/client-store";
import { Button } from "@/components/ui/button";

export default function SavedPage() {
  const [items, setItems] = useState<SavedSummary[] | null>(null);
  useEffect(() => setItems(clientStore.listSaved()), []);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Saved ecosystems</h1>
        <p className="mt-1 text-[13px] text-ink-3">Stored in this browser only. Clearing site data removes them.</p>
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-panel">
          {items?.length === 0 && <li className="p-6 text-center text-[13px] text-ink-3">Nothing saved yet. <Link className="text-accent hover:underline" href="/generate">Generate an ecosystem</Link>.</li>}
          {items?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4">
              <Link href={`/ecosystem/${s.id}`} className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink hover:text-accent">{s.name}</div>
                <div className="truncate text-[12.5px] text-ink-3">{s.industry} · {new Date(s.createdAt).toLocaleDateString()}</div>
              </Link>
              <Button variant="ghost" size="icon" aria-label={`Remove ${s.name}`} onClick={() => { clientStore.removeSaved(s.id); setItems(clientStore.listSaved()); }}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
