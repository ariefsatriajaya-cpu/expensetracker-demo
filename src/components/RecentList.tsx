"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categorize";
import {
  CATEGORY_META,
  CategoryIcon,
  CheckIcon,
  EditIcon,
  FlameIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "@/components/Icons";
import { rp } from "@/lib/format";
import type { Expense } from "@/lib/db";

const EDIBLE_CATEGORIES = new Set(["Food", "Drink", "Groceries"]);

export default function RecentList({ items }: { items: Expense[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [estimatingId, setEstimatingId] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [f, setF] = useState({
    name: "",
    amount: "",
    category: "Other",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    nutrition_note: "",
  });

  function startEdit(e: Expense) {
    setConfirmDeleteId(null);
    setFieldError(null);
    setEditing(e.id);
    setF({
      name: e.name,
      amount: String(e.amount),
      category: e.category,
      calories: e.calories != null ? String(e.calories) : "",
      protein_g: e.protein_g != null ? String(e.protein_g) : "",
      carbs_g: e.carbs_g != null ? String(e.carbs_g) : "",
      fat_g: e.fat_g != null ? String(e.fat_g) : "",
      nutrition_note: e.nutrition_note ?? "",
    });
  }

  async function estimateNutritionForRow(e: Expense, inEditForm = false) {
    setEstimatingId(e.id);
    setFieldError(null);
    try {
      const targetName = inEditForm ? f.name.trim() || e.name : e.name;
      const res = await fetch(`/api/expenses/${e.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          estimateWithAi: true,
          name: targetName,
          amount: inEditForm ? Number(f.amount) || e.amount : e.amount,
          category: inEditForm ? f.category : e.category,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || "Could not estimate nutrition. Make sure GEMINI_API_KEY is set in Vercel.";
        if (inEditForm) setFieldError(msg);
        else alert(msg);
        return;
      }
      if (inEditForm && data?.nutrition) {
        setF((prev) => ({
          ...prev,
          calories: data.nutrition.calories != null ? String(data.nutrition.calories) : "",
          protein_g: data.nutrition.protein_g != null ? String(data.nutrition.protein_g) : "",
          carbs_g: data.nutrition.carbs_g != null ? String(data.nutrition.carbs_g) : "",
          fat_g: data.nutrition.fat_g != null ? String(data.nutrition.fat_g) : "",
          nutrition_note: data.nutrition.nutrition_note ?? "",
        }));
      }
      setStatusMsg(`Estimated nutrition for ${targetName}.`);
      router.refresh();
    } finally {
      setEstimatingId(null);
    }
  }

  async function save(id: number) {
    const trimmedName = f.name.trim();
    const numericAmount = Number(f.amount);
    if (!trimmedName) {
      setFieldError("Enter an expense name before saving.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFieldError("Enter an amount greater than Rp0.");
      return;
    }
    setFieldError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          amount: Math.round(numericAmount),
          category: f.category,
          calories: f.calories === "" ? null : Number(f.calories),
          protein_g: f.protein_g === "" ? null : Number(f.protein_g),
          carbs_g: f.carbs_g === "" ? null : Number(f.carbs_g),
          fat_g: f.fat_g === "" ? null : Number(f.fat_g),
          nutrition_note: f.nutrition_note.trim() || null,
        }),
      });
      if (!res.ok) {
        setFieldError("Could not save changes. Please try again.");
        return;
      }
      setEditing(null);
      setStatusMsg(`Updated ${trimmedName} to ${rp(numericAmount)}.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(expense: Expense) {
    setBusyId(expense.id);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDeleteId(null);
        setStatusMsg(`Deleted ${expense.name}.`);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!items.length) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-10 text-center"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
        >
          <SendIcon className="h-5 w-5" />
        </div>
        <p className="text-base font-semibold">No expenses recorded yet</p>
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--text-secondary)" }}>
          Open your Telegram bot and send <code className="font-mono font-medium">nasi goreng 25k</code> to log your first meal with AI nutrition facts.
        </p>
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((e) => {
    const matchesCat = activeCategory === "All" || e.category === activeCategory;
    const matchesQuery =
      !normalizedQuery ||
      e.name.toLowerCase().includes(normalizedQuery) ||
      e.category.toLowerCase().includes(normalizedQuery) ||
      (e.nutrition_note ?? "").toLowerCase().includes(normalizedQuery);
    return matchesCat && matchesQuery;
  });

  const filterTabs = ["All", ...CATEGORIES];

  return (
    <div className="space-y-4">
      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg}
      </div>

      <div className="space-y-3">
        <div className="relative flex items-center">
          <label htmlFor="expense-search" className="sr-only">
            Search recent expenses
          </label>
          <SearchIcon
            className="pointer-events-none absolute left-3.5 h-4 w-4"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            id="expense-search"
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Filter by meal, category, or nutrition note..."
            className="focus-ring min-h-11 w-full rounded-xl py-2.5 pr-10 pl-10 text-base transition-colors duration-150"
            style={{
              background: "var(--surface-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="focus-ring absolute right-1 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {filterTabs.map((cat) => {
            const selected = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveCategory(cat)}
                className="focus-ring min-h-11 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors duration-150 active:opacity-85 sm:text-sm"
                style={{
                  background: selected ? "var(--accent-primary)" : "var(--surface-subtle)",
                  color: selected ? "var(--accent-on-primary)" : "var(--text-secondary)",
                  border: `1px solid ${selected ? "transparent" : "var(--border-subtle)"}`,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {!filtered.length ? (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ background: "var(--surface-subtle)", color: "var(--text-secondary)" }}
        >
          No matching expenses found.{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveCategory("All");
            }}
            className="focus-ring ml-1 font-semibold underline"
            style={{ color: "var(--accent-primary)" }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {filtered.map((e) => {
            const meta = CATEGORY_META[e.category] ?? CATEGORY_META.Other;
            const isBusy = busyId === e.id;
            const isEstimating = estimatingId === e.id;
            const isEdible = EDIBLE_CATEGORIES.has(e.category);

            if (editing === e.id) {
              return (
                <li
                  key={e.id}
                  className="my-2 space-y-3 rounded-xl p-4"
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border-strong)",
                  }}
                >
                  <div className="space-y-1">
                    <label htmlFor={`edit-name-${e.id}`} className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Item name
                    </label>
                    <input
                      id={`edit-name-${e.id}`}
                      value={f.name}
                      onChange={(x) => {
                        setF({ ...f, name: x.target.value });
                        if (fieldError) setFieldError(null);
                      }}
                      aria-invalid={fieldError ? "true" : undefined}
                      aria-describedby={fieldError ? `edit-error-${e.id}` : undefined}
                      className="focus-ring min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor={`edit-amount-${e.id}`} className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        Amount (IDR)
                      </label>
                      <input
                        id={`edit-amount-${e.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={f.amount}
                        onChange={(x) => {
                          setF({ ...f, amount: x.target.value });
                          if (fieldError) setFieldError(null);
                        }}
                        className="focus-ring min-h-11 w-full rounded-xl px-3.5 py-2.5 font-mono text-base tabular-nums"
                        style={{
                          background: "var(--surface-elevated)",
                          border: "1px solid var(--border-strong)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`edit-cat-${e.id}`} className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        Category
                      </label>
                      <select
                        id={`edit-cat-${e.id}`}
                        value={f.category}
                        onChange={(x) => setF({ ...f, category: x.target.value })}
                        className="focus-ring min-h-11 w-full rounded-xl px-3.5 py-2.5 text-base"
                        style={{
                          background: "var(--surface-elevated)",
                          border: "1px solid var(--border-strong)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c} style={{ background: "var(--surface-elevated)", color: "var(--text-primary)" }}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Nutritional Facts Editor */}
                  <div
                    className="space-y-3 rounded-xl p-3.5"
                    style={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        <FlameIcon className="h-3.5 w-3.5" />
                        <span>Nutritional Facts (optional)</span>
                      </span>
                      <button
                        type="button"
                        disabled={isEstimating || isBusy}
                        onClick={() => estimateNutritionForRow(e, true)}
                        className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{
                          background: "var(--accent-soft)",
                          color: "var(--accent-text)",
                        }}
                      >
                        <SparklesIcon className="h-3.5 w-3.5" />
                        <span>{isEstimating ? "Estimating..." : "Auto-fill with AI"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div>
                        <label htmlFor={`edit-cal-${e.id}`} className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          Calories (kcal)
                        </label>
                        <input
                          id={`edit-cal-${e.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="e.g. 650"
                          value={f.calories}
                          onChange={(x) => setF({ ...f, calories: x.target.value })}
                          className="focus-ring mt-1 min-h-10 w-full rounded-lg px-2.5 py-1.5 font-mono text-sm tabular-nums"
                          style={{
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-pro-${e.id}`} className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          Protein (g)
                        </label>
                        <input
                          id={`edit-pro-${e.id}`}
                          type="number"
                          step="0.1"
                          min={0}
                          placeholder="e.g. 32"
                          value={f.protein_g}
                          onChange={(x) => setF({ ...f, protein_g: x.target.value })}
                          className="focus-ring mt-1 min-h-10 w-full rounded-lg px-2.5 py-1.5 font-mono text-sm tabular-nums"
                          style={{
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-carb-${e.id}`} className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          Carbs (g)
                        </label>
                        <input
                          id={`edit-carb-${e.id}`}
                          type="number"
                          step="0.1"
                          min={0}
                          placeholder="e.g. 68"
                          value={f.carbs_g}
                          onChange={(x) => setF({ ...f, carbs_g: x.target.value })}
                          className="focus-ring mt-1 min-h-10 w-full rounded-lg px-2.5 py-1.5 font-mono text-sm tabular-nums"
                          style={{
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-fat-${e.id}`} className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                          Fat (g)
                        </label>
                        <input
                          id={`edit-fat-${e.id}`}
                          type="number"
                          step="0.1"
                          min={0}
                          placeholder="e.g. 24"
                          value={f.fat_g}
                          onChange={(x) => setF({ ...f, fat_g: x.target.value })}
                          className="focus-ring mt-1 min-h-10 w-full rounded-lg px-2.5 py-1.5 font-mono text-sm tabular-nums"
                          style={{
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`edit-note-${e.id}`} className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        Nutrition note
                      </label>
                      <input
                        id={`edit-note-${e.id}`}
                        placeholder="Serving estimate or nutritional highlight..."
                        value={f.nutrition_note}
                        onChange={(x) => setF({ ...f, nutrition_note: x.target.value })}
                        className="focus-ring mt-1 min-h-10 w-full rounded-lg px-3 py-1.5 text-sm"
                        style={{
                          background: "var(--surface-subtle)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  {fieldError && (
                    <p id={`edit-error-${e.id}`} role="alert" className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                      {fieldError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => save(e.id)}
                      className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity duration-150 active:opacity-85 disabled:opacity-50"
                      style={{
                        background: "var(--accent-primary)",
                        color: "var(--accent-on-primary)",
                      }}
                    >
                      <CheckIcon className="h-4 w-4" />
                      {isBusy ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setEditing(null);
                        setFieldError(null);
                      }}
                      className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity duration-150 active:opacity-80"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <XIcon className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={e.id}
                className="py-4 transition-colors duration-150"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      <CategoryIcon category={e.category} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate text-base font-semibold leading-snug">{e.name}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span
                          className="inline-block rounded-md px-1.5 py-0.5 font-medium"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {e.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={e.created_at} className="font-mono tabular-nums">
                          {fmt(e.created_at)}
                        </time>
                      </p>

                      {/* Connected Nutritional Facts */}
                      {e.calories != null ? (
                        <div className="space-y-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-semibold tabular-nums">
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5"
                              style={{ background: "var(--cat-groceries-bg)", color: "var(--cat-groceries-fg)" }}
                            >
                              <FlameIcon className="h-3.5 w-3.5" />
                              {Math.round(e.calories)} kcal
                            </span>
                            {e.protein_g != null && (
                              <span
                                className="rounded-md px-2 py-0.5 font-medium"
                                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
                              >
                                P {e.protein_g}g
                              </span>
                            )}
                            {e.carbs_g != null && (
                              <span
                                className="rounded-md px-2 py-0.5 font-medium"
                                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
                              >
                                C {e.carbs_g}g
                              </span>
                            )}
                            {e.fat_g != null && (
                              <span
                                className="rounded-md px-2 py-0.5 font-medium"
                                style={{ background: "var(--surface-subtle)", color: "var(--text-primary)" }}
                              >
                                F {e.fat_g}g
                              </span>
                            )}
                          </div>
                          {e.nutrition_note && (
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {e.nutrition_note}
                            </p>
                          )}
                        </div>
                      ) : isEdible ? (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            disabled={isEstimating}
                            onClick={() => estimateNutritionForRow(e, false)}
                            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity active:opacity-80 disabled:opacity-50"
                            style={{
                              background: "var(--surface-subtle)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--accent-text)",
                            }}
                          >
                            <SparklesIcon className="h-3.5 w-3.5" />
                            <span>{isEstimating ? "Estimating with AI..." : "Estimate Nutrition with AI"}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <p className="mr-1 font-mono text-sm font-semibold tabular-nums sm:text-base">
                      {rp(e.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      aria-label={`Edit ${e.name}`}
                      className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 active:opacity-80"
                      style={{
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(confirmDeleteId === e.id ? null : e.id)}
                      aria-label={`Delete ${e.name}`}
                      aria-expanded={confirmDeleteId === e.id}
                      className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 active:opacity-80"
                      style={{
                        background: confirmDeleteId === e.id ? "var(--danger-soft)" : "var(--surface-subtle)",
                        border: `1px solid ${confirmDeleteId === e.id ? "var(--danger)" : "var(--border-subtle)"}`,
                        color: "var(--danger)",
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {confirmDeleteId === e.id && (
                  <div
                    className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
                    style={{
                      background: "var(--danger-soft)",
                      border: "1px solid var(--danger)",
                    }}
                  >
                    <p className="text-xs font-medium sm:text-sm" style={{ color: "var(--text-primary)" }}>
                      Delete <strong>{e.name}</strong> ({rp(e.amount)})?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(null)}
                        className="focus-ring min-h-11 rounded-lg px-3.5 py-2 text-xs font-semibold"
                        style={{
                          background: "var(--surface-elevated)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => confirmDelete(e)}
                        className="focus-ring min-h-11 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: "var(--danger)",
                          color: "var(--danger-on)",
                        }}
                      >
                        {isBusy ? "Deleting..." : "Confirm delete"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
