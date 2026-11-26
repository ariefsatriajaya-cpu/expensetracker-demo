import { byCategory, byDay, listRecent, nutritionTotals, totals } from "@/lib/db";
import { rp } from "@/lib/format";
import { CategoryChart, DailyChart } from "@/components/Charts";
import {
  CalendarIcon,
  FlameIcon,
  LogOutIcon,
  PieChartIcon,
  SendIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@/components/Icons";
import RecentList from "@/components/RecentList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [t, days, cats, recent, nutri] = await Promise.all([
    totals(),
    byDay(30),
    byCategory(),
    listRecent(50),
    nutritionTotals(),
  ]);

  const nowJakarta = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const dayOfMonth = Number(
    new Date().toLocaleDateString("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
    }),
  ) || 1;
  const dailyAvg = Math.round(t.month / dayOfMonth);

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

      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 sm:px-6 sm:pt-7"
      >
        {/* Bento Summary Cards: Spending + Today's Nutrition */}
        <section aria-label="Spending and nutrition summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div
            className="glass-card col-span-2 rounded-2xl p-5 lg:col-span-1"
            style={{
              borderColor: "var(--border-strong)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
                This Month
              </p>
              <span
                className="rounded-lg px-2 py-0.5 font-mono text-xs font-medium tabular-nums"
                style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
              >
                ~{rp(dailyAvg)}/day
              </span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums">
              {rp(t.month)}
            </p>
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              Month-to-date across {cats.length || 0} active {cats.length === 1 ? "category" : "categories"}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Today
            </p>
            <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
              {rp(t.today)}
            </p>
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              Asia/Jakarta
            </p>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              This Week
            </p>
            <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
              {rp(t.week)}
            </p>
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              Mon – Sun
            </p>
          </div>

          {/* Today's Nutrition Card */}
          <div
            className="glass-card col-span-2 rounded-2xl p-4 sm:p-5 lg:col-span-1"
            style={{ borderColor: "var(--border-strong)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--cat-groceries-fg)" }}>
                <FlameIcon className="h-3.5 w-3.5" />
                <span>Today&apos;s Nutrition</span>
              </p>
              <span
                className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums"
                style={{ background: "var(--cat-groceries-bg)", color: "var(--cat-groceries-fg)" }}
              >
                {nutri.todayLoggedItems} {nutri.todayLoggedItems === 1 ? "meal" : "meals"}
              </span>
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
              {nutri.todayCalories.toLocaleString("id-ID")}{" "}
              <span className="text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                kcal
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-medium tabular-nums">
              <span
                className="rounded-md px-1.5 py-0.5"
                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
              >
                P {nutri.todayProtein}g
              </span>
              <span
                className="rounded-md px-1.5 py-0.5"
                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
              >
                C {nutri.todayCarbs}g
              </span>
              <span
                className="rounded-md px-1.5 py-0.5"
                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
              >
                F {nutri.todayFat}g
              </span>
            </div>
          </div>
        </section>

        {/* Telegram Quick Command Banner */}
        <section
          aria-label="Telegram bot quick tip"
          className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--trust-soft)", color: "var(--trust-blue)" }}
            >
              <SendIcon className="h-4 w-4" />
            </div>
            <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
              <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Telegram Expense &amp; Nutrition AI:
              </strong>{" "}
              send <code className="font-mono">geprek 22k</code> (or a meal photo + caption) to log expense &amp; macros,{" "}
              <code className="font-mono">/recalc 1</code> to recalculate an earlier meal, or{" "}
              <code className="font-mono">/nutri bakso</code> to check nutrition only.
            </p>
          </div>
        </section>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <section className="glass-card flex flex-col rounded-2xl p-5 sm:p-6 lg:col-span-7">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
              >
                <TrendingUpIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold leading-tight sm:text-lg">Spending Trend</h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  Daily totals over the last 30 days
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col">
              <DailyChart data={days} />
            </div>
          </section>

          <section className="glass-card flex flex-col rounded-2xl p-5 sm:p-6 lg:col-span-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--trust-soft)", color: "var(--trust-blue)" }}
              >
                <PieChartIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold leading-tight sm:text-lg">Category Share</h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  Current month distribution
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col">
              <CategoryChart data={cats} />
            </div>
          </section>
        </div>

        {/* Recent Transactions */}
        <section className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Recent Expenses &amp; Nutrition</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Latest {recent.length} entries · food expenses include AI calorie &amp; macro facts
              </p>
            </div>
          </div>
          <RecentList items={recent} />
        </section>
      </main>
    </div>
  );
}
