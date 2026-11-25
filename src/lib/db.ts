import { neon } from "@neondatabase/serverless";

export type Expense = { id: number; name: string; amount: number; category: string; created_at: string };

const TZ = "Asia/Jakarta";
let initPromise: Promise<unknown> | null = null;

function sql() {
  return neon(process.env.DATABASE_URL!);
}

function init() {
  initPromise ??= sql()`CREATE TABLE IF NOT EXISTS expenses (
    id serial PRIMARY KEY,
    name text NOT NULL,
    amount bigint NOT NULL,
    category text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`.catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}

const fix = (r: Record<string, unknown>): Expense => ({
  id: Number(r.id),
  name: String(r.name),
  amount: Number(r.amount),
  category: String(r.category),
  created_at: new Date(r.created_at as string).toISOString(),
});

export async function addExpense(name: string, amount: number, category: string) {
  await init();
  const r = await sql()`INSERT INTO expenses(name, amount, category) VALUES (${name}, ${amount}, ${category}) RETURNING *`;
  return fix(r[0]);
}

export async function undoLast() {
  await init();
  const r = await sql()`DELETE FROM expenses WHERE id = (SELECT id FROM expenses ORDER BY id DESC LIMIT 1) RETURNING *`;
  return r[0] ? fix(r[0]) : null;
}

export async function removeExpense(id: number) {
  await init();
  await sql()`DELETE FROM expenses WHERE id = ${id}`;
}

export async function updateExpense(id: number, name: string, amount: number, category: string) {
  await init();
  await sql()`UPDATE expenses SET name = ${name}, amount = ${amount}, category = ${category} WHERE id = ${id}`;
}

export async function listRecent(limit = 50) {
  await init();
  const r = await sql()`SELECT * FROM expenses ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return r.map(fix);
}

export async function listToday() {
  await init();
  const r = await sql()`SELECT * FROM expenses
    WHERE (created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
    ORDER BY created_at`;
  return r.map(fix);
}

export async function totals() {
  await init();
  const r = await sql()`SELECT
    COALESCE(SUM(amount) FILTER (WHERE d = today), 0) AS today,
    COALESCE(SUM(amount) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week,
    COALESCE(SUM(amount) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month
    FROM (SELECT amount, (created_at AT TIME ZONE ${TZ})::date AS d, (now() AT TIME ZONE ${TZ})::date AS today FROM expenses) t`;
  return { today: Number(r[0].today), week: Number(r[0].week), month: Number(r[0].month) };
}

export async function byDay(days = 30) {
  await init();
  const r = await sql()`SELECT to_char(g.d, 'YYYY-MM-DD') AS day, COALESCE(SUM(e.amount), 0) AS total
    FROM generate_series((now() AT TIME ZONE ${TZ})::date - ${days - 1}::int, (now() AT TIME ZONE ${TZ})::date, interval '1 day') AS g(d)
    LEFT JOIN expenses e ON (e.created_at AT TIME ZONE ${TZ})::date = g.d::date
    GROUP BY g.d ORDER BY g.d`;
  return r.map((x) => ({ day: String(x.day), total: Number(x.total) }));
}

export async function byCategory() {
  await init();
  const r = await sql()`SELECT category, SUM(amount) AS total FROM expenses
    WHERE date_trunc('month', created_at AT TIME ZONE ${TZ}) = date_trunc('month', now() AT TIME ZONE ${TZ})
    GROUP BY category ORDER BY total DESC`;
  return r.map((x) => ({ category: String(x.category), total: Number(x.total) }));
}
