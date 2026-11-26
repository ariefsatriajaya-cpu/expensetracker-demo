import { NextRequest, NextResponse } from "next/server";
import { addExpense, listToday, totals, undoLast } from "@/lib/db";
import { parseExpense } from "@/lib/parse";
import { categorize } from "@/lib/categorize";
import { rp } from "@/lib/format";
import { sendMessage } from "@/lib/telegram";
import { safeEqual } from "@/lib/session";

export async function POST(req: NextRequest) {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  const got = (req.headers.get("x-telegram-bot-api-secret-token") ?? "").trim();
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  if (!msg?.text) {
    return NextResponse.json({ ok: true, reason: "no_text" });
  }
  const allowedId = (process.env.ALLOWED_TELEGRAM_ID ?? "").trim();
  if (String(msg.from?.id) !== allowedId) {
    return NextResponse.json({ ok: true, reason: "id_mismatch" });
  }
  const chat: number = msg.chat.id;
  const text: string = msg.text.trim();

  let sent = false;
  try {
    if (text.startsWith("/undo")) {
      const e = await undoLast();
      if (e) {
        const t = await totals();
        sent = await sendMessage(
          chat,
          `↩️ Removed ${e.name} – ${rp(e.amount)}\n📅 Today's total: ${rp(t.today)}`,
        );
      } else {
        sent = await sendMessage(chat, "Nothing to undo.");
      }
    } else if (text.startsWith("/today")) {
      const items = await listToday();
      const total = items.reduce((s, e) => s + e.amount, 0);
      sent = await sendMessage(
        chat,
        items.length ? items.map((e) => `• ${e.name} – ${rp(e.amount)}`).join("\n") + `\n\n📅 Today's total: ${rp(total)}` : "No expenses today.",
      );
    } else if (text.startsWith("/")) {
      sent = await sendMessage(chat, "Send: <meal name> <cost>, e.g. nasi goreng 25k\n/today – today's list\n/undo – remove last");
    } else {
      const p = parseExpense(text);
      if (!p) {
        sent = await sendMessage(chat, "Couldn't read that. Use: <meal name> <cost>, e.g. nasi goreng 25000");
      } else {
        const category = categorize(p.name);
        await addExpense(p.name, p.amount, category);
        const t = await totals();
        sent = await sendMessage(
          chat,
          `✅ ${p.name} – ${rp(p.amount)} (${category})\n📅 Today's total: ${rp(t.today)}`,
        );
      }
    }
  } catch (err) {
    console.error(err);
    sent = await sendMessage(chat, "⚠️ Something went wrong, try again.");
    return NextResponse.json({ ok: true, reason: "db_error", sent });
  }
  return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
}
