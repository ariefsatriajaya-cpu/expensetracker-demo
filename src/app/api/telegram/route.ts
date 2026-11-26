import { NextRequest, NextResponse } from "next/server";
import { addExpense, getExpenseById, listRecent, listToday, undoLast, updateExpense, type Expense } from "@/lib/db";
import { parseAmountOnly, parseExpense, parseNutritionQuery, parseRecalcCommand } from "@/lib/parse";
import { rp } from "@/lib/format";
import { analyzeExpenseOrFood, formatNutritionBlock } from "@/lib/nutrition";
import { downloadTelegramPhoto, extractTelegramImageFileId, sendMessage } from "@/lib/telegram";
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

async function resolveExpenseToRecalc(targetIndexOrId: number | null, extraContext: string): Promise<{
  target: Expense | null;
  notesForAi: string;
}> {
  const [todayItems, recentItems] = await Promise.all([listToday(), listRecent(25)]);

  if (targetIndexOrId !== null) {
    // 1. Match 1-based number from today's numbered list (1..N)
    if (targetIndexOrId >= 1 && targetIndexOrId <= todayItems.length) {
      return { target: todayItems[targetIndexOrId - 1], notesForAi: extraContext };
    }
    // 2. Match exact database ID
    const byId = recentItems.find((e) => e.id === targetIndexOrId) ?? (await getExpenseById(targetIndexOrId));
    if (byId) {
      return { target: byId, notesForAi: extraContext };
    }
    // 3. Fallback to 1-based index in recent items list
    if (targetIndexOrId >= 1 && targetIndexOrId <= recentItems.length) {
      return { target: recentItems[targetIndexOrId - 1], notesForAi: extraContext };
    }
    return { target: null, notesForAi: extraContext };
  }

  // No number specified: check if extraContext names a specific recent expense
  const pool = [...[...todayItems].reverse(), ...recentItems];
  if (extraContext) {
    const lower = extraContext.toLowerCase();
    const matched = pool.find(
      (e) => lower.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lower),
    );
    if (matched) {
      return { target: matched, notesForAi: extraContext };
    }
  }

  // Default to the most recently logged expense
  const latest = todayItems[todayItems.length - 1] ?? recentItems[0] ?? null;
  return { target: latest, notesForAi: extraContext };
}

