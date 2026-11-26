import { byCategoryAllPeriods, byDay, byHourToday, listRecent, nutritionTotals, totals } from "@/lib/db";
import DashboardClient from "@/components/DashboardClient";
import { CalendarIcon, LogOutIcon, WalletIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [t, days30, hoursToday, catsByPeriod, nutritionByPeriod, recent] = await Promise.all([
    totals(),
    byDay(30),
    byHourToday(),
    byCategoryAllPeriods(),
    nutritionTotals(),
    listRecent(150),
  ]);

  const now = new Date();
  const nowJakarta = now.toLocaleDateString("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const dayOfMonth =
    Number(
      now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
      }),
    ) || 1;

  const weekdayShort = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
  });
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dayOfWeek = weekdayMap[weekdayShort] ?? 1;

  return (
    <div className="min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <a
        href="#main-content"
        className="focus-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold"
        style={{ background: "var(--accent-primary)", color: "var(--accent-on-primary)" }}
      >
        Skip to main content
      </a>

      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md pt-[env(safe-area-inset-top)]"
        style={{
          background: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
            >
              <WalletIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
                <span className="sm:hidden">Expense Tracker</span>
                <span className="hidden sm:inline">Expense &amp; Nutrition Tracker</span>
              </h1>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{nowJakarta} · WIB</span>
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

      <DashboardClient
        totals={t}
        days30={days30}
        hoursToday={hoursToday}
        catsByPeriod={catsByPeriod}
        nutritionByPeriod={nutritionByPeriod}
        recent={recent}
        dayOfMonth={dayOfMonth}
        dayOfWeek={dayOfWeek}
      />
    </div>
  );
}
