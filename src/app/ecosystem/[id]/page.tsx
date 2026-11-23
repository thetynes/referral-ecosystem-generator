import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { Workspace } from "@/components/ecosystem/workspace";

export const metadata: Metadata = { title: "Referral ecosystem", robots: { index: false } };

export default async function EcosystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <Workspace id={id} />
    </>
  );
}
