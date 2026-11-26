import Link from "next/link";
import { getSettings } from "@/lib/db";
import { ArrowLeftIcon, LogOutIcon, SettingsIcon } from "@/components/Icons";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md pt-[env(safe-area-inset-top)]"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Back to Dashboard"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-base font-bold tracking-tight sm:text-lg">
                <SettingsIcon className="h-4 w-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
                <span>Targets &amp; Quotas</span>
              </h1>
              <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                Configure spending budgets &amp; daily nutrition goals
              </p>
            </div>
          </div>

          <form method="post" action="/api/logout" className="shrink-0">
            <button
              type="submit"
              className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-150 active:opacity-80 sm:min-h-11 sm:px-3.5 sm:text-sm"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6 sm:pt-7">
        <SettingsForm initial={settings} />
      </main>
    </div>
  );
}
