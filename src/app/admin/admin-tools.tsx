"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export function AdminGrant() {
  const [ecosystem, setEcosystem] = useState("");
  const [tier, setTier] = useState<"basic" | "comprehensive">("comprehensive");
  const [days, setDays] = useState(14);
  const [result, setResult] = useState<{ link: string; business: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    const res = await fetch("/api/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ecosystem, tier, days }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Couldn't create the link.");
    else setResult(data);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-panel p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_110px]">
        <div className="space-y-1">
          <Label htmlFor="grant-ecosystem">Ecosystem link or ID</Label>
          <Input id="grant-ecosystem" value={ecosystem} onChange={(e) => setEcosystem(e.target.value)} placeholder="https://…/ecosystem/…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="grant-tier">Report</Label>
          <Select id="grant-tier" value={tier} onChange={(e) => setTier(e.target.value as "basic" | "comprehensive")}>
            <option value="comprehensive">Comprehensive</option>
            <option value="basic">Basic</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="grant-days">Valid (days)</Label>
          <Input id="grant-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value) || 14)} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={!ecosystem.trim()}>Create demo link</Button>
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      {result && (
        <div className="space-y-2 rounded-md bg-subtle p-3">
          <div className="text-[12.5px]">Demo link for <strong>{result.business}</strong>. Opening it unlocks the full report in that browser.</div>
          <div className="flex gap-2">
            <Input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} aria-label="Demo link" />
            <Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function AdminSignOut() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.reload();
      }}
    >
      Sign out
    </Button>
  );
}

