import { NextRequest, NextResponse } from "next/server";
import { addExpense, listToday, undoLast } from "@/lib/db";
import { parseAmountOnly, parseExpense, parseNutritionQuery } from "@/lib/parse";
import { rp } from "@/lib/format";
import { analyzeExpenseOrFood, formatNutritionBlock } from "@/lib/nutrition";
import { downloadTelegramPhoto, sendMessage } from "@/lib/telegram";
import { safeEqual } from "@/lib/session";

async function formatTodaySummary() {
  const items = await listToday();
  if (!items.length) return "📅 Today's expenses: none\n💰 Today's total: Rp0";

  const totalRp = items.reduce((s, e) => s + e.amount, 0);
  const totalCal = items.reduce((s, e) => s + (e.calories ?? 0), 0);
  const totalPro = Math.round(items.reduce((s, e) => s + (e.protein_g ?? 0), 0) * 10) / 10;
  const totalCarb = Math.round(items.reduce((s, e) => s + (e.carbs_g ?? 0), 0) * 10) / 10;
  const totalFat = Math.round(items.reduce((s, e) => s + (e.fat_g ?? 0), 0) * 10) / 10;

  const lines = items
    .map((e, i) => {
      const calTag = e.calories != null ? ` · 🔥 ${Math.round(e.calories)} kcal` : "";
      return `${i + 1}. ${e.name} – ${rp(e.amount)} (${e.category})${calTag}`;
    })
    .join("\n");

  const nutriFooter =
    totalCal > 0
      ? `\n🥗 Today's nutrition: ${Math.round(totalCal)} kcal (P ${totalPro}g · C ${totalCarb}g · F ${totalFat}g)`
      : "";

  return `📅 Today's expenses (${items.length}):\n${lines}\n\n💰 Today's total: ${rp(totalRp)}${nutriFooter}`;
}

