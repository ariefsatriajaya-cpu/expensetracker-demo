import { NextRequest, NextResponse } from "next/server";
import { getExpenseById, removeExpense, updateExpense, type NutritionFacts } from "@/lib/db";
import { CATEGORIES } from "@/lib/categorize";
import { analyzeExpenseOrFood } from "@/lib/nutrition";

type Ctx = { params: Promise<{ id: string }> };

function optNum(v: unknown, roundInt = false): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundInt ? Math.round(n) : Math.round(n * 10) / 10;
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await removeExpense(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const b = await req.json().catch(() => null);

  // One-tap AI Nutrition Estimation for an existing expense
  if (b?.estimateWithAi) {
    const existing = await getExpenseById(id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const targetName = String(b?.name ?? existing.name).trim() || existing.name;
    const ai = await analyzeExpenseOrFood({
      description: targetName,
      forceFoodAnalysis: true,
    });
    if (!ai.aiUsed) {
      return NextResponse.json(
        { error: ai.errorReason || "Could not estimate nutrition with Gemini AI." },
        { status: 503 },
      );
    }
    const updated = await updateExpense(
      id,
      targetName,
      Number(b?.amount) > 0 ? Math.round(Number(b.amount)) : existing.amount,
      b?.category && (CATEGORIES as readonly string[]).includes(String(b.category))
        ? String(b.category)
        : existing.category,
      ai.nutrition,
    );
    return NextResponse.json({ ok: true, expense: updated, nutrition: ai.nutrition });
  }

  const name = String(b?.name ?? "").trim();
  const amount = Number(b?.amount);
  const category = String(b?.category ?? "");
  if (!name || !Number.isFinite(amount) || amount <= 0 || !(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  let nutrition: Partial<NutritionFacts> | undefined;
  if ("calories" in (b ?? {}) || "protein_g" in (b ?? {}) || "carbs_g" in (b ?? {}) || "fat_g" in (b ?? {}) || "nutrition_note" in (b ?? {})) {
    nutrition = {
      calories: optNum(b.calories, true),
      protein_g: optNum(b.protein_g, false),
      carbs_g: optNum(b.carbs_g, false),
      fat_g: optNum(b.fat_g, false),
      nutrition_note: b.nutrition_note ? String(b.nutrition_note).trim().slice(0, 140) : null,
    };
  }

  const updated = await updateExpense(id, name, Math.round(amount), category, nutrition);
  return NextResponse.json({ ok: true, expense: updated });
}
