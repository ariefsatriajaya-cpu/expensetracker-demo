import { NextRequest, NextResponse } from "next/server";
import { addExpense } from "@/lib/db";
import { CATEGORIES } from "@/lib/categorize";
import { analyzeExpenseOrFood } from "@/lib/nutrition";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  const amount = Number(b?.amount);
  const extraNotes = String(b?.extraNotes ?? "").trim();
  const requestedCategory = String(b?.category ?? "").trim();
  const autoAi = b?.autoAi !== false;

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valid name and amount are required." }, { status: 400 });
  }

  let finalCategory =
    (CATEGORIES as readonly string[]).includes(requestedCategory) ? requestedCategory : "";
  let nutrition = undefined;

  if (autoAi) {
    const ai = await analyzeExpenseOrFood({
      description: name,
      extraNotes: extraNotes || undefined,
      forceFoodAnalysis: finalCategory === "Food" || finalCategory === "Drink",
    });
    if (!finalCategory) finalCategory = ai.category;
    if (ai.isFoodOrDrink || finalCategory === "Food" || finalCategory === "Drink") {
      nutrition = ai.nutrition;
    }
  }

  if (!finalCategory) finalCategory = "Other";

  const saved = await addExpense(name, Math.round(amount), finalCategory, nutrition);
  return NextResponse.json({ ok: true, expense: saved });
}
