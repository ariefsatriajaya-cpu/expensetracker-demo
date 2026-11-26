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
    daily_budget: Number(b.daily_budget),
    monthly_budget: Number(b.monthly_budget),
    daily_calories: Number(b.daily_calories),
    daily_protein_g: Number(b.daily_protein_g),
    daily_carbs_g: Number(b.daily_carbs_g),
    daily_fat_g: Number(b.daily_fat_g),
  });
  return NextResponse.json({ ok: true, settings });
}
