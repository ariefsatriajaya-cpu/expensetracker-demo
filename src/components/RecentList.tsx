"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categorize";
import { rp } from "@/lib/format";
import type { Expense } from "@/lib/db";

export default function RecentList({ items }: { items: Expense[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [f, setF] = useState({ name: "", amount: "", category: "Other" });

  async function del(id: number) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function save(id: number) {
    await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: f.name, amount: Number(f.amount), category: f.category }),
    });
    setEditing(null);
    router.refresh();
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  if (!items.length) return <p className="text-sm opacity-60">No expenses yet. Send one to your bot!</p>;
  return (
    <ul className="divide-y divide-gray-500/20">
      {items.map((e) =>
        editing === e.id ? (
          <li key={e.id} className="space-y-2 py-3">
            <input value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} className="w-full rounded border border-gray-400 bg-transparent p-2" />
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={f.amount} onChange={(x) => setF({ ...f, amount: x.target.value })} className="w-1/2 rounded border border-gray-400 bg-transparent p-2" />
              <select value={f.category} onChange={(x) => setF({ ...f, category: x.target.value })} className="w-1/2 rounded border border-gray-400 bg-transparent p-2">
                {CATEGORIES.map((c) => (
                  <option key={c} className="text-black">{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => save(e.id)} className="font-semibold text-emerald-500">Save</button>
              <button onClick={() => setEditing(null)} className="opacity-70">Cancel</button>
            </div>
          </li>
        ) : (
          <li key={e.id} className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{e.name}</p>
              <p className="text-xs opacity-60">{e.category} · {fmt(e.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{rp(e.amount)}</p>
              <div className="flex justify-end gap-3 text-xs">
                <button onClick={() => { setEditing(e.id); setF({ name: e.name, amount: String(e.amount), category: e.category }); }} className="text-sky-500">Edit</button>
                <button onClick={() => del(e.id)} className="text-red-500">Delete</button>
              </div>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
