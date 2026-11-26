"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_META, CategoryIcon } from "@/components/Icons";
import { rp } from "@/lib/format";

function useReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function compactRp(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function shortDate(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function DailyChart({ data }: { data: { day: string; total: number }[] }) {
  const reducedMotion = useReducedMotion();
  const activeDays = data.filter((d) => d.total > 0);
  const peak = data.reduce<{ day: string; total: number }>(
    (max, cur) => (cur.total > max.total ? cur : max),
    { day: "", total: 0 },
  );

  if (!activeDays.length) {
    return (
      <div
        className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          No spending recorded in the last 30 days
        </p>
        <p className="mt-1 text-xs">
          Send a message like <code className="font-mono">kopi 18k</code> to your Telegram bot to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>
          Active on <strong className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{activeDays.length}</strong> of 30 days
        </span>
        {peak.total > 0 && (
          <span>
            Peak:{" "}
            <strong className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
              {rp(peak.total)}
            </strong>{" "}
            ({shortDate(peak.day)})
          </span>
        )}
      </div>

      <div className="h-52 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => d.slice(8)}
              interval={4}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            />
            <YAxis
              tickFormatter={(v: number) => compactRp(v)}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            />
            <Tooltip
              formatter={(v) => [rp(Number(v ?? 0)), "Spent"]}
              labelFormatter={(l) => shortDate(String(l ?? ""))}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "13px",
                boxShadow: "var(--shadow-card)",
              }}
              itemStyle={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
              labelStyle={{ color: "var(--text-secondary)", marginBottom: "2px" }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2.25}
              fill="url(#spendGradient)"
              isAnimationActive={!reducedMotion}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="rounded-xl text-xs" style={{ background: "var(--surface-subtle)" }}>
        <summary
          className="focus-ring flex min-h-11 items-center justify-between rounded-xl px-3.5 py-2.5 font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>View daily table ({activeDays.length} active days)</span>
          <span aria-hidden="true" className="font-mono text-[11px]">
            Table
          </span>
        </summary>
        <div className="max-h-48 overflow-y-auto px-3.5 pb-3">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                <th scope="col" className="py-1.5 font-medium">Date</th>
                <th scope="col" className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...activeDays].reverse().map((row) => (
                <tr key={row.day} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-1.5">{shortDate(row.day)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{rp(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; total: number }[] }) {
  const reducedMotion = useReducedMotion();

  if (!data.length) {
    return (
      <div
        className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          No category breakdown for this month yet
        </p>
        <p className="mt-1 text-xs">
          Meals and expenses are automatically grouped into Food, Drink, Transport, Groceries, Bills, or Other.
        </p>
      </div>
    );
  }

  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="mx-auto h-40 w-40 shrink-0 sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive={!reducedMotion}
            >
              {data.map((entry) => {
                const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.Other;
                return <Cell key={entry.category} fill={meta.color} />;
              })}
            </Pie>
            <Tooltip
              formatter={(v) => rp(Number(v ?? 0))}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "13px",
              }}
              itemStyle={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 space-y-3">
        {data.map((d) => {
          const meta = CATEGORY_META[d.category] ?? CATEGORY_META.Other;
          const pct = grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0;
          return (
            <li key={d.category} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <CategoryIcon category={d.category} className="h-4 w-4" />
                  </span>
                  <span className="truncate">{d.category}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums sm:text-sm">
                  <span className="mr-2" style={{ color: "var(--text-secondary)" }}>
                    {pct}%
                  </span>
                  <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {rp(d.total)}
                  </strong>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--surface-muted)" }}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(pct, 3)}%`, background: meta.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
