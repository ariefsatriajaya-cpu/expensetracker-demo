import { NextRequest, NextResponse } from "next/server";
import {
  addExpense,
  getExpenseById,
  getSettings,
  listRecent,
  listToday,
  nutritionTotals,
  totals,
  undoLast,
  updateExpense,
  updateSettings,
  type Expense,
} from "@/lib/db";
import {
  parseAmountOnly,
  parseAskCommand,
  parseExpense,
  parseMultipleExpenses,
  parseNutritionQuery,
  parseRecalcCommand,
  parseSetGoalCommand,
} from "@/lib/parse";
import { rp } from "@/lib/format";
import {
  analyzeExpenseOrFood,
  analyzePhotoForReceiptOrMeal,
  askFinancialNutritionCoach,
  formatNutritionBlock,
} from "@/lib/nutrition";
import { downloadTelegramPhoto, extractTelegramImageFileId, sendMessage } from "@/lib/telegram";
import { safeEqual } from "@/lib/session";

async function formatTodaySummary() {
  const [items, settings] = await Promise.all([listToday(), getSettings()]);
  if (!items.length) {
    return `📅 Today's expenses: none\n💰 Today's total: Rp0 / ${rp(settings.daily_budget)} (${rp(settings.daily_budget)} left)\n🎯 Calorie target: 0 / ${settings.daily_calories} kcal`;
  }

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

  const remRp = settings.daily_budget - totalRp;
  const rpBudgetTag =
    remRp >= 0
      ? `${rp(remRp)} left of ${rp(settings.daily_budget)}`
      : `⚠️ ${rp(Math.abs(remRp))} over ${rp(settings.daily_budget)}`;

  const remCal = settings.daily_calories - Math.round(totalCal);
  const calBudgetTag =
    remCal >= 0 ? `${remCal} kcal left` : `${Math.abs(remCal)} kcal over target`;
  const remPro = Math.max(0, Math.round((settings.daily_protein_g - totalPro) * 10) / 10);

  const nutriFooter =
    totalCal > 0
      ? `\n🥗 Today's nutrition: ${Math.round(totalCal)} / ${settings.daily_calories} kcal (${calBudgetTag})\n🥩 Macros: P ${totalPro}g/${settings.daily_protein_g}g (${remPro}g to go) · C ${totalCarb}g · F ${totalFat}g`
      : "";

  return `📅 Today's expenses (${items.length}):\n${lines}\n\n💰 Today's total: ${rp(totalRp)} (${rpBudgetTag})${nutriFooter}`;
}

