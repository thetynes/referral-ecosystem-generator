"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { clientStore } from "@/lib/client-store";

function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState("Confirming your payment…");

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setMsg("Missing checkout session.");
      return;
    }
    let attempts = 0;
    const tryVerify = async () => {
      attempts++;
      const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        clientStore.setEntitlement(data.analysisId, data.token);
        router.replace(`/ecosystem/${data.analysisId}?unlocked=1`);
      } else if (data.pending && attempts < 10) {
        setTimeout(tryVerify, 2000);
      } else {
        setMsg(data.error ?? "We couldn't confirm the payment. If you were charged, contact support with your receipt.");
      }
    };
    tryVerify();
  }, [params, router]);

  return (
    <p className="flex items-center justify-center gap-2 text-[14px] text-ink-2">
      {msg.startsWith("Confirming") && <Loader2 className="size-4 animate-spin" />} {msg}
    </p>
  );
}

export default function CheckoutSuccess() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <Suspense fallback={null}>
          <Verify />
        </Suspense>
      </main>
    </>
  );
}