export async function POST(req: NextRequest) {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  const got = (req.headers.get("x-telegram-bot-api-secret-token") ?? "").trim();
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json().catch(() => null);
  const msg = update?.message as Record<string, unknown> | undefined;
  const imageFileId = extractTelegramImageFileId(msg);
  const rawText: string = String(msg?.text ?? msg?.caption ?? "").trim();

  if (!rawText && !imageFileId) {
    return NextResponse.json({ ok: true, reason: "no_text" });
  }
  const from = msg?.from as { id?: number | string } | undefined;
  const allowedId = (process.env.ALLOWED_TELEGRAM_ID ?? "").trim();
  if (String(from?.id) !== allowedId) {
    return NextResponse.json({ ok: true, reason: "id_mismatch" });
  }
  const chatObj = msg?.chat as { id: number };
  const chat: number = chatObj.id;

  let sent = false;
  try {
    // Download photo if the message (or replied-to message) includes an image
    const image = imageFileId ? await downloadTelegramPhoto(imageFileId) : null;
    if (imageFileId && !image) {
      sent = await sendMessage(chat, "⚠️ Couldn't download that photo from Telegram. Please try again.");
      return NextResponse.json({ ok: true, reason: "photo_download_failed" });
    }

    // 1. Handle /recalc command (works with text only OR with a photo + caption/reply!)
    const recalcCmd = rawText ? parseRecalcCommand(rawText) : null;
    if (recalcCmd !== null) {
      const { target, notesForAi } = await resolveExpenseToRecalc(
        recalcCmd.targetIndexOrId,
        recalcCmd.extraContext,
      );
      if (!target) {
        sent = await sendMessage(
          chat,
          "⚠️ Couldn't find that expense to recalculate.\n\nUsage:\n• `/recalc` – recalculate your last expense\n• `/recalc 1` – recalculate item #1 from `/today`\n• `/recalc 1 nasi setengah porsi, dada ayam` – recalculate #1 with extra details\n• Send or reply to a meal photo with `/recalc 1` to recalculate using the photo!",
        );
        return NextResponse.json({ ok: true, reason: "sent" });
      }

      const ai = await analyzeExpenseOrFood({
        description: target.name,
        extraNotes: notesForAi || undefined,
        image,
        forceFoodAnalysis: true,
      });

      if (!ai.aiUsed) {
        sent = await sendMessage(
          chat,
          `⚠️ ${ai.errorReason || "Could not recalculate nutrition with Gemini AI."}`,
        );
        return NextResponse.json({ ok: true, reason: "ai_failed" });
      }

      const updated = await updateExpense(
        target.id,
        target.name,
        target.amount,
        ai.category || target.category,
        ai.nutrition,
      );
      const nutriLine = formatNutritionBlock(updated ?? ai.nutrition);
      const summary = await formatTodaySummary();
      const sourceTag = image ? " (from input + photo 📷)" : notesForAi ? ` (with "${notesForAi}")` : "";
      sent = await sendMessage(
        chat,
        `🔄 Recalculated${sourceTag}:\n✅ ${target.name} – ${rp(target.amount)} (${updated?.category ?? target.category})${nutriLine ? `\n${nutriLine}` : ""}\n\n${summary}`,
      );
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 2. Handle messages that include a Photo (expense with price OR standalone nutrition with text+photo)
    if (image) {
      const parsedWithName = rawText ? parseExpense(rawText) : null;
      const amountOnly = !parsedWithName && rawText ? parseAmountOnly(rawText) : null;
      const expenseAmount = parsedWithName?.amount ?? amountOnly;

      // Photo WITH price caption (e.g. "ayam geprek dada, nasi setengah 22k" or "22k") -> Log expense + nutrition from input AND photo
      if (expenseAmount !== null) {
        const ai = await analyzeExpenseOrFood({
          description: parsedWithName?.name,
          image,
          forceFoodAnalysis: true,
        });
        const finalName = ai.dishName || parsedWithName?.name || "Meal";
        const saved = await addExpense(finalName, expenseAmount, ai.category, ai.nutrition);
        const nutriLine = formatNutritionBlock(saved);
        const summary = await formatTodaySummary();
        sent = await sendMessage(
          chat,
          `✅ ${saved.name} – ${rp(saved.amount)} (${saved.category}) 📷${nutriLine ? `\n${nutriLine}` : ""}\n\n${summary}`,
        );
        return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
      }

      // Photo WITHOUT price caption -> Analyze nutrition based on both user caption input AND photo
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
          `🍽️ ${ai.dishName} (${ai.category}) 📷\n${nutriLine}\n\n💡 To log this as an expense too, send the photo with a price caption (e.g. "${cleanCaption || ai.dishName} 25k"), or reply to this photo with "/recalc 1" to update an existing expense.`,
        );
      }
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 3. Handle Standalone Text Nutrition Queries (/nutri <food> or ? <food>)
    const nutriQuery = parseNutritionQuery(rawText);
    if (nutriQuery !== null) {
      if (!nutriQuery) {
        sent = await sendMessage(
          chat,
          "🥗 Usage:\n• /nutri nasi padang rendang\n• ? kopi susu gula aren\n• Or send a photo of your meal with optional description!",
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

    // 4. Handle Commands (/undo, /today, /start, /help)
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
        "Commands & usage:\n• Log expense + nutrition: nasi goreng 25k\n• Photo + text/price: analyzes both your caption & photo\n• /recalc [number] [extra details] – recalculate nutrition for a previous expense (works with photos too!)\n• /nutri <meal> or ? <meal> – check nutrition only\n• /today – today's expenses & nutrition\n• /undo – remove last entry",
      );
    } else {
      // 5. Handle Regular Text Expense
      const p = parseExpense(rawText);
      if (!p) {
        sent = await sendMessage(
          chat,
          "Couldn't read that.\n• To log an expense: <meal name> <cost> (e.g. nasi goreng 25k)\n• To recalculate an earlier expense: /recalc 1 <extra details>\n• To check nutrition only: /nutri <meal name> or ? <meal name>",
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
