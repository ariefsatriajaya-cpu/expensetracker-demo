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

type ModelCandidate = {
  model: string;
  thinkingBudgetZero?: boolean;
};

const DEFAULT_MODEL_CHAIN: ModelCandidate[] = [
  { model: "gemini-3.5-flash", thinkingBudgetZero: false },
  { model: "gemini-3.1-flash-lite", thinkingBudgetZero: true },
  { model: "gemini-3.8-flash", thinkingBudgetZero: true },
  { model: "gemini-3.5-flash-lite", thinkingBudgetZero: false },
  { model: "gemini-2.5-flash", thinkingBudgetZero: false },
];

function getModelChain(): ModelCandidate[] {
  const custom = (process.env.GEMINI_MODEL ?? "").trim();
  if (!custom) return DEFAULT_MODEL_CHAIN;
  const usesThinking = custom.includes("3.8") || custom.includes("3.7") || custom.includes("3.1-flash-lite");
  return [
    { model: custom, thinkingBudgetZero: usesThinking },
    ...DEFAULT_MODEL_CHAIN.filter((m) => m.model !== custom),
  ];
}

async function callGeminiWithFallback(options: {
  apiKey: string;
  parts: Array<Record<string, unknown>>;
  jsonMode: boolean;
  temperature?: number;
}): Promise<{ ok: true; text: string; modelUsed: string } | { ok: false; errorReason: string }> {
  const chain = getModelChain();
  let lastError = "Gemini API request failed.";

  for (const candidate of chain) {
    try {
      const generationConfig: Record<string, unknown> = {
        temperature: options.temperature ?? 0.2,
      };
      if (options.jsonMode) {
        generationConfig.responseMimeType = "application/json";
      }
      if (candidate.thinkingBudgetZero) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${encodeURIComponent(options.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: options.parts }],
            generationConfig,
          }),
          signal: AbortSignal.timeout(9500),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `Gemini (${candidate.model}) HTTP ${res.status}: ${errText.slice(0, 140)}`;
        console.warn("Gemini candidate failed, trying next fallback:", lastError);
        // Retry next model in chain on 503 (High Demand), 429 (Quota/Rate Limit), 404 (Model unavailable), or 400 (Thinking config mismatch)
        if (res.status === 503 || res.status === 429 || res.status === 404 || res.status === 400 || res.status >= 500) {
          continue;
        }
        break;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (!textOut) {
        lastError = `Empty response from ${candidate.model}`;
        continue;
      }

      return { ok: true, text: textOut, modelUsed: candidate.model };
    } catch (err) {
      lastError = `${candidate.model} error: ${err instanceof Error ? err.message : String(err)}`;
      console.warn("Gemini candidate exception, trying next fallback:", lastError);
      continue;
    }
  }

  return { ok: false, errorReason: lastError };
}

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

IMPORTANT RULES WHEN BOTH TEXT AND PHOTO (OR EXTRA INSTRUCTIONS) ARE PROVIDED:
1. Combine ALL sources of information: use the photo (if attached) to identify visible dishes and portions, AND honor the user's text input & extra instructions for specific gram weights, portion adjustments, or extra side dishes (such as "ayam 100gram, extra sauteed kangkung and kentang balado", "nasi setengah porsi", "tanpa nasi", etc.). Sum the total calories, protein, carbs, and fat of ALL components mentioned!
2. If the user provided a generic label (e.g. "makan siang", "sarapan", "dinner") along with a photo, keep their label and append the detected dish in parentheses for "dishName", e.g. "makan siang (Ayam Geprek + Nasi)". If they already named the dish, keep their dishName.
3. In "nutrition_note", explicitly list the components & portion weights included in the calculation (max 125 chars).

Return ONLY a valid JSON object with these exact fields:
{
  "dishName": "concise meal or item name",
  "category": "one of: Food, Drink, Transport, Groceries, Bills, Other",
  "isFoodOrDrink": true or false (true if the item is edible food, meal, snack, beverage, or edible groceries; false for transport, fuel, bills, non-food items),
  "calories": integer total estimated kilocalories (kcal) for the described & pictured serving, or null if isFoodOrDrink is false,
  "protein_g": number grams of protein (1 decimal place), or null if isFoodOrDrink is false,
  "carbs_g": number grams of carbohydrates (1 decimal place), or null if isFoodOrDrink is false,
  "fat_g": number grams of fat (1 decimal place), or null if isFoodOrDrink is false,
  "nutrition_note": "short 1-line summary (max 125 chars) of portion estimate & key nutritional highlight based on the text and/or photo, or null if isFoodOrDrink is false"
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

  const resp = await callGeminiWithFallback({
    apiKey,
    parts,
    jsonMode: true,
    temperature: 0.2,
  });

  if (!resp.ok) {
    return {
      ...fallbackResult,
      errorReason: resp.errorReason,
    };
  }

  try {
    const parsed = JSON.parse(resp.text) as Record<string, unknown>;
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
    console.error("Failed to parse Gemini JSON:", err);
    return fallbackResult;
  }
}

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

  const resp = await callGeminiWithFallback({
    apiKey,
    parts: [
      { text: prompt },
      { inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } },
    ],
    jsonMode: true,
    temperature: 0.2,
  });

  if (!resp.ok) {
    return {
      isReceipt: false,
      receiptItems: [],
      mealResult: emptyMeal,
      aiUsed: false,
      errorReason: resp.errorReason,
    };
  }

  try {
    const parsed = JSON.parse(resp.text) as Record<string, unknown>;
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

  const resp = await callGeminiWithFallback({
    apiKey,
    parts: [{ text: prompt }],
    jsonMode: false,
    temperature: 0.4,
  });

  if (!resp.ok) {
    return "⚠️ Could not reach the AI Coach right now. Please try again.";
  }
  return resp.text;
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
