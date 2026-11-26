import { NextRequest, NextResponse } from "next/server";
import { addExpense, listToday, undoLast } from "@/lib/db";
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
  const allowedId = (process.env.ALLOWED_TELEGRAM_ID ?? "").trim();
  if (!msg?.text || String(msg.from?.id) !== allowedId) {
    return NextResponse.json({ ok: true });
  }
  const chat: number = msg.chat.id;
  const text: string = msg.text.trim();

  try {
    if (text.startsWith("/undo")) {
      const e = await undoLast();
      await sendMessage(chat, e ? `↩️ Removed ${e.name} – ${rp(e.amount)}` : "Nothing to undo.");
    } else if (text.startsWith("/today")) {
      const items = await listToday();
      const total = items.reduce((s, e) => s + e.amount, 0);
      await sendMessage(
        chat,
        items.length ? items.map((e) => `• ${e.name} – ${rp(e.amount)}`).join("\n") + `\n\nTotal: ${rp(total)}` : "No expenses today.",
      );
    } else if (text.startsWith("/")) {
      await sendMessage(chat, "Send: <meal name> <cost>, e.g. nasi goreng 25k\n/today – today's list\n/undo – remove last");
    } else {
      const p = parseExpense(text);
      if (!p) {
        await sendMessage(chat, "Couldn't read that. Use: <meal name> <cost>, e.g. nasi goreng 25000");
      } else {
        const category = categorize(p.name);
        await addExpense(p.name, p.amount, category);
        await sendMessage(chat, `✅ ${p.name} – ${rp(p.amount)} (${category})`);
      }
    }
  } catch (err) {
    console.error(err);
    await sendMessage(chat, "⚠️ Something went wrong, try again.");
  }
  return NextResponse.json({ ok: true });
}
