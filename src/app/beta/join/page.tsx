import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/site/header";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Private preview", robots: { index: false, follow: false } };

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Logo />
      <h1 className="mt-8 text-[22px] font-semibold tracking-tight">Private preview</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
        The Referral Ecosystem Generator is in a closed beta. Enter the invite code you were given.
      </p>
      <Suspense fallback={null}>
        <JoinForm />
      </Suspense>
      <p className="mt-6 text-[12px] leading-relaxed text-ink-4">
        During the beta we record anonymous usage events, such as maps generated and reports opened, attributed to your invite name, to learn
        what is useful. We do not send outreach on your behalf.
      </p>
    </main>
  );
}
