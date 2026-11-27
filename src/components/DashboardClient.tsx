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
  ScaleIcon,
  SendIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  XIcon,
} from "@/components/Icons";
import RecentList from "@/components/RecentList";
import { rp } from "@/lib/format";
import {
  calculateNutritionForWeight,
  type Expense,
  type NutritionGoalMode,
  type NutritionTrendPoint,
  type Period,
  type PeriodNutrition,
  type UserSettings,
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

  // Quick Body Weight & Nutrition Needs Calculator Drawer State
  const [showWeightCalc, setShowWeightCalc] = useState(false);
  const [weightInput, setWeightInput] = useState(String(settings.body_weight_kg ?? 65));
  const [weightMode, setWeightMode] = useState<NutritionGoalMode>("maintain");
  const [savingWeight, setSavingWeight] = useState(false);

  const parsedWeight = Number(weightInput) || settings.body_weight_kg || 65;
  const weightNeeds = calculateNutritionForWeight(parsedWeight, weightMode);

  async function handleSaveWeightNeeds(ev: React.FormEvent) {
    ev.preventDefault();
    if (parsedWeight < 25 || parsedWeight > 300) return;
    setSavingWeight(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body_weight_kg: Math.round(parsedWeight * 10) / 10,
          daily_calories: weightNeeds.daily_calories,
          daily_protein_g: weightNeeds.daily_protein_g,
          daily_carbs_g: weightNeeds.daily_carbs_g,
          daily_fat_g: weightNeeds.daily_fat_g,
        }),
      });
      if (res.ok) {
        setShowWeightCalc(false);
        router.refresh();
      }
    } finally {
      setSavingWeight(false);
    }
  }

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
              setShowWeightCalc(false);
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

          <form
            onSubmit={handleSaveWeightNeeds}
            className="flex flex-1 items-center gap-1.5 rounded-xl px-2.5 py-1 sm:flex-initial"
            style={{
              background: "var(--surface-subtle)",
              border: `1px solid ${showWeightCalc ? "var(--accent-primary)" : "var(--border-subtle)"}`,
            }}
          >
            <button
              type="button"
              aria-expanded={showWeightCalc}
              aria-label="Toggle weight nutrition calculator options"
              onClick={() => {
                setShowWeightCalc(!showWeightCalc);
                setShowAdd(false);
              }}
              className="focus-ring flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold whitespace-nowrap"
              style={{ color: "var(--text-secondary)" }}
            >
              <ScaleIcon className="h-4 w-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
              <span>Weight:</span>
            </button>

            <label htmlFor="quick-bar-weight" className="sr-only">
              Body weight in kg
            </label>
            <input
              id="quick-bar-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={25}
              max={300}
              required
              value={weightInput}
              onFocus={() => {
                setShowWeightCalc(true);
                setShowAdd(false);
              }}
              onChange={(e) => setWeightInput(e.target.value)}
              className="focus-ring h-8 w-16 rounded-lg px-2 text-center font-mono text-xs font-bold tabular-nums sm:text-sm"
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <span className="font-mono text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              kg
            </span>

            <button
              type="submit"
              disabled={savingWeight}
              className="focus-ring ml-0.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-opacity active:opacity-85 disabled:opacity-50"
              style={{
                background: "var(--accent-primary)",
                color: "var(--accent-on-primary)",
              }}
            >
              {savingWeight ? "..." : "Update"}
            </button>
          </form>
        </div>
      </section>

      {/* Expandable Body Weight -> Actual Nutrition Needs Calculator */}
      {showWeightCalc && (
        <section className="glass-card rounded-2xl p-5" style={{ borderColor: "var(--accent-primary)" }}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
              >
                <ScaleIcon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold">Actual Nutrition Needs for Your Weight</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Enter your current body weight (kg) to calculate and apply your daily calorie &amp; macro requirements
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWeightCalc(false)}
              aria-label="Close weight calculator"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveWeightNeeds} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label
                  htmlFor="dash-weight-kg"
                  className="block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Your Weight (kg)
                </label>
                <div className="relative mt-1 flex items-center">
                  <input
                    id="dash-weight-kg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={25}
                    max={300}
                    required
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="focus-ring min-h-11 w-full rounded-xl py-2.5 pr-11 pl-3.5 font-mono text-base font-bold tabular-nums"
                    style={{
                      background: "var(--surface-subtle)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span
                    className="pointer-events-none absolute right-3.5 font-mono text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    kg
                  </span>
                </div>
              </div>

              <div className="sm:col-span-8">
                <span
                  className="block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Activity &amp; Goal Mode
                </span>
                <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-label="Goal mode">
                  {(
                    [
                      { id: "cut", label: "Fat Loss", sub: "2.0g/kg P" },
                      { id: "maintain", label: "Maintain", sub: "1.8g/kg P" },
                      { id: "gain", label: "Muscle Gain", sub: "2.0g/kg P" },
                    ] as const
                  ).map((m) => {
                    const active = weightMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setWeightMode(m.id)}
                        className="focus-ring min-h-11 rounded-xl px-2.5 py-2 text-center transition-all"
                        style={{
                          background: active ? "var(--accent-soft)" : "var(--surface-subtle)",
                          border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                          color: active ? "var(--accent-text)" : "var(--text-primary)",
                        }}
                      >
                        <p className="text-xs font-bold">{m.label}</p>
                        <p className="font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {m.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs sm:text-sm"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="space-y-0.5">
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Calculated Daily Needs for {parsedWeight} kg:
                </p>
                <p className="font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  🔥 <strong style={{ color: "var(--text-primary)" }}>{weightNeeds.daily_calories} kcal/day</strong> (
                  {weightNeeds.kcalPerKg} kcal/kg) · 🥩 Protein{" "}
                  <strong style={{ color: "var(--cat-food-fg)" }}>{weightNeeds.daily_protein_g}g</strong> · 🍚 Carbs{" "}
                  <strong style={{ color: "var(--cat-transport-fg)" }}>{weightNeeds.daily_carbs_g}g</strong> · 🥑 Fat{" "}
                  <strong style={{ color: "var(--cat-groceries-fg)" }}>{weightNeeds.daily_fat_g}g</strong>
                </p>
              </div>

              <button
                type="submit"
                disabled={savingWeight}
                className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-50 sm:text-sm"
                style={{
                  background: "var(--accent-primary)",
                  color: "var(--accent-on-primary)",
                }}
              >
                <CheckIcon className="h-4 w-4" />
                <span>{savingWeight ? "Applying..." : "Apply to My Daily Goals"}</span>
              </button>
            </div>
          </form>
        </section>
      )}

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
              P {activeNutri.protein}g / {Math.round(settings.daily_protein_g * daysMultiplier)}g
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
            <span
              className="rounded-md px-1.5 py-0.5 whitespace-nowrap"
              style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
            >
              {settings.body_weight_kg} kg
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
