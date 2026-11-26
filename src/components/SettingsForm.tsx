"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  FlameIcon,
  TargetIcon,
  WalletIcon,
} from "@/components/Icons";
import { rp } from "@/lib/format";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/db";

const NUTRITION_PRESETS = [
  {
    label: "Cutting / Fat Loss",
    calories: 1700,
    protein_g: 135,
    carbs_g: 160,
    fat_g: 55,
  },
  {
    label: "Balanced Maintenance",
    calories: 2000,
    protein_g: 120,
    carbs_g: 225,
    fat_g: 65,
  },
  {
    label: "Active / Muscle Gain",
    calories: 2500,
    protein_g: 160,
    carbs_g: 290,
    fat_g: 75,
  },
] as const;

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

  const [goals, setGoals] = useState({
    daily_budget: String(initial.daily_budget),
    monthly_budget: String(initial.monthly_budget),
    daily_calories: String(initial.daily_calories),
    daily_protein_g: String(initial.daily_protein_g),
    daily_carbs_g: String(initial.daily_carbs_g),
    daily_fat_g: String(initial.daily_fat_g),
  });

  const numDailyRp = Number(goals.daily_budget) || 0;
  const numMonthRp = Number(goals.monthly_budget) || 0;
  const numCal = Number(goals.daily_calories) || 0;
  const numPro = Number(goals.daily_protein_g) || 0;
  const numCarb = Number(goals.daily_carbs_g) || 0;
  const numFat = Number(goals.daily_fat_g) || 0;

  const macroCalories = Math.round(numPro * 4 + numCarb * 4 + numFat * 9);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
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
            <span>Targets &amp; quotas saved! Dashboard and Telegram bot are updated.</span>
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

      {/* Section 1: Financial Budget Quotas */}
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
                Used for your Calorie Intake Trend line, Macro Goal ring, and AI Coach suggestions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {NUTRITION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setGoals((prev) => ({
                    ...prev,
                    daily_calories: String(p.calories),
                    daily_protein_g: String(p.protein_g),
                    daily_carbs_g: String(p.carbs_g),
                    daily_fat_g: String(p.fat_g),
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
              {Math.round(numPro * 4)} kcal ({numCal > 0 ? Math.round(((numPro * 4) / numCal) * 100) : 0}%)
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
              {Math.round(numCarb * 4)} kcal ({numCal > 0 ? Math.round(((numCarb * 4) / numCal) * 100) : 0}%)
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
              {Math.round(numFat * 9)} kcal ({numCal > 0 ? Math.round(((numFat * 9) / numCal) * 100) : 0}%)
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
          you can also update these quotas from Telegram anytime with{" "}
          <code className="font-mono">/setgoal daily 120k month 3.5jt kcal 2100 p 130 c 230 f 65</code>.
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
            <span>{saving ? "Saving Quotas..." : "Save Targets & Quotas"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
