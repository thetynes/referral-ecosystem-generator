"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function JoinForm() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/beta/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    const next = params.get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="code">Invite code</Label>
        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus />
      </div>
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !code.trim()} data-testid="join-submit">
        {busy ? "Checking…" : "Enter preview"}
      </Button>
    </form>
  );
}
