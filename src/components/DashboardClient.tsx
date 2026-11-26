"use client";

import { useState } from "react";
import { CategoryChart, DailyChart } from "@/components/Charts";
import {
  FlameIcon,
  PieChartIcon,
  SendIcon,
  TrendingUpIcon,
} from "@/components/Icons";
import RecentList from "@/components/RecentList";
import { rp } from "@/lib/format";
import type { Expense, Period, PeriodNutrition } from "@/lib/db";

type Props = {
  totals: { today: number; week: number; month: number };
  days30: { day: string; total: number }[];
  hoursToday: { day: string; total: number }[];
  catsByPeriod: Record<Period, { category: string; total: number }[]>;
  nutritionByPeriod: Record<Period, PeriodNutrition>;
  recent: Expense[];
  dayOfMonth: number;
  dayOfWeek: number;
};

const PERIOD_OPTIONS: Array<{
  id: Period;
  label: string;
  shortLabel: string;
  subtitle: string;
}> = [
  { id: "day", label: "Daily", shortLabel: "Today", subtitle: "Today (00:00 – 23:59 WIB)" },
  { id: "week", label: "Weekly", shortLabel: "This Week", subtitle: "Current week (Mon – Sun)" },
  { id: "month", label: "Monthly", shortLabel: "This Month", subtitle: "Month-to-date overview" },
];

