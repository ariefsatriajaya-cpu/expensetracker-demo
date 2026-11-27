"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  FlameIcon,
  ScaleIcon,
  SparklesIcon,
  TargetIcon,
  WalletIcon,
} from "@/components/Icons";
import { rp } from "@/lib/format";
import {
  calculateNutritionForWeight,
  DEFAULT_SETTINGS,
  type NutritionGoalMode,
  type UserSettings,
} from "@/lib/db";

const WEIGHT_GOAL_MODES: Array<{
  mode: NutritionGoalMode;
  label: string;
  desc: string;
}> = [
  {
    mode: "cut",
    label: "Cutting / Fat Loss",
    desc: "26 kcal/kg · 2.0g/kg Protein · 0.8g/kg Fat",
  },
  {
    mode: "maintain",
    label: "Balanced Maintenance",
    desc: "31 kcal/kg · 1.8g/kg Protein · 0.9g/kg Fat",
  },
  {
    mode: "gain",
    label: "Active / Muscle Gain",
    desc: "36 kcal/kg · 2.0g/kg Protein · 1.0g/kg Fat",
  },
];

const BUDGET_PRESETS = [
  { label: "Frugal (75k/d)", daily: 75_000, monthly: 2_250_000 },
  { label: "Standard (100k/d)", daily: 100_000, monthly: 3_000_000 },
  { label: "Flexible (150k/d)", daily: 150_000, monthly: 4_500_000 },
] as const;

