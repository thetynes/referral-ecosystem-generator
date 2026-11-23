"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (res.ok) window.location.reload();
    else setError("Invalid key.");
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" aria-label="Admin key" />
      {error && <p className="text-[12.5px] text-[#b42318]">{error}</p>}
      <Button type="submit" className="w-full">Sign in</Button>
    </form>
  );
}
