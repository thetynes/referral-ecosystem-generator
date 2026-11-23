import type { Metadata } from "next";
import { ReportView } from "./report-view";

export const metadata: Metadata = { title: "Partnership Opportunity Report", robots: { index: false } };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView id={id} />;
}
