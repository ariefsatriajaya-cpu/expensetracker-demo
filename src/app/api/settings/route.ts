import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const settings = await updateSettings({
    body_weight_kg: b.body_weight_kg !== undefined ? Number(b.body_weight_kg) : undefined,
    daily_budget: b.daily_budget !== undefined ? Number(b.daily_budget) : undefined,
    monthly_budget: b.monthly_budget !== undefined ? Number(b.monthly_budget) : undefined,
    daily_calories: b.daily_calories !== undefined ? Number(b.daily_calories) : undefined,
    daily_protein_g: b.daily_protein_g !== undefined ? Number(b.daily_protein_g) : undefined,
    daily_carbs_g: b.daily_carbs_g !== undefined ? Number(b.daily_carbs_g) : undefined,
    daily_fat_g: b.daily_fat_g !== undefined ? Number(b.daily_fat_g) : undefined,
  });
  return NextResponse.json({ ok: true, settings });
}
