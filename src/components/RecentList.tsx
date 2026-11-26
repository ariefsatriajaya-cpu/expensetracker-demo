"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categorize";
import {
  CATEGORY_META,
  CategoryIcon,
  CheckIcon,
  EditIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  XIcon,
} from "@/components/Icons";
import { rp } from "@/lib/format";
import type { Expense } from "@/lib/db";

export default function RecentList({ items }: { items: Expense[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [f, setF] = useState({ name: "", amount: "", category: "Other" });

  function startEdit(e: Expense) {
    setConfirmDeleteId(null);
    setFieldError(null);
    setEditing(e.id);
    setF({ name: e.name, amount: String(e.amount), category: e.category });
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
        body: JSON.stringify({ name: trimmedName, amount: Math.round(numericAmount), category: f.category }),
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
          Open your Telegram bot and send <code className="font-mono font-medium">nasi goreng 25k</code> to log your first meal.
        </p>
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((e) => {
    const matchesCat = activeCategory === "All" || e.category === activeCategory;
    const matchesQuery = !normalizedQuery || e.name.toLowerCase().includes(normalizedQuery) || e.category.toLowerCase().includes(normalizedQuery);
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
            placeholder="Filter by meal or category..."
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
                className="py-3.5 transition-colors duration-150"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      <CategoryIcon category={e.category} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold leading-snug">{e.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
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
