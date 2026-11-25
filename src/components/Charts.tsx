"use client";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { rp } from "@/lib/format";

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#a855f7", "#ef4444", "#64748b"];

export function DailyChart({ data }: { data: { day: string; total: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(8)} interval={4} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => rp(Number(v))} />
          <Bar dataKey="total" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; total: number }[] }) {
  if (!data.length) return <p className="text-sm opacity-60">No data this month.</p>;
  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="category" innerRadius={35} outerRadius={65}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.category} className="flex justify-between">
            <span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.category}</span>
            <span>{rp(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
