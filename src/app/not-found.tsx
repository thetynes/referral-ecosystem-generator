import Link from "next/link";
import { SiteHeader } from "@/components/site/header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-ink-3">The page you are looking for doesn't exist.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">Back to home</Link>
      </main>
    </>
  );
}
