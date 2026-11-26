import { CATEGORIES, categorize, type Category } from "./categorize";
import type { NutritionFacts } from "./db";

export type NutritionAIResult = {
  dishName: string;
  category: Category;
  isFoodOrDrink: boolean;
  nutrition: NutritionFacts;
  aiUsed: boolean;
};

const GEMINI_MODEL = "gemini-2.5-flash";

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
  image?: { base64: string; mimeType: string } | null;
  forceFoodAnalysis?: boolean;
}): Promise<NutritionAIResult> {
  const rawName = (input.description ?? "").trim();
  const fallbackCat = categorize(rawName || "meal");
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
  if (!apiKey) return fallbackResult;

  const prompt = `You are a certified nutritionist and personal finance assistant specialized in Indonesian and international meals.
Analyze the provided ${input.image ? "photo and/or text" : "text"}: "${rawName || "(see attached photo)"}"

Return ONLY a valid JSON object with these exact fields:
{
  "dishName": "concise meal or item name (if text was provided like 'makan di polsek, geprek', keep or clean it; if only a photo was given, name the specific dish accurately, e.g. 'Ayam Geprek + Nasi')",
  "category": "one of: Food, Drink, Transport, Groceries, Bills, Other",
  "isFoodOrDrink": true or false (true if the item is edible food, meal, snack, beverage, or edible groceries; false for transport, fuel, bills, non-food items),
  "calories": integer total estimated kilocalories (kcal) for 1 typical serving, or null if isFoodOrDrink is false,
  "protein_g": number grams of protein (1 decimal place), or null if isFoodOrDrink is false,
  "carbs_g": number grams of carbohydrates (1 decimal place), or null if isFoodOrDrink is false,
  "fat_g": number grams of fat (1 decimal place), or null if isFoodOrDrink is false,
  "nutrition_note": "short 1-line summary (max 90 chars) of portion estimate & key nutritional highlight (e.g. '1 porsi (~320g): tinggi protein dari ayam, lemak cukup tinggi dari sambal minyak'), or null if isFoodOrDrink is false"
}
${input.forceFoodAnalysis ? "Note: The user is explicitly asking for a nutritional breakdown of this item/photo, so set isFoodOrDrink to true if it is any kind of food or drink." : ""}`;

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
          },
        }),
      },
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return fallbackResult;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!textOut) return fallbackResult;

    const parsed = JSON.parse(textOut) as Record<string, unknown>;
    const dishName = String(parsed.dishName ?? "").trim() || rawName || "Meal";
    const category = validCategory(parsed.category, rawName || dishName);
    const isFoodOrDrink = Boolean(parsed.isFoodOrDrink) || category === "Food" || category === "Drink";

    const calories = isFoodOrDrink ? cleanNumber(parsed.calories, true) : null;
    const protein_g = isFoodOrDrink ? cleanNumber(parsed.protein_g, false) : null;
    const carbs_g = isFoodOrDrink ? cleanNumber(parsed.carbs_g, false) : null;
    const fat_g = isFoodOrDrink ? cleanNumber(parsed.fat_g, false) : null;
    const nutrition_note =
      isFoodOrDrink && parsed.nutrition_note ? String(parsed.nutrition_note).trim().slice(0, 140) : null;

    return {
      dishName: rawName || dishName,
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