export async function POST(req: NextRequest) {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  const got = (req.headers.get("x-telegram-bot-api-secret-token") ?? "").trim();
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const hasPhoto = Array.isArray(msg?.photo) && msg.photo.length > 0;
  const rawText: string = String(msg?.text ?? msg?.caption ?? "").trim();

  if (!rawText && !hasPhoto) {
    return NextResponse.json({ ok: true, reason: "no_text" });
  }
  const allowedId = (process.env.ALLOWED_TELEGRAM_ID ?? "").trim();
  if (String(msg?.from?.id) !== allowedId) {
    return NextResponse.json({ ok: true, reason: "id_mismatch" });
  }
  const chat: number = msg.chat.id;

  let sent = false;
  try {
    // 1. Handle Photo Messages (with or without price caption)
    if (hasPhoto) {
      const photos = msg.photo as Array<{ file_id: string }>;
      // Pick high-res but reasonable size photo from Telegram's array
      const chosenPhoto = photos[Math.max(0, photos.length - 2)] ?? photos[photos.length - 1];
      const image = await downloadTelegramPhoto(chosenPhoto.file_id);
      if (!image) {
        sent = await sendMessage(chat, "⚠️ Couldn't download that photo from Telegram. Please try again.");
        return NextResponse.json({ ok: true, reason: "photo_download_failed" });
      }

      const parsedWithName = rawText ? parseExpense(rawText) : null;
      const amountOnly = !parsedWithName && rawText ? parseAmountOnly(rawText) : null;
      const expenseAmount = parsedWithName?.amount ?? amountOnly;

      // Photo WITH price caption -> Log expense + nutrition
      if (expenseAmount !== null) {
        const ai = await analyzeExpenseOrFood({
          description: parsedWithName?.name,
          image,
          forceFoodAnalysis: true,
        });
        const finalName = parsedWithName?.name || ai.dishName || "Meal";
        const saved = await addExpense(finalName, expenseAmount, ai.category, ai.nutrition);
        const nutriLine = formatNutritionBlock(saved);
        const summary = await formatTodaySummary();
        sent = await sendMessage(
          chat,
          `✅ ${saved.name} – ${rp(saved.amount)} (${saved.category})${nutriLine ? `\n${nutriLine}` : ""}\n\n${summary}`,
        );
        return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
      }

      // Photo WITHOUT price caption -> Standalone AI nutrition lookup
      const cleanCaption = parseNutritionQuery(rawText) ?? rawText;
      const ai = await analyzeExpenseOrFood({
        description: cleanCaption || undefined,
        image,
        forceFoodAnalysis: true,
      });
      if (!ai.aiUsed) {
        sent = await sendMessage(
          chat,
          `⚠️ ${ai.errorReason || "Could not analyze photo with Gemini AI."}`,
        );
      } else {
        const nutriLine = formatNutritionBlock(ai.nutrition) ?? "No nutritional estimate available for this image.";
        sent = await sendMessage(
          chat,
          `🍽️ *${ai.dishName}* (${ai.category})\n${nutriLine}\n\n💡 _To log this as an expense too, send the photo with a price caption like "${ai.dishName} 25k" or just "25k"._`,
        );
      }
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 2. Handle Standalone Text Nutrition Queries (/nutri <food> or ? <food>)
    const nutriQuery = parseNutritionQuery(rawText);
    if (nutriQuery !== null) {
      if (!nutriQuery) {
        sent = await sendMessage(
          chat,
          "🥗 Usage:\n• `/nutri nasi padang rendang`\n• `? kopi susu gula aren`\n• Or send a photo of your meal!",
        );
        return NextResponse.json({ ok: true, reason: "sent" });
      }
      const ai = await analyzeExpenseOrFood({
        description: nutriQuery,
        forceFoodAnalysis: true,
      });
      if (!ai.aiUsed) {
        sent = await sendMessage(
          chat,
          `⚠️ ${ai.errorReason || "Could not estimate nutrition with Gemini AI."}`,
        );
      } else {
        const nutriLine = formatNutritionBlock(ai.nutrition) ?? "Could not estimate nutrition for that item.";
        sent = await sendMessage(
          chat,
          `🥗 ${ai.dishName} (${ai.category})\n${nutriLine}\n\n💡 Send "${nutriQuery} 25k" if you want to record it as an expense.`,
        );
      }
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 3. Handle Commands (/undo, /today, /start, /help)
    if (rawText.startsWith("/undo")) {
      const e = await undoLast();
      if (e) {
        const summary = await formatTodaySummary();
        sent = await sendMessage(
          chat,
          `↩️ Removed ${e.name} – ${rp(e.amount)}\n\n${summary}`,
        );
      } else {
        sent = await sendMessage(chat, "Nothing to undo.");
      }
    } else if (rawText.startsWith("/today")) {
      const summary = await formatTodaySummary();
      sent = await sendMessage(chat, summary);
    } else if (rawText.startsWith("/")) {
      sent = await sendMessage(
        chat,
        "Commands & usage:\n• Log expense + nutrition: nasi goreng 25k\n• Photo + price caption: logs meal photo + nutrition\n• Photo without price: standalone nutrition check\n• /nutri <meal> or ? <meal> – check nutrition only\n• /today – today's expenses & nutrition\n• /undo – remove last entry",
      );
    } else {
      // 4. Handle Regular Text Expense
      const p = parseExpense(rawText);
      if (!p) {
        sent = await sendMessage(
          chat,
          "Couldn't read that.\n• To log an expense: <meal name> <cost> (e.g. nasi goreng 25k)\n• To check nutrition only: /nutri <meal name> or ? <meal name>",
        );
      } else {
        const ai = await analyzeExpenseOrFood({ description: p.name });
        const saved = await addExpense(p.name, p.amount, ai.category, ai.nutrition);
        const nutriLine = formatNutritionBlock(saved);
        const summary = await formatTodaySummary();
        sent = await sendMessage(
          chat,
          `✅ ${saved.name} – ${rp(saved.amount)} (${saved.category})${nutriLine ? `\n${nutriLine}` : ""}\n\n${summary}`,
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
