import { CATEGORIES, categorize, type Category } from "./categorize";
import type { Expense, NutritionFacts, PeriodNutrition, UserSettings } from "./db";
import { rp } from "./format";

export type NutritionAIResult = {
  dishName: string;
  category: Category;
  isFoodOrDrink: boolean;
  nutrition: NutritionFacts;
  aiUsed: boolean;
  errorReason?: string;
};

export type ReceiptOrMealPhotoResult = {
  isReceipt: boolean;
  receiptItems: Array<{
    dishName: string;
    amount: number;
    category: Category;
    nutrition: NutritionFacts;
  }>;
  mealResult: NutritionAIResult;
  aiUsed: boolean;
  errorReason?: string;
};

const GEMINI_MODEL = "gemini-3.8-flash";

function cleanNumber(v: unknown, roundInt = false): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundInt ? Math.round(n) : Math.round(n * 10) / 10;
}

function validCategory(c: unknown, fallbackName: string): Category {
  const s = String(c ?? "").trim();
  if ((CATEGORIES as readonly string[]).includes(s)) return s as Category;
  return categorize(fallbackName);
}

export async function analyzeExpenseOrFood(input: {
  description?: string;
  extraNotes?: string;
  image?: { base64: string; mimeType: string } | null;
  forceFoodAnalysis?: boolean;
}): Promise<NutritionAIResult> {
  const rawName = (input.description ?? "").trim();
  const extraNotes = (input.extraNotes ?? "").trim();
  const combinedText = [rawName, extraNotes].filter(Boolean).join(" — ");

  const fallbackCat = categorize(combinedText || "meal");
  const fallbackResult: NutritionAIResult = {
    dishName: rawName || "Meal",
    category: fallbackCat,
    isFoodOrDrink: fallbackCat === "Food" || fallbackCat === "Drink",
    nutrition: {
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      nutrition_note: null,
    },
    aiUsed: false,
  };

  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      ...fallbackResult,
      errorReason:
        "GEMINI_API_KEY is not set in this deployment. If you just added it in Vercel, trigger a Redeploy (and open your main .vercel.app domain, not an older preview URL).",
    };
  }

  const inputContextLines = [
    rawName ? `User text input / item name: "${rawName}"` : null,
    extraNotes ? `Additional user instructions / portion adjustments: "${extraNotes}"` : null,
    input.image
      ? "Attached photo: Inspect the image carefully for the exact food/drink items, visible portion sizes (e.g. rice volume, protein cut, fried/grilled, sauces/oil, side dishes), and combine what you see in the photo with the user's text input above."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a certified nutritionist and personal finance assistant specialized in Indonesian and international meals.
Analyze the following input:
${inputContextLines || 'User text input: "(see attached photo)"'}

IMPORTANT RULES WHEN BOTH TEXT AND PHOTO ARE PROVIDED:
1. Combine BOTH sources of information: use the photo to identify exact visible dishes, portion sizes, side dishes, and cooking method, AND honor the user's text input for specific adjustments or context (such as "nasi setengah porsi", "tanpa nasi", "dada ayam", "less sugar", or custom descriptions).
2. If the user provided a generic label (e.g. "makan siang", "sarapan", "dinner") along with a photo, keep their label and append the detected dish in parentheses for "dishName", e.g. "makan siang (Ayam Geprek + Nasi)". If they already named the dish, keep their dishName.
3. In "nutrition_note", explicitly mention the portion & components analyzed from the input + photo (in Indonesian, max 110 chars).

Return ONLY a valid JSON object with these exact fields:
{
  "dishName": "concise meal or item name",
  "category": "one of: Food, Drink, Transport, Groceries, Bills, Other",
  "isFoodOrDrink": true or false (true if the item is edible food, meal, snack, beverage, or edible groceries; false for transport, fuel, bills, non-food items),
  "calories": integer total estimated kilocalories (kcal) for the described & pictured serving, or null if isFoodOrDrink is false,
  "protein_g": number grams of protein (1 decimal place), or null if isFoodOrDrink is false,
  "carbs_g": number grams of carbohydrates (1 decimal place), or null if isFoodOrDrink is false,
  "fat_g": number grams of fat (1 decimal place), or null if isFoodOrDrink is false,
  "nutrition_note": "short 1-line summary (max 110 chars) of portion estimate & key nutritional highlight based on the text and/or photo, or null if isFoodOrDrink is false"
}
${input.forceFoodAnalysis ? "Note: The user is explicitly asking for a nutritional calculation/recalculation, so set isFoodOrDrink to true if it is any kind of food or drink." : ""}`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (input.image) {
    parts.push({
      inlineData: {
        mimeType: input.image.mimeType,
        data: input.image.base64,
      },
    });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gemini API error:", res.status, errText);
      return {
        ...fallbackResult,
        errorReason: `Gemini API returned HTTP ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!textOut) return fallbackResult;

    const parsed = JSON.parse(textOut) as Record<string, unknown>;
    const aiDishName = String(parsed.dishName ?? "").trim();
    const dishName = aiDishName || rawName || "Meal";
    const category = validCategory(parsed.category, combinedText || dishName);
    const isFoodOrDrink = Boolean(parsed.isFoodOrDrink) || category === "Food" || category === "Drink";

    const calories = isFoodOrDrink ? cleanNumber(parsed.calories, true) : null;
    const protein_g = isFoodOrDrink ? cleanNumber(parsed.protein_g, false) : null;
    const carbs_g = isFoodOrDrink ? cleanNumber(parsed.carbs_g, false) : null;
    const fat_g = isFoodOrDrink ? cleanNumber(parsed.fat_g, false) : null;
    const nutrition_note =
      isFoodOrDrink && parsed.nutrition_note ? String(parsed.nutrition_note).trim().slice(0, 140) : null;

    return {
      dishName: input.image ? dishName : rawName || dishName,
      category,
      isFoodOrDrink,
      nutrition: {
        calories,
        protein_g,
        carbs_g,
        fat_g,
        nutrition_note,
      },
      aiUsed: true,
    };
  } catch (err) {
    console.error("Failed to analyze nutrition with Gemini:", err);
    return fallbackResult;
  }
}