async function resolveExpenseToRecalc(
  targetIndexOrId: number | null,
  extraContext: string,
): Promise<{
  target: Expense | null;
  notesForAi: string;
}> {
  const [todayItems, recentItems] = await Promise.all([listToday(), listRecent(25)]);

  if (targetIndexOrId !== null) {
    if (targetIndexOrId >= 1 && targetIndexOrId <= todayItems.length) {
      return { target: todayItems[targetIndexOrId - 1], notesForAi: extraContext };
    }
    const byId = recentItems.find((e) => e.id === targetIndexOrId) ?? (await getExpenseById(targetIndexOrId));
    if (byId) {
      return { target: byId, notesForAi: extraContext };
    }
    if (targetIndexOrId >= 1 && targetIndexOrId <= recentItems.length) {
      return { target: recentItems[targetIndexOrId - 1], notesForAi: extraContext };
    }
    return { target: null, notesForAi: extraContext };
  }

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
    const image = imageFileId ? await downloadTelegramPhoto(imageFileId) : null;
    if (imageFileId && !image) {
      sent = await sendMessage(chat, "⚠️ Couldn't download that photo from Telegram. Please try again.");
      return NextResponse.json({ ok: true, reason: "photo_download_failed" });
    }

    // 1. Handle /setgoal (/goal, /target)
    const goalCmd = rawText ? parseSetGoalCommand(rawText) : null;
    if (goalCmd !== null) {
      const s = goalCmd.hasUpdates ? await updateSettings(goalCmd.patch) : await getSettings();
      const header = goalCmd.hasUpdates ? "✅ Updated your targets:" : "🎯 Current Budget & Nutrition Targets:";
      sent = await sendMessage(
        chat,
        `${header}\n• Daily Budget: ${rp(s.daily_budget)}\n• Monthly Budget: ${rp(s.monthly_budget)}\n• Daily Calories: ${s.daily_calories} kcal\n• Protein: ${s.daily_protein_g}g · Carbs: ${s.daily_carbs_g}g · Fat: ${s.daily_fat_g}g\n\n💡 Update anytime with:\n/setgoal daily 120k month 3.5jt kcal 2100 p 130 c 230 f 65`,
      );
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 2. Handle /recalc command (works with text only OR with a photo + caption/reply!)
    const recalcCmd = rawText ? parseRecalcCommand(rawText) : null;
    if (recalcCmd !== null) {
      const { target, notesForAi } = await resolveExpenseToRecalc(
        recalcCmd.targetIndexOrId,
        recalcCmd.extraContext,
      );
      if (!target) {
        sent = await sendMessage(
          chat,
          "⚠️ Couldn't find that expense to recalculate.\n\nUsage:\n• /recalc – recalculate your last expense\n• /recalc 1 – recalculate item #1 from /today\n• /recalc 1 nasi setengah porsi, dada ayam – recalculate #1 with extra details\n• Send or reply to a meal photo with /recalc 1 to recalculate using the photo!",
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

    // 3. Handle messages that include a Photo (expense with price, receipt OCR, OR standalone meal photo)
    if (image) {
      const parsedWithName = rawText ? parseExpense(rawText) : null;
      const amountOnly = !parsedWithName && rawText ? parseAmountOnly(rawText) : null;
      const expenseAmount = parsedWithName?.amount ?? amountOnly;

      // 3a. Photo WITH explicit price caption -> Log expense + nutrition from input AND photo
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

      // 3b. Photo WITHOUT price caption -> Auto-detect Receipt/Bill OCR vs. Standalone Meal Photo
      const cleanCaption = parseNutritionQuery(rawText) ?? rawText;
      const photoAnalysis = await analyzePhotoForReceiptOrMeal({
        caption: cleanCaption || undefined,
        image,
      });

      if (!photoAnalysis.aiUsed) {
        sent = await sendMessage(
          chat,
          `⚠️ ${photoAnalysis.errorReason || "Could not analyze photo with Gemini AI."}`,
        );
        return NextResponse.json({ ok: true, reason: "ai_failed" });
      }

      // If Gemini detected a Receipt / Bill / Order screenshot with prices, log every item!
      if (photoAnalysis.isReceipt && photoAnalysis.receiptItems.length > 0) {
        const savedItems: Expense[] = [];
        for (const item of photoAnalysis.receiptItems) {
          const saved = await addExpense(item.dishName, item.amount, item.category, item.nutrition);
          savedItems.push(saved);
        }
        const receiptLines = savedItems
          .map((s) => {
            const cal = s.calories != null ? ` · 🔥 ${Math.round(s.calories)} kcal` : "";
            return `• ${s.name} – ${rp(s.amount)} (${s.category})${cal}`;
          })
          .join("\n");
        const summary = await formatTodaySummary();
        sent = await sendMessage(
          chat,
          `🧾 Logged ${savedItems.length} ${savedItems.length === 1 ? "item" : "items"} from receipt:\n${receiptLines}\n\n${summary}`,
        );
        return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
      }

      // Otherwise it's a standalone Meal Photo -> return nutrition breakdown
      const ai = photoAnalysis.mealResult;
      const nutriLine = formatNutritionBlock(ai.nutrition) ?? "No nutritional estimate available for this image.";
      sent = await sendMessage(
        chat,
        `🍽️ ${ai.dishName} (${ai.category}) 📷\n${nutriLine}\n\n💡 To log this as an expense too, send the photo with a price caption (e.g. "${cleanCaption || ai.dishName} 25k"), or reply to this photo with "/recalc 1" to update an existing expense.`,
      );
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 4. Handle Standalone Text Nutrition Queries (/nutri <food> or ? <food>)
    const nutriQuery = parseNutritionQuery(rawText);
    if (nutriQuery !== null) {
      if (!nutriQuery) {
        sent = await sendMessage(
          chat,
          "🥗 Usage:\n• /nutri nasi padang rendang\n• ? kopi susu gula aren\n• Or send a photo of your meal or receipt!",
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

    // 5. Handle Explicit /ask (/coach) command
    const askQuery = parseAskCommand(rawText);
    if (askQuery !== null) {
      if (!askQuery) {
        sent = await sendMessage(
          chat,
          "🤖 AI Financial & Nutrition Coach:\nAsk anything about your budget, spending, or meal recommendations!\nExamples:\n• /ask saran makan malam budget 25k tinggi protein\n• /ask kategori apa paling boros bulan ini?",
        );
        return NextResponse.json({ ok: true, reason: "sent" });
      }
      const [settings, t, nutri, recent] = await Promise.all([
        getSettings(),
        totals(),
        nutritionTotals(),
        listRecent(25),
      ]);
      const answer = await askFinancialNutritionCoach({
        question: askQuery,
        settings,
        totals: t,
        nutrition: nutri,
        recentExpenses: recent,
      });
      sent = await sendMessage(chat, `🤖 ${answer}`);
      return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
    }

    // 6. Handle Standard Commands (/undo, /today, /start, /help)
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
        "Commands & usage:\n• Single or multi-item expense: geprek 22k, es teh 5k\n• Photo of receipt/struk: auto-extracts & logs items\n• Photo of meal + price: logs meal & nutrition from caption + photo\n• /recalc [number] [details] – recalculate an earlier expense\n• /nutri <meal> or ? <meal> – check nutrition only\n• /ask <question> – ask your AI Finance & Nutrition Coach\n• /setgoal – view or update budget & macro targets\n• /today – today's expenses, budget & nutrition\n• /undo – remove last entry",
      );
    } else {
      // 7. Handle Single or Multi-Item Expense (or fallback to AI Coach for natural language questions without a price!)
      const parsedList = parseMultipleExpenses(rawText);
      if (parsedList && parsedList.length > 0) {
        const analyzed = await Promise.all(
          parsedList.map(async (p) => {
            const ai = await analyzeExpenseOrFood({ description: p.name });
            const saved = await addExpense(p.name, p.amount, ai.category, ai.nutrition);
            return saved;
          }),
        );

        const confirmLines = analyzed
          .map((saved) => {
            const nutriLine = formatNutritionBlock(saved);
            return `✅ ${saved.name} – ${rp(saved.amount)} (${saved.category})${nutriLine ? `\n${nutriLine}` : ""}`;
          })
          .join("\n\n");

        const summary = await formatTodaySummary();
        sent = await sendMessage(chat, `${confirmLines}\n\n${summary}`);
      } else {
        // Natural language message without a price -> Answer with AI Financial & Nutrition Coach!
        const [settings, t, nutri, recent] = await Promise.all([
          getSettings(),
          totals(),
          nutritionTotals(),
          listRecent(25),
        ]);
        const answer = await askFinancialNutritionCoach({
          question: rawText,
          settings,
          totals: t,
          nutrition: nutri,
          recentExpenses: recent,
        });
        sent = await sendMessage(chat, `🤖 ${answer}`);
      }
    }
  } catch (err) {
    console.error(err);
    sent = await sendMessage(chat, "⚠️ Something went wrong, try again.");
    return NextResponse.json({ ok: true, reason: "db_error", sent });
  }
  return NextResponse.json({ ok: true, reason: sent ? "sent" : "telegram_api_failed" });
}