export default function DashboardClient({
  totals,
  days30,
  hoursToday,
  catsByPeriod,
  nutritionByPeriod,
  recent,
  dayOfMonth,
  dayOfWeek,
}: Props) {
  const [period, setPeriod] = useState<Period>("month");

  const activeCats = catsByPeriod[period];
  const activeNutri = nutritionByPeriod[period];

  const trendData =
    period === "day"
      ? hoursToday
      : period === "week"
        ? days30.slice(-7)
        : days30;

  const trendSubtitle =
    period === "day"
      ? "Hourly spending breakdown today (WIB)"
      : period === "week"
        ? "Daily totals over the last 7 days"
        : "Daily totals over the last 30 days";

  const catSubtitle =
    period === "day"
      ? "Today's category distribution"
      : period === "week"
        ? "This week's category distribution"
        : "Current month distribution";

  const nutriTitle =
    period === "day"
      ? "Today's Nutrition"
      : period === "week"
        ? "Weekly Nutrition"
        : "Monthly Nutrition";

  const periodFilteredRecent = recent.filter((e) => {
    if (period === "day") return Boolean(e.is_today);
    if (period === "week") return Boolean(e.is_week);
    return Boolean(e.is_month);
  });

  const monthDailyAvg = Math.round(totals.month / Math.max(1, dayOfMonth));
  const weekDailyAvg = Math.round(totals.week / Math.max(1, dayOfWeek));

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 sm:px-6 sm:pt-7"
    >
      {/* Period Switcher Bar (Daily / Weekly / Monthly) */}
      <section
        aria-label="Dashboard time period"
        className="glass-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
            Dashboard View
          </p>
          <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
            {PERIOD_OPTIONS.find((p) => p.id === period)?.subtitle}
          </p>
        </div>

        <div
          role="group"
          aria-label="Select view period"
          className="grid grid-cols-3 gap-1.5 rounded-xl p-1"
          style={{
            background: "var(--surface-subtle)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPeriod(opt.id)}
                className="focus-ring min-h-10 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 sm:text-sm"
                style={{
                  background: active ? "var(--accent-primary)" : "transparent",
                  color: active ? "var(--accent-on-primary)" : "var(--text-secondary)",
                  boxShadow: active ? "var(--shadow-card)" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Bento Summary Cards: Clickable to switch Daily / Weekly / Monthly */}
      <section aria-label="Spending and nutrition summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Monthly Card */}
        <button
          type="button"
          onClick={() => setPeriod("month")}
          aria-pressed={period === "month"}
          className="glass-card focus-ring col-span-2 rounded-2xl p-4 text-left transition-all duration-150 sm:p-5 lg:col-span-1"
          style={{
            borderColor: period === "month" ? "var(--accent-primary)" : "var(--border-subtle)",
            boxShadow: period === "month" ? "0 0 0 1px var(--accent-primary), var(--shadow-card)" : undefined,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: period === "month" ? "var(--accent-text)" : "var(--text-secondary)" }}
            >
              This Month
            </p>
            <span
              className="rounded-lg px-2 py-0.5 font-mono text-xs font-medium whitespace-nowrap tabular-nums"
              style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
            >
              ~{rp(monthDailyAvg)}/day
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.month)}
          </p>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {catsByPeriod.month.length} active {catsByPeriod.month.length === 1 ? "category" : "categories"}
          </p>
        </button>

        {/* Weekly Card */}
        <button
          type="button"
          onClick={() => setPeriod("week")}
          aria-pressed={period === "week"}
          className="glass-card focus-ring rounded-2xl p-4 text-left transition-all duration-150 sm:p-5"
          style={{
            borderColor: period === "week" ? "var(--accent-primary)" : "var(--border-subtle)",
            boxShadow: period === "week" ? "0 0 0 1px var(--accent-primary), var(--shadow-card)" : undefined,
          }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: period === "week" ? "var(--accent-text)" : "var(--text-secondary)" }}
            >
              This Week
            </p>
            <span
              className="hidden rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums sm:inline-block"
              style={{ background: "var(--surface-subtle)", color: "var(--text-secondary)" }}
            >
              ~{rp(weekDailyAvg)}/d
            </span>
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.week)}
          </p>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Mon – Sun
          </p>
        </button>

        {/* Daily Card */}
        <button
          type="button"
          onClick={() => setPeriod("day")}
          aria-pressed={period === "day"}
          className="glass-card focus-ring rounded-2xl p-4 text-left transition-all duration-150 sm:p-5"
          style={{
            borderColor: period === "day" ? "var(--accent-primary)" : "var(--border-subtle)",
            boxShadow: period === "day" ? "0 0 0 1px var(--accent-primary), var(--shadow-card)" : undefined,
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: period === "day" ? "var(--accent-text)" : "var(--text-secondary)" }}
          >
            Today
          </p>
          <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.today)}
          </p>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Asia/Jakarta
          </p>
        </button>

        {/* Active Period Nutrition Card */}
        <div
          className="glass-card col-span-2 rounded-2xl p-4 sm:p-5 lg:col-span-1"
          style={{ borderColor: "var(--border-strong)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--cat-groceries-fg)" }}>
              <FlameIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{nutriTitle}</span>
            </p>
            <span
              className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums"
              style={{ background: "var(--cat-groceries-bg)", color: "var(--cat-groceries-fg)" }}
            >
              {activeNutri.loggedItems} {activeNutri.loggedItems === 1 ? "meal" : "meals"}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
            {activeNutri.calories.toLocaleString("id-ID")}{" "}
            <span className="text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
              kcal
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-medium tabular-nums">
            <span
              className="rounded-md px-1.5 py-0.5 whitespace-nowrap"
              style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
            >
              P {activeNutri.protein}g
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 whitespace-nowrap"
              style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
            >
              C {activeNutri.carbs}g
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 whitespace-nowrap"
              style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
            >
              F {activeNutri.fat}g
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
          <div className="mb-4 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
              >
                <TrendingUpIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold leading-tight sm:text-lg">
                  Spending Trend ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
                </h2>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                  {trendSubtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <DailyChart data={trendData} period={period} />
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
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Category Share ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                {catSubtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <CategoryChart data={activeCats} period={period} />
          </div>
        </section>
      </div>

      {/* Period Transactions */}
      <section className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              {PERIOD_OPTIONS.find((p) => p.id === period)?.shortLabel}&apos;s Expenses &amp; Nutrition
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
              Showing {periodFilteredRecent.length} {periodFilteredRecent.length === 1 ? "entry" : "entries"} for{" "}
              {PERIOD_OPTIONS.find((p) => p.id === period)?.shortLabel.toLowerCase()} · tap edit or delete to adjust
            </p>
          </div>
        </div>
        <RecentList items={periodFilteredRecent} />
      </section>
    </main>
  );
}
