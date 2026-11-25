import { NextRequest, NextResponse } from "next/server";
import { removeExpense, updateExpense } from "@/lib/db";
import { CATEGORIES } from "@/lib/categorize";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await removeExpense(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  const amount = Number(b?.amount);
  const category = String(b?.category ?? "");
  if (!Number.isInteger(id) || !name || !Number.isFinite(amount) || amount <= 0 || !(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  await updateExpense(id, name, Math.round(amount), category);
  return NextResponse.json({ ok: true });
}
