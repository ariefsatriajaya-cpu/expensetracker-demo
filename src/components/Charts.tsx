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
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
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
        className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          No spending recorded in the last 30 days
        </p>
        <p className="mt-1.5 text-xs sm:text-sm">
          Send a message like <code className="font-mono font-semibold">kopi 18k</code> to your Telegram bot to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm"
        style={{ background: "var(--surface-subtle)", color: "var(--text-secondary)" }}
      >
        <span>
          Active on{" "}
          <strong className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeDays.length}
          </strong>{" "}
          of 30 days
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

      <div className="h-60 w-full min-w-0 flex-1 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 14, right: 14, left: 2, bottom: 6 }}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.38} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => shortDate(d)}
              minTickGap={24}
              tickMargin={8}
              padding={{ left: 8, right: 12 }}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
            />
            <YAxis
              tickFormatter={(v: number) => compactRp(v)}
              tickMargin={6}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
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
              strokeWidth={2.5}
              fill="url(#spendGradient)"
              isAnimationActive={!reducedMotion}
              dot={(props: { cx?: number; cy?: number; payload?: { day: string; total: number } }) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy || !payload || payload.total <= 0) return <g key={payload?.day ?? "empty"} />;
                return (
                  <circle
                    key={payload.day}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#10b981"
                    stroke="var(--surface-elevated)"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#ffffff", fill: "#10b981" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="rounded-xl text-xs sm:text-sm" style={{ background: "var(--surface-subtle)" }}>
        <summary
          className="focus-ring flex min-h-11 items-center justify-between rounded-xl px-4 py-2.5 font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>View daily table ({activeDays.length} active {activeDays.length === 1 ? "day" : "days"})</span>
          <span
            aria-hidden="true"
            className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
            style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}
          >
            Table
          </span>
        </summary>
        <div className="max-h-48 overflow-y-auto px-4 pb-3">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                <th scope="col" className="py-2 font-medium">Date</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...activeDays].reverse().map((row) => (
                <tr key={row.day} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-2 font-medium">{shortDate(row.day)}</td>
                  <td className="py-2 text-right font-mono font-semibold tabular-nums">{rp(row.total)}</td>
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
        className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          No category breakdown for this month yet
        </p>
        <p className="mt-1.5 text-xs sm:text-sm">
          Meals and expenses are automatically grouped into Food, Drink, Transport, Groceries, Bills, or Other.
        </p>
      </div>
    );
  }

  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      {/* Centered Donut Diagram with Total in Center */}
      <div className="relative mx-auto flex h-48 w-48 shrink-0 items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={data.length > 1 ? 3 : 0}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Month Total
          </span>
          <span className="mt-0.5 font-mono text-sm font-bold tabular-nums sm:text-base">
            {rp(grandTotal)}
          </span>
        </div>
      </div>

      {/* Full-Width Proportional Category Breakdown List */}
      <ul className="space-y-2.5">
        {data.map((d) => {
          const meta = CATEGORY_META[d.category] ?? CATEGORY_META.Other;
          const pct = grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0;
          return (
            <li
              key={d.category}
              className="space-y-2 rounded-xl p-3"
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2.5 font-semibold">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <CategoryIcon category={d.category} className="h-4 w-4" />
                  </span>
                  <span className="truncate">{d.category}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums sm:text-sm">
                  <span
                    className="mr-2 rounded-md px-1.5 py-0.5 font-semibold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {pct}%
                  </span>
                  <strong className="font-bold" style={{ color: "var(--text-primary)" }}>
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
                  style={{ width: `${Math.max(pct, 4)}%`, background: meta.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