/**
 * Inspects an uploaded photo when no price caption was given:
 * - If the photo is a receipt, bill, struk belanja, or GrabFood/GoFood order screenshot with prices,
 *   extracts all line items + IDR amounts + nutritional estimates for food/drink items.
 * - If the photo is a picture of food/drink, returns the standalone meal nutrition analysis.
 */
export async function analyzePhotoForReceiptOrMeal(input: {
  caption?: string;
  image: { base64: string; mimeType: string };
}): Promise<ReceiptOrMealPhotoResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  const emptyMeal = await analyzeExpenseOrFood({
    description: input.caption,
    image: null,
  });

  if (!apiKey) {
    return {
      isReceipt: false,
      receiptItems: [],
      mealResult: emptyMeal,
      aiUsed: false,
      errorReason: emptyMeal.errorReason,
    };
  }

  const captionNote = (input.caption ?? "").trim();
  const prompt = `You are a certified nutritionist and Indonesian receipt OCR assistant.
Inspect the attached image${captionNote ? ` and user caption: "${captionNote}"` : ""}.

Determine whether this image is:
A) A RECEIPT / BILL / STRUK / INVOICE / DELIVERY ORDER SCREENSHOT (e.g. Indomaret, Alfamart, restaurant receipt, GrabFood, GoFood, ShopeeFood) that shows purchased items and IDR prices.
B) A PHOTO OF FOOD / DRINK / MEAL without receipt price lines.

Return ONLY a valid JSON object matching this exact schema:
{
  "isReceipt": true if the image is a receipt/bill/order summary with visible prices, false if it is a meal/food photo,
  "receiptItems": [
    // Populate ONLY if isReceipt is true (up to 10 purchased items from the receipt; convert prices to integer IDR, e.g. 22000):
    {
      "dishName": "item name from receipt",
      "amount": 22000,
      "category": "one of: Food, Drink, Transport, Groceries, Bills, Other",
      "isFoodOrDrink": true or false,
      "calories": integer kcal or null,
      "protein_g": number or null,
      "carbs_g": number or null,
      "fat_g": number or null,
      "nutrition_note": "short 1-line Indonesian nutrition note (max 100 chars) or null"
    }
  ],
  "meal": {
    // Populate if isReceipt is false:
    "dishName": "detected meal name (combine photo + caption)",
    "category": "one of: Food, Drink, Transport, Groceries, Bills, Other",
    "isFoodOrDrink": true,
    "calories": integer kcal,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "nutrition_note": "short 1-line Indonesian serving & nutrition summary (max 110 chars)"
  }
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        isReceipt: false,
        receiptItems: [],
        mealResult: emptyMeal,
        aiUsed: false,
        errorReason: `Gemini API returned HTTP ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!textOut) {
      return { isReceipt: false, receiptItems: [], mealResult: emptyMeal, aiUsed: false };
    }

    const parsed = JSON.parse(textOut) as Record<string, unknown>;
    const isReceipt = Boolean(parsed.isReceipt);
    const rawItems = Array.isArray(parsed.receiptItems) ? parsed.receiptItems : [];

    const receiptItems = rawItems
      .map((item) => {
        const r = item as Record<string, unknown>;
        const dishName = String(r.dishName ?? "").trim();
        const amount = Math.round(Number(r.amount ?? 0));
        if (!dishName || !Number.isFinite(amount) || amount <= 0) return null;
        const category = validCategory(r.category, dishName);
        const isFood = Boolean(r.isFoodOrDrink) || category === "Food" || category === "Drink";
        return {
          dishName,
          amount,
          category,
          nutrition: {
            calories: isFood ? cleanNumber(r.calories, true) : null,
            protein_g: isFood ? cleanNumber(r.protein_g, false) : null,
            carbs_g: isFood ? cleanNumber(r.carbs_g, false) : null,
            fat_g: isFood ? cleanNumber(r.fat_g, false) : null,
            nutrition_note:
              isFood && r.nutrition_note ? String(r.nutrition_note).trim().slice(0, 140) : null,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (isReceipt && receiptItems.length > 0) {
      return {
        isReceipt: true,
        receiptItems,
        mealResult: emptyMeal,
        aiUsed: true,
      };
    }

    const mealObj = (parsed.meal ?? parsed) as Record<string, unknown>;
    const dishName = String(mealObj.dishName ?? "").trim() || captionNote || "Meal";
    const category = validCategory(mealObj.category, dishName);
    return {
      isReceipt: false,
      receiptItems: [],
      mealResult: {
        dishName,
        category,
        isFoodOrDrink: true,
        nutrition: {
          calories: cleanNumber(mealObj.calories, true),
          protein_g: cleanNumber(mealObj.protein_g, false),
          carbs_g: cleanNumber(mealObj.carbs_g, false),
          fat_g: cleanNumber(mealObj.fat_g, false),
          nutrition_note: mealObj.nutrition_note
            ? String(mealObj.nutrition_note).trim().slice(0, 140)
            : null,
        },
        aiUsed: true,
      },
      aiUsed: true,
    };
  } catch (err) {
    console.error("Failed to analyze receipt or meal photo:", err);
    return { isReceipt: false, receiptItems: [], mealResult: emptyMeal, aiUsed: false };
  }
}

export async function askFinancialNutritionCoach(input: {
  question: string;
  settings: UserSettings;
  totals: { today: number; week: number; month: number };
  nutrition: { day: PeriodNutrition; week: PeriodNutrition; month: PeriodNutrition };
  recentExpenses: Expense[];
}): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return "⚠️ GEMINI_API_KEY is not configured yet.";
  }

  const remDailyRp = input.settings.daily_budget - input.totals.today;
  const remMonthRp = input.settings.monthly_budget - input.totals.month;
  const remCal = input.settings.daily_calories - input.nutrition.day.calories;
  const remPro = Math.round((input.settings.daily_protein_g - input.nutrition.day.protein) * 10) / 10;

  const recentSample = input.recentExpenses
    .slice(0, 20)
    .map(
      (e) =>
        `- ${e.name}: ${rp(e.amount)} (${e.category}${e.calories != null ? `, ${e.calories} kcal, P ${e.protein_g ?? 0}g` : ""})`,
    )
    .join("\n");

  const prompt = `You are a concise, practical Indonesian Personal Finance & Nutrition Coach inside a Telegram bot.
Answer the user's question directly using their real data below. Keep the answer under 140 words, friendly, and actionable.

USER TARGETS:
- Daily Budget: ${rp(input.settings.daily_budget)} | Monthly Budget: ${rp(input.settings.monthly_budget)}
- Daily Nutrition Target: ${input.settings.daily_calories} kcal | Protein ${input.settings.daily_protein_g}g | Carbs ${input.settings.daily_carbs_g}g | Fat ${input.settings.daily_fat_g}g

CURRENT STATUS (Asia/Jakarta):
- Today Spending: ${rp(input.totals.today)} (Remaining today: ${rp(remDailyRp)})
- This Week Spending: ${rp(input.totals.week)}
- This Month Spending: ${rp(input.totals.month)} (Remaining month: ${rp(remMonthRp)})
- Today Nutrition: ${input.nutrition.day.calories} kcal, P ${input.nutrition.day.protein}g, C ${input.nutrition.day.carbs}g, F ${input.nutrition.day.fat}g
- Remaining Today Nutrition: ${remCal} kcal, Protein needed: ${remPro}g

RECENT EXPENSES:
${recentSample || "(No expenses yet)"}

USER QUESTION: "${input.question}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!res.ok) return "⚠️ Could not reach the AI Coach right now. Please try again.";
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "⚠️ No answer returned from the AI Coach."
    );
  } catch {
    return "⚠️ Failed to contact the AI Coach.";
  }
}

export function formatNutritionBlock(n: Partial<NutritionFacts>): string | null {
  if (n.calories === null || n.calories === undefined) return null;
  const macros = [
    `🔥 ${Math.round(n.calories)} kcal`,
    n.protein_g != null ? `🥩 P: ${n.protein_g}g` : null,
    n.carbs_g != null ? `🍚 C: ${n.carbs_g}g` : null,
    n.fat_g != null ? `🥑 F: ${n.fat_g}g` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return n.nutrition_note ? `${macros}\n💡 ${n.nutrition_note}` : macros;
}
