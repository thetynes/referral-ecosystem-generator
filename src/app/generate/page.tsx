import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/site/header";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = {
  title: "Generate your referral ecosystem",
  description: "Describe your business in under two minutes and get an interactive map of the organisations most likely to send you customers.",
};

export default function GeneratePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 space-y-2">
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">Map your referral ecosystem</h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-ink-3">
            Four required answers. Everything else is optional and only sharpens the analysis. No account is needed. Your analysis is saved in
            this browser.
          </p>
        </div>
        <IntakeForm />
      </main>
      <SiteFooter />
    </>
  );
}
