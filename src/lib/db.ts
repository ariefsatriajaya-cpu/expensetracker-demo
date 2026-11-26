import { neon } from "@neondatabase/serverless";

export type Period = "day" | "week" | "month";

export type NutritionFacts = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrition_note: string | null;
};

export type Expense = {
  id: number;
  name: string;
  amount: number;
  category: string;
  created_at: string;
  is_today?: boolean;
  is_week?: boolean;
  is_month?: boolean;
} & NutritionFacts;

export type PeriodNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedItems: number;
};

const TZ = "Asia/Jakarta";
let initPromise: Promise<unknown> | null = null;

function sql() {
  return neon(process.env.DATABASE_URL!);
}

function init() {
  initPromise ??= (async () => {
    const db = sql();
    await db`CREATE TABLE IF NOT EXISTS expenses (
      id serial PRIMARY KEY,
      name text NOT NULL,
      amount bigint NOT NULL,
      category text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await db`ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS calories integer,
      ADD COLUMN IF NOT EXISTS protein_g numeric(6,1),
      ADD COLUMN IF NOT EXISTS carbs_g numeric(6,1),
      ADD COLUMN IF NOT EXISTS fat_g numeric(6,1),
      ADD COLUMN IF NOT EXISTS nutrition_note text`;
  })().catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fix = (r: Record<string, unknown>): Expense => ({
  id: Number(r.id),
  name: String(r.name),
  amount: Number(r.amount),
  category: String(r.category),
  created_at: new Date(r.created_at as string).toISOString(),
  calories: numOrNull(r.calories),
  protein_g: numOrNull(r.protein_g),
  carbs_g: numOrNull(r.carbs_g),
  fat_g: numOrNull(r.fat_g),
  nutrition_note: r.nutrition_note ? String(r.nutrition_note) : null,
  ...(typeof r.is_today === "boolean" ? { is_today: r.is_today } : {}),
  ...(typeof r.is_week === "boolean" ? { is_week: r.is_week } : {}),
  ...(typeof r.is_month === "boolean" ? { is_month: r.is_month } : {}),
});

export async function addExpense(
  name: string,
  amount: number,
  category: string,
  nutrition?: Partial<NutritionFacts>,
) {
  await init();
  const cal = nutrition?.calories ?? null;
  const pro = nutrition?.protein_g ?? null;
  const carb = nutrition?.carbs_g ?? null;
  const fat = nutrition?.fat_g ?? null;
  const note = nutrition?.nutrition_note ?? null;
  const r = await sql()`INSERT INTO expenses(name, amount, category, calories, protein_g, carbs_g, fat_g, nutrition_note)
    VALUES (${name}, ${amount}, ${category}, ${cal}, ${pro}, ${carb}, ${fat}, ${note})
    RETURNING *`;
  return fix(r[0]);
}

export async function getExpenseById(id: number) {
  await init();
  const r = await sql()`SELECT * FROM expenses WHERE id = ${id} LIMIT 1`;
  return r[0] ? fix(r[0]) : null;
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

export async function updateExpense(
  id: number,
  name: string,
  amount: number,
  category: string,
  nutrition?: Partial<NutritionFacts>,
) {
  await init();
  if (nutrition !== undefined) {
    const cal = nutrition.calories ?? null;
    const pro = nutrition.protein_g ?? null;
    const carb = nutrition.carbs_g ?? null;
    const fat = nutrition.fat_g ?? null;
    const note = nutrition.nutrition_note ?? null;
    const r = await sql()`UPDATE expenses
      SET name = ${name}, amount = ${amount}, category = ${category},
          calories = ${cal}, protein_g = ${pro}, carbs_g = ${carb}, fat_g = ${fat}, nutrition_note = ${note}
      WHERE id = ${id}
      RETURNING *`;
    return r[0] ? fix(r[0]) : null;
  }
  const r = await sql()`UPDATE expenses SET name = ${name}, amount = ${amount}, category = ${category} WHERE id = ${id} RETURNING *`;
  return r[0] ? fix(r[0]) : null;
}

export async function listRecent(limit = 150) {
  await init();
  const r = await sql()`SELECT
      e.*,
      ((e.created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date) AS is_today,
      ((e.created_at AT TIME ZONE ${TZ})::date >= date_trunc('week', (now() AT TIME ZONE ${TZ})::date::timestamp)::date) AS is_week,
      ((e.created_at AT TIME ZONE ${TZ})::date >= date_trunc('month', (now() AT TIME ZONE ${TZ})::date::timestamp)::date) AS is_month
    FROM expenses e
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ${limit}`;
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

export async function nutritionTotals(): Promise<Record<Period, PeriodNutrition>> {
  await init();
  const r = await sql()`SELECT
    COALESCE(SUM(calories) FILTER (WHERE d = today), 0) AS day_cal,
    COALESCE(SUM(protein_g) FILTER (WHERE d = today), 0) AS day_pro,
    COALESCE(SUM(carbs_g) FILTER (WHERE d = today), 0) AS day_carb,
    COALESCE(SUM(fat_g) FILTER (WHERE d = today), 0) AS day_fat,
    COUNT(*) FILTER (WHERE d = today AND calories IS NOT NULL) AS day_items,

    COALESCE(SUM(calories) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week_cal,
    COALESCE(SUM(protein_g) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week_pro,
    COALESCE(SUM(carbs_g) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week_carb,
    COALESCE(SUM(fat_g) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week_fat,
    COUNT(*) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date AND calories IS NOT NULL) AS week_items,

    COALESCE(SUM(calories) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month_cal,
    COALESCE(SUM(protein_g) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month_pro,
    COALESCE(SUM(carbs_g) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month_carb,
    COALESCE(SUM(fat_g) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month_fat,
    COUNT(*) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date AND calories IS NOT NULL) AS month_items
    FROM (
      SELECT calories, protein_g, carbs_g, fat_g,
             (created_at AT TIME ZONE ${TZ})::date AS d,
             (now() AT TIME ZONE ${TZ})::date AS today
      FROM expenses
    ) t`;

  const row = r[0] ?? {};
  const round1 = (v: unknown) => Math.round(Number(v ?? 0) * 10) / 10;
  return {
    day: {
      calories: Math.round(Number(row.day_cal ?? 0)),
      protein: round1(row.day_pro),
      carbs: round1(row.day_carb),
      fat: round1(row.day_fat),
      loggedItems: Number(row.day_items ?? 0),
    },
    week: {
      calories: Math.round(Number(row.week_cal ?? 0)),
      protein: round1(row.week_pro),
      carbs: round1(row.week_carb),
      fat: round1(row.week_fat),
      loggedItems: Number(row.week_items ?? 0),
    },
    month: {
      calories: Math.round(Number(row.month_cal ?? 0)),
      protein: round1(row.month_pro),
      carbs: round1(row.month_carb),
      fat: round1(row.month_fat),
      loggedItems: Number(row.month_items ?? 0),
    },
  };
}

export async function byDay(days = 30) {
  await init();
  const r = await sql()`SELECT to_char(g.d, 'YYYY-MM-DD') AS day, COALESCE(SUM(e.amount), 0) AS total
    FROM generate_series((now() AT TIME ZONE ${TZ})::date - ${days - 1}::int, (now() AT TIME ZONE ${TZ})::date, interval '1 day') AS g(d)
    LEFT JOIN expenses e ON (e.created_at AT TIME ZONE ${TZ})::date = g.d::date
    GROUP BY g.d ORDER BY g.d`;
  return r.map((x) => ({ day: String(x.day), total: Number(x.total) }));
}

export async function byHourToday() {
  await init();
  const r = await sql()`SELECT
      lpad(g.h::text, 2, '0') || ':00' AS day,
      COALESCE(SUM(e.amount), 0) AS total
    FROM generate_series(0, 23) AS g(h)
    LEFT JOIN expenses e
      ON (e.created_at AT TIME ZONE ${TZ})::date = (now() AT TIME ZONE ${TZ})::date
     AND EXTRACT(HOUR FROM (e.created_at AT TIME ZONE ${TZ}))::int = g.h
    GROUP BY g.h
    ORDER BY g.h`;
  return r.map((x) => ({ day: String(x.day), total: Number(x.total) }));
}

export async function byCategory() {
  await init();
  const r = await sql()`SELECT category, SUM(amount) AS total FROM expenses
    WHERE date_trunc('month', created_at AT TIME ZONE ${TZ}) = date_trunc('month', now() AT TIME ZONE ${TZ})
    GROUP BY category ORDER BY total DESC`;
  return r.map((x) => ({ category: String(x.category), total: Number(x.total) }));
}

export async function byCategoryAllPeriods(): Promise<
  Record<Period, Array<{ category: string; total: number }>>
> {
  await init();
  const r = await sql()`SELECT
      category,
      COALESCE(SUM(amount) FILTER (WHERE d = today), 0) AS day_total,
      COALESCE(SUM(amount) FILTER (WHERE d >= date_trunc('week', today::timestamp)::date), 0) AS week_total,
      COALESCE(SUM(amount) FILTER (WHERE d >= date_trunc('month', today::timestamp)::date), 0) AS month_total
    FROM (
      SELECT category, amount,
             (created_at AT TIME ZONE ${TZ})::date AS d,
             (now() AT TIME ZONE ${TZ})::date AS today
      FROM expenses
    ) t
    GROUP BY category`;

  const build = (key: "day_total" | "week_total" | "month_total") =>
    r
      .map((x) => ({ category: String(x.category), total: Number(x[key] ?? 0) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);

  return {
    day: build("day_total"),
    week: build("week_total"),
    month: build("month_total"),
  };
}
