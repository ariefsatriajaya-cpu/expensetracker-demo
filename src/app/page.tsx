import { byCategory, byDay, listRecent, totals } from "@/lib/db";
import { rp } from "@/lib/format";
import { CategoryChart, DailyChart } from "@/components/Charts";
import RecentList from "@/components/RecentList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [t, days, cats, recent] = await Promise.all([totals(), byDay(30), byCategory(), listRecent(50)]);
  const cards = [
    ["Today", t.today],
    ["This week", t.week],
    ["This month", t.month],
  ] as const;
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-4">
      <h1 className="text-xl font-bold">Expenses</h1>
      <section className="grid grid-cols-3 gap-2">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-xs opacity-70">{label}</p>
            <p className="text-sm font-bold sm:text-base">{rp(v)}</p>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Last 30 days</h2>
        <DailyChart data={days} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Categories (this month)</h2>
        <CategoryChart data={cats} />
      </section>
      <section>
        <h2 className="mb-1 font-semibold">Recent</h2>
        <RecentList items={recent} />
      </section>
    </main>
  );
}
