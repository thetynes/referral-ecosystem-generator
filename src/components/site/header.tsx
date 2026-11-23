import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="3.2" fill="#0e1116" />
        <circle cx="11" cy="3" r="1.8" fill="#2f5bd3" />
        <circle cx="18.5" cy="14" r="1.8" fill="#0f8a7e" />
        <circle cx="3.5" cy="14" r="1.8" fill="#c0482f" />
        <path d="M11 4.8V7.8M17 13.2l-3.1-1.2M5 13.2l3.1-1.2" stroke="#9aa1ad" strokeWidth="1.1" />
      </svg>
      Referral Ecosystem
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-[13px]">
          <Link href="/ecosystem/demo" className="hidden rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-subtle sm:block">Example</Link>
          <Link href="/#pricing" className="hidden rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-subtle sm:block">Pricing</Link>
          <Link href="/saved" className="rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-subtle">Saved</Link>
          <Link href="/generate" className="ml-1 rounded-md bg-ink px-3 py-1.5 font-medium text-white hover:bg-ink/85">Generate</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-[12.5px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Referral Ecosystem Generator. Strategic analysis, not legal or financial advice.</span>
        <span>Never sends outreach on your behalf. Never invents businesses.</span>
      </div>
    </footer>
  );
}