export default function SettingsForm({ initial }: { initial: UserSettings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<NutritionGoalMode>("maintain");
  const [autoSyncWeight, setAutoSyncWeight] = useState(true);

  const [goals, setGoals] = useState({
    body_weight_kg: String(initial.body_weight_kg ?? DEFAULT_SETTINGS.body_weight_kg),
    daily_budget: String(initial.daily_budget),
    monthly_budget: String(initial.monthly_budget),
    daily_calories: String(initial.daily_calories),
    daily_protein_g: String(initial.daily_protein_g),
    daily_carbs_g: String(initial.daily_carbs_g),
    daily_fat_g: String(initial.daily_fat_g),
  });

  const numWeightKg = Number(goals.body_weight_kg) || 0;
  const numDailyRp = Number(goals.daily_budget) || 0;
  const numMonthRp = Number(goals.monthly_budget) || 0;
  const numCal = Number(goals.daily_calories) || 0;
  const numPro = Number(goals.daily_protein_g) || 0;
  const numCarb = Number(goals.daily_carbs_g) || 0;
  const numFat = Number(goals.daily_fat_g) || 0;

  const macroCalories = Math.round(numPro * 4 + numCarb * 4 + numFat * 9);
  const recommended = calculateNutritionForWeight(numWeightKg > 0 ? numWeightKg : DEFAULT_SETTINGS.body_weight_kg, selectedMode);

  const proPerKg = numWeightKg > 0 ? (numPro / numWeightKg).toFixed(1) : "0.0";
  const carbPerKg = numWeightKg > 0 ? (numCarb / numWeightKg).toFixed(1) : "0.0";
  const fatPerKg = numWeightKg > 0 ? (numFat / numWeightKg).toFixed(1) : "0.0";
  const kcalPerKg = numWeightKg > 0 ? Math.round(numCal / numWeightKg) : 0;

  function applyWeightCalculation(weightVal: number, mode: NutritionGoalMode) {
    const calc = calculateNutritionForWeight(weightVal, mode);
    setGoals((prev) => ({
      ...prev,
      daily_calories: String(calc.daily_calories),
      daily_protein_g: String(calc.daily_protein_g),
      daily_carbs_g: String(calc.daily_carbs_g),
      daily_fat_g: String(calc.daily_fat_g),
    }));
    setSavedBanner(false);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (numWeightKg < 25 || numWeightKg > 300) {
      setError("Please enter a valid body weight between 25 kg and 300 kg.");
      return;
    }
    if (numDailyRp <= 0 || numMonthRp <= 0) {
      setError("Daily and monthly budgets must be greater than Rp0.");
      return;
    }
    if (numCal <= 0 || numPro <= 0 || numCarb <= 0 || numFat <= 0) {
      setError("Daily calories and macro targets must be greater than 0.");
      return;
    }
    setError(null);
    setSaving(true);
    setSavedBanner(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body_weight_kg: Math.round(numWeightKg * 10) / 10,
          daily_budget: Math.round(numDailyRp),
          monthly_budget: Math.round(numMonthRp),
          daily_calories: Math.round(numCal),
          daily_protein_g: Math.round(numPro * 10) / 10,
          daily_carbs_g: Math.round(numCarb * 10) / 10,
          daily_fat_g: Math.round(numFat * 10) / 10,
        }),
      });
      if (!res.ok) {
        setError("Could not save settings. Please try again.");
        return;
      }
      setSavedBanner(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {savedBanner && (
        <div
          role="status"
          className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
          style={{
            borderColor: "var(--accent-primary)",
            background: "var(--accent-soft)",
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
            <CheckIcon className="h-4 w-4 shrink-0" />
            <span>Weight, nutrition needs &amp; budget quotas saved! Dashboard and Telegram bot are updated.</span>
          </p>
          <Link
            href="/"
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
            style={{
              background: "var(--accent-primary)",
              color: "var(--accent-on-primary)",
            }}
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      )}

      {/* Section 1: Body Weight & Actual Nutrition Needs Calculator */}
      <section
        className="glass-card space-y-4 rounded-2xl p-5 sm:p-6"
        style={{ borderColor: "var(--accent-primary)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
            >
              <ScaleIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Body Weight &amp; Actual Nutrition Calculator
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                Enter your actual weight (kg) to calculate personalized daily calories, protein, carbs, and fat
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium sm:text-sm">
            <input
              type="checkbox"
              checked={autoSyncWeight}
              onChange={(e) => setAutoSyncWeight(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            <span>Auto-update nutrition needs as weight changes</span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label
              htmlFor="body-weight-kg"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Your Actual Weight (kg)
            </label>
            <div className="relative mt-1.5 flex items-center">
              <input
                id="body-weight-kg"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={25}
                max={300}
                required
                value={goals.body_weight_kg}
                onChange={(e) => {
                  const val = e.target.value;
                  setGoals((prev) => ({ ...prev, body_weight_kg: val }));
                  setSavedBanner(false);
                  const parsedW = Number(val);
                  if (autoSyncWeight && parsedW >= 30 && parsedW <= 250) {
                    applyWeightCalculation(parsedW, selectedMode);
                  }
                }}
                className="focus-ring min-h-11 w-full rounded-xl py-2.5 pr-12 pl-3.5 font-mono text-base font-bold tabular-nums"
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
            <p className="mt-1.5 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              Current ratio: {kcalPerKg} kcal/kg · {proPerKg}g P/kg
            </p>
          </div>

          <div className="space-y-2 sm:col-span-8">
            <span
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Goal Profile (scales directly to {numWeightKg > 0 ? `${numWeightKg} kg` : "your weight"})
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Select nutrition goal mode">
              {WEIGHT_GOAL_MODES.map((m) => {
                const active = selectedMode === m.mode;
                const preview = calculateNutritionForWeight(
                  numWeightKg > 0 ? numWeightKg : DEFAULT_SETTINGS.body_weight_kg,
                  m.mode,
                );
                return (
                  <button
                    key={m.mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedMode(m.mode);
                      if (numWeightKg >= 25) {
                        applyWeightCalculation(numWeightKg, m.mode);
                      }
                    }}
                    className="focus-ring flex flex-col justify-between rounded-xl p-3 text-left transition-all"
                    style={{
                      background: active ? "var(--accent-soft)" : "var(--surface-subtle)",
                      border: `1px solid ${active ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div>
                      <p
                        className="text-xs font-bold"
                        style={{ color: active ? "var(--accent-text)" : "var(--text-primary)" }}
                      >
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {m.desc}
                      </p>
                    </div>
                    <p className="mt-2 font-mono text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {preview.daily_calories} kcal · P {preview.daily_protein_g}g
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Personalized Recommendation Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs sm:text-sm"
          style={{
            background: "var(--surface-subtle)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="space-y-0.5">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Actual Daily Needs for {numWeightKg > 0 ? `${numWeightKg} kg` : "65 kg"} (
              {WEIGHT_GOAL_MODES.find((m) => m.mode === selectedMode)?.label}):
            </p>
            <p className="font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              🔥 <strong style={{ color: "var(--text-primary)" }}>{recommended.daily_calories} kcal</strong> · 🥩 Protein{" "}
              <strong style={{ color: "var(--cat-food-fg)" }}>{recommended.daily_protein_g}g</strong> (
              {recommended.proteinPerKg}g/kg) · 🍚 Carbs{" "}
              <strong style={{ color: "var(--cat-transport-fg)" }}>{recommended.daily_carbs_g}g</strong> · 🥑 Fat{" "}
              <strong style={{ color: "var(--cat-groceries-fg)" }}>{recommended.daily_fat_g}g</strong> (
              {recommended.fatPerKg}g/kg)
            </p>
          </div>

          <button
            type="button"
            onClick={() => applyWeightCalculation(numWeightKg > 0 ? numWeightKg : DEFAULT_SETTINGS.body_weight_kg, selectedMode)}
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            style={{
              background: "var(--accent-primary)",
              color: "var(--accent-on-primary)",
            }}
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            <span>Apply Needs for {numWeightKg > 0 ? `${numWeightKg} kg` : "Weight"}</span>
          </button>
        </div>
      </section>

      {/* Section 2: Nutritional & Macro Quotas */}
      <section className="glass-card space-y-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--cat-groceries-bg)", color: "var(--cat-groceries-fg)" }}
            >
              <FlameIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Daily Nutrition &amp; Macro Quotas
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                Fine-tune your daily targets or use the weight calculator above
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="daily-calories"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Daily Calorie Quota (kcal)
            </label>
            <input
              id="daily-calories"
              type="number"
              inputMode="numeric"
              min={500}
              required
              value={goals.daily_calories}
              onChange={(e) => {
                setGoals({ ...goals, daily_calories: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {kcalPerKg} kcal per kg of body weight
            </p>
          </div>

          <div
            className="flex flex-col justify-center rounded-xl px-4 py-3 text-xs"
            style={{
              background: "var(--surface-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Macro Calorie Equivalent:
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--accent-text)" }}>
                {macroCalories.toLocaleString("id-ID")} kcal
              </span>
            </div>
            <p className="mt-1">
              Calculated from Protein ({numPro}g × 4) + Carbs ({numCarb}g × 4) + Fat ({numFat}g × 9)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="daily-protein"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--cat-food-fg)" }}
            >
              Protein Quota (g / day)
            </label>
            <input
              id="daily-protein"
              type="number"
              step="0.5"
              min={10}
              required
              value={goals.daily_protein_g}
              onChange={(e) => {
                setGoals({ ...goals, daily_protein_g: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {proPerKg} g/kg · {Math.round(numPro * 4)} kcal ({numCal > 0 ? Math.round(((numPro * 4) / numCal) * 100) : 0}%)
            </p>
          </div>

          <div>
            <label
              htmlFor="daily-carbs"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--cat-transport-fg)" }}
            >
              Carbs Quota (g / day)
            </label>
            <input
              id="daily-carbs"
              type="number"
              step="0.5"
              min={10}
              required
              value={goals.daily_carbs_g}
              onChange={(e) => {
                setGoals({ ...goals, daily_carbs_g: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {carbPerKg} g/kg · {Math.round(numCarb * 4)} kcal ({numCal > 0 ? Math.round(((numCarb * 4) / numCal) * 100) : 0}%)
            </p>
          </div>

          <div>
            <label
              htmlFor="daily-fat"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--cat-groceries-fg)" }}
            >
              Fat Quota (g / day)
            </label>
            <input
              id="daily-fat"
              type="number"
              step="0.5"
              min={10}
              required
              value={goals.daily_fat_g}
              onChange={(e) => {
                setGoals({ ...goals, daily_fat_g: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {fatPerKg} g/kg · {Math.round(numFat * 9)} kcal ({numCal > 0 ? Math.round(((numFat * 9) / numCal) * 100) : 0}%)
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Financial Budget Quotas */}
      <section className="glass-card space-y-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
            >
              <WalletIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight sm:text-lg">
                Financial Spending Quotas
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                Controls your Daily, Weekly (7× daily), and Monthly budget bars
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setGoals((prev) => ({
                    ...prev,
                    daily_budget: String(p.daily),
                    monthly_budget: String(p.monthly),
                  }));
                  setSavedBanner(false);
                }}
                className="focus-ring min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="daily-budget"
              className="block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Daily Budget Quota (IDR)
            </label>
            <input
              id="daily-budget"
              type="number"
              inputMode="numeric"
              min={1000}
              required
              value={goals.daily_budget}
              onChange={(e) => {
                setGoals({ ...goals, daily_budget: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1.5 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {rp(numDailyRp)}/day · Weekly quota: {rp(numDailyRp * 7)}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="monthly-budget"
                className="block text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                Monthly Budget Quota (IDR)
              </label>
              <button
                type="button"
                onClick={() => {
                  setGoals((prev) => ({
                    ...prev,
                    monthly_budget: String(numDailyRp * 30),
                  }));
                  setSavedBanner(false);
                }}
                className="focus-ring text-xs font-semibold underline"
                style={{ color: "var(--accent-text)" }}
              >
                Set to 30× Daily ({rp(numDailyRp * 30)})
              </button>
            </div>
            <input
              id="monthly-budget"
              type="number"
              inputMode="numeric"
              min={10000}
              required
              value={goals.monthly_budget}
              onChange={(e) => {
                setGoals({ ...goals, monthly_budget: e.target.value });
                setSavedBanner(false);
              }}
              className="focus-ring mt-1.5 min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1.5 font-mono text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {rp(numMonthRp)}/month (~{rp(Math.round(numMonthRp / 30))}/day)
            </p>
          </div>
        </div>
      </section>

      {/* Telegram Sync Tip */}
      <section className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3.5 sm:px-5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--trust-soft)", color: "var(--trust-blue)" }}
        >
          <TargetIcon className="h-4 w-4" />
        </div>
        <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
          <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Telegram shortcut:
          </strong>{" "}
          you can also update your weight &amp; auto-calculate nutrition from Telegram with{" "}
          <code className="font-mono">/weight 72</code> (or <code className="font-mono">/weight 72 cut</code>,{" "}
          <code className="font-mono">/setgoal weight 72 daily 120k</code>).
        </p>
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setGoals({
              body_weight_kg: String(DEFAULT_SETTINGS.body_weight_kg),
              daily_budget: String(DEFAULT_SETTINGS.daily_budget),
              monthly_budget: String(DEFAULT_SETTINGS.monthly_budget),
              daily_calories: String(DEFAULT_SETTINGS.daily_calories),
              daily_protein_g: String(DEFAULT_SETTINGS.daily_protein_g),
              daily_carbs_g: String(DEFAULT_SETTINGS.daily_carbs_g),
              daily_fat_g: String(DEFAULT_SETTINGS.daily_fat_g),
            });
            setSavedBanner(false);
          }}
          className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold sm:text-sm"
          style={{
            background: "var(--surface-subtle)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          Reset to Defaults
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold sm:text-sm"
            style={{
              background: "var(--surface-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
            style={{
              background: "var(--accent-primary)",
              color: "var(--accent-on-primary)",
            }}
          >
            <CheckIcon className="h-4 w-4" />
            <span>{saving ? "Saving Quotas..." : "Save Weight & Quotas"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
