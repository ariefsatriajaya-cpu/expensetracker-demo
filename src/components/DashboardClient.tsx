"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categorize";
import {
  CategoryChart,
  DailyChart,
  MacroGoalChart,
  NutritionTrendChart,
} from "@/components/Charts";
import {
  CheckIcon,
  FlameIcon,
  PieChartIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  XIcon,
} from "@/components/Icons";
import RecentList from "@/components/RecentList";
import { rp } from "@/lib/format";
import type {
  Expense,
  NutritionTrendPoint,
  Period,
  PeriodNutrition,
  UserSettings,
} from "@/lib/db";

type Props = {
  totals: { today: number; week: number; month: number };
  days30: { day: string; total: number }[];
  hoursToday: { day: string; total: number }[];
  nutriDays30: NutritionTrendPoint[];
  nutriHoursToday: NutritionTrendPoint[];
  catsByPeriod: Record<Period, { category: string; total: number }[]>;
  nutritionByPeriod: Record<Period, PeriodNutrition>;
  settings: UserSettings;
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
  nutriDays30,
  nutriHoursToday,
  catsByPeriod,
  nutritionByPeriod,
  settings,
  recent,
  dayOfMonth,
  dayOfWeek,
}: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");

  // Quick-Add Expense Drawer State
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newExp, setNewExp] = useState({
    name: "",
    amount: "",
    category: "",
    extraNotes: "",
    autoAi: true,
  });

  // Target Editor Drawer State
  const [showTargets, setShowTargets] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [goals, setGoals] = useState({
    daily_budget: String(settings.daily_budget),
    monthly_budget: String(settings.monthly_budget),
    daily_calories: String(settings.daily_calories),
    daily_protein_g: String(settings.daily_protein_g),
    daily_carbs_g: String(settings.daily_carbs_g),
    daily_fat_g: String(settings.daily_fat_g),
  });

  async function handleAddExpense(ev: React.FormEvent) {
    ev.preventDefault();
    const name = newExp.name.trim();
    const amount = Number(newExp.amount);
    if (!name) {
      setAddError("Enter an item or meal name.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setAddError("Enter an amount greater than Rp0.");
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          amount: Math.round(amount),
          category: newExp.category || undefined,
          extraNotes: newExp.extraNotes.trim() || undefined,
          autoAi: newExp.autoAi,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setAddError(d?.error || "Failed to add expense.");
        return;
      }
      setNewExp({ name: "", amount: "", category: "", extraNotes: "", autoAi: true });
      setShowAdd(false);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveTargets(ev: React.FormEvent) {
    ev.preventDefault();
    setSavingTargets(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          daily_budget: Number(goals.daily_budget),
          monthly_budget: Number(goals.monthly_budget),
          daily_calories: Number(goals.daily_calories),
          daily_protein_g: Number(goals.daily_protein_g),
          daily_carbs_g: Number(goals.daily_carbs_g),
          daily_fat_g: Number(goals.daily_fat_g),
        }),
      });
      if (res.ok) {
        setShowTargets(false);
        router.refresh();
      }
    } finally {
      setSavingTargets(false);
    }
  }

  const activeCats = catsByPeriod[period];
  const activeNutri = nutritionByPeriod[period];

  const trendData =
    period === "day"
      ? hoursToday
      : period === "week"
        ? days30.slice(-7)
        : days30;

  const nutriTrendData =
    period === "day"
      ? nutriHoursToday
      : period === "week"
        ? nutriDays30.slice(-7)
        : nutriDays30;

  const daysMultiplier =
    period === "day" ? 1 : period === "week" ? Math.max(1, dayOfWeek) : Math.max(1, dayOfMonth);

  const trendSubtitle =
    period === "day"
      ? "Hourly spending breakdown today (WIB)"
      : period === "week"
        ? "Daily totals over the last 7 days (dashed = daily budget)"
        : "Daily totals over the last 30 days (dashed = daily budget)";

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

  // Budget Progress Calculations
  const monthPct = settings.monthly_budget > 0 ? Math.round((totals.month / settings.monthly_budget) * 100) : 0;
  const monthRem = settings.monthly_budget - totals.month;

  const weekBudget = settings.daily_budget * 7;
  const weekPct = weekBudget > 0 ? Math.round((totals.week / weekBudget) * 100) : 0;
  const weekRem = weekBudget - totals.week;

  const dayPct = settings.daily_budget > 0 ? Math.round((totals.today / settings.daily_budget) * 100) : 0;
  const dayRem = settings.daily_budget - totals.today;

  const periodCalTarget = settings.daily_calories * daysMultiplier;
  const calPct = periodCalTarget > 0 ? Math.round((activeNutri.calories / periodCalTarget) * 100) : 0;

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-5 sm:px-6 sm:pt-7"
    >
      {/* Period Switcher Bar + Quick Actions (+ Add Expense & Edit Targets) */}
      <section
        aria-label="Dashboard controls"
        className="glass-card flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={showAdd}
            onClick={() => {
              setShowAdd(!showAdd);
              if (showTargets) setShowTargets(false);
            }}
            className="focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-opacity active:opacity-85 sm:flex-initial sm:text-sm"
            style={{
              background: "var(--accent-primary)",
              color: "var(--accent-on-primary)",
            }}
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            aria-expanded={showTargets}
            onClick={() => {
              setShowTargets(!showTargets);
              if (showAdd) setShowAdd(false);
            }}
            className="focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors active:opacity-85 sm:flex-initial sm:text-sm"
            style={{
              background: "var(--surface-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <TargetIcon className="h-4 w-4 shrink-0" />
            <span>Targets</span>
          </button>
        </div>
      </section>

      {/* Expandable "+ Add Expense" Form with AI Nutrition */}
      {showAdd && (
        <section className="glass-card rounded-2xl p-5" style={{ borderColor: "var(--accent-primary)" }}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Log New Expense</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Gemini AI automatically categorizes and estimates calories &amp; macros for food/drinks
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              aria-label="Close add expense form"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddExpense} className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="add-name" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Meal or Expense Name
                </label>
                <input
                  id="add-name"
                  required
                  placeholder="e.g. Nasi padang ayam bakar"
                  value={newExp.name}
                  onChange={(e) => setNewExp({ ...newExp, name: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="add-amount" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Cost (IDR)
                </label>
                <input
                  id="add-amount"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  placeholder="e.g. 25000"
                  value={newExp.amount}
                  onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="add-notes" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Portion / Nutrition Details for AI (Optional)
                </label>
                <input
                  id="add-notes"
                  placeholder="e.g. nasi setengah porsi, dada ayam, tanpa santan"
                  value={newExp.extraNotes}
                  onChange={(e) => setNewExp({ ...newExp, extraNotes: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="add-cat" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Category
                </label>
                <select
                  id="add-cat"
                  value={newExp.category}
                  onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="" style={{ background: "var(--surface-elevated)" }}>
                    ✨ Auto-detect with AI
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "var(--surface-elevated)" }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {addError && (
              <p role="alert" className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
                {addError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium sm:text-sm">
                <input
                  type="checkbox"
                  checked={newExp.autoAi}
                  onChange={(e) => setNewExp({ ...newExp, autoAi: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="flex items-center gap-1">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Estimate calories &amp; macros with Gemini AI
                </span>
              </label>

              <button
                type="submit"
                disabled={adding}
                className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                style={{
                  background: "var(--accent-primary)",
                  color: "var(--accent-on-primary)",
                }}
              >
                <CheckIcon className="h-4 w-4" />
                <span>{adding ? "Analyzing & Saving..." : "Save Expense"}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Expandable "Targets" Form */}
      {showTargets && (
        <section className="glass-card rounded-2xl p-5" style={{ borderColor: "var(--accent-primary)" }}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Budget &amp; Daily Nutrition Targets</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Synced with your dashboard progress bars and Telegram bot (/setgoal)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTargets(false)}
              aria-label="Close targets form"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveTargets} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="goal-daily-rp" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Daily Budget (IDR)
                </label>
                <input
                  id="goal-daily-rp"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  value={goals.daily_budget}
                  onChange={(e) => setGoals({ ...goals, daily_budget: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2 font-mono text-base tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="goal-month-rp" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Monthly Budget (IDR)
                </label>
                <input
                  id="goal-month-rp"
                  type="number"
                  inputMode="numeric"
                  min={10000}
                  value={goals.monthly_budget}
                  onChange={(e) => setGoals({ ...goals, monthly_budget: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3.5 py-2 font-mono text-base tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="goal-kcal" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Daily Calories (kcal)
                </label>
                <input
                  id="goal-kcal"
                  type="number"
                  inputMode="numeric"
                  min={500}
                  value={goals.daily_calories}
                  onChange={(e) => setGoals({ ...goals, daily_calories: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3 py-2 font-mono text-sm tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="goal-pro" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Protein (g/day)
                </label>
                <input
                  id="goal-pro"
                  type="number"
                  min={10}
                  value={goals.daily_protein_g}
                  onChange={(e) => setGoals({ ...goals, daily_protein_g: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3 py-2 font-mono text-sm tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="goal-carb" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Carbs (g/day)
                </label>
                <input
                  id="goal-carb"
                  type="number"
                  min={10}
                  value={goals.daily_carbs_g}
                  onChange={(e) => setGoals({ ...goals, daily_carbs_g: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3 py-2 font-mono text-sm tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="goal-fat" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Fat (g/day)
                </label>
                <input
                  id="goal-fat"
                  type="number"
                  min={10}
                  value={goals.daily_fat_g}
                  onChange={(e) => setGoals({ ...goals, daily_fat_g: e.target.value })}
                  className="focus-ring mt-1 min-h-11 w-full rounded-xl px-3 py-2 font-mono text-sm tabular-nums"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingTargets}
                className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--accent-primary)",
                  color: "var(--accent-on-primary)",
                }}
              >
                <CheckIcon className="h-4 w-4" />
                <span>{savingTargets ? "Saving..." : "Save Targets"}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Bento Summary Cards with Budget & Calorie Progress Bars */}
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
              {monthPct}% of budget
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.month)}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-muted)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(monthPct, 3))}%`,
                background: monthRem >= 0 ? "var(--accent-primary)" : "var(--danger)",
              }}
            />
          </div>
          <p className="mt-1.5 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {monthRem >= 0 ? `${rp(monthRem)} left` : `${rp(Math.abs(monthRem))} over`}
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
            <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {weekPct}%
            </span>
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.week)}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-muted)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(weekPct, 3))}%`,
                background: weekRem >= 0 ? "var(--accent-primary)" : "var(--danger)",
              }}
            />
          </div>
          <p className="mt-1.5 font-mono text-xs truncate tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {weekRem >= 0 ? `${rp(weekRem)} left` : `${rp(Math.abs(weekRem))} over`}
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
          <div className="flex items-center justify-between gap-1.5">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: period === "day" ? "var(--accent-text)" : "var(--text-secondary)" }}
            >
              Today
            </p>
            <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {dayPct}%
            </span>
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
            {rp(totals.today)}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-muted)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(dayPct, 3))}%`,
                background: dayRem >= 0 ? "var(--accent-primary)" : "var(--danger)",
              }}
            />
          </div>
          <p className="mt-1.5 font-mono text-xs truncate tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {dayRem >= 0 ? `${rp(dayRem)} left` : `${rp(Math.abs(dayRem))} over`}
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
              {calPct}% of goal
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
            {activeNutri.calories.toLocaleString("id-ID")}{" "}
            <span className="text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
              / {periodCalTarget.toLocaleString("id-ID")} kcal
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
              Smart Telegram AI:
            </strong>{" "}
            send <code className="font-mono">geprek 22k, es teh 5k</code>, a receipt/meal photo,{" "}
            <code className="font-mono">/recalc 1</code>, or ask{" "}
            <code className="font-mono">saran makan malam tinggi protein</code>.
          </p>
        </div>
      </section>

      {/* Row 1: Finance Analytics Grid */}
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
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Spending Trend ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                {trendSubtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <DailyChart
              data={trendData}
              period={period}
              dailyBudgetGoal={settings.daily_budget}
            />
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

      {/* Row 2: Dedicated Nutrition Analytics Grid */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <section className="glass-card flex flex-col rounded-2xl p-5 sm:p-6 lg:col-span-7">
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--cat-groceries-bg)", color: "var(--cat-groceries-fg)" }}
            >
              <FlameIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Calorie Intake Trend ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                {period === "day"
                  ? "Hourly calorie intake today (WIB)"
                  : `Daily calories vs. ${settings.daily_calories.toLocaleString("id-ID")} kcal goal`}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <NutritionTrendChart
              data={nutriTrendData}
              period={period}
              dailyCalorieGoal={settings.daily_calories}
            />
          </div>
        </section>

        <section className="glass-card flex flex-col rounded-2xl p-5 sm:p-6 lg:col-span-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
            >
              <TargetIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Macro Goals ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                Calorie ring &amp; Protein / Carbs / Fat progress
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <MacroGoalChart
              nutrition={activeNutri}
              settings={settings}
              period={period}
              daysMultiplier={daysMultiplier}
            />
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
