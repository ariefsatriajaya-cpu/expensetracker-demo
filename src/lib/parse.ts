export type Parsed = { name: string; amount: number };

export type RecalcCommand = {
  targetIndexOrId: number | null;
  extraContext: string;
};

export type GoalPatch = {
  body_weight_kg?: number;
  daily_budget?: number;
  monthly_budget?: number;
  daily_calories?: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
};

export function toAmount(tok: string): number | null {
  const t = tok.trim().toLowerCase().replace(/^rp\.?/, "");
  const m = t.match(/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/);
  if (!m) return null;
  let num = m[1];
  const suffix = m[2];
  if (suffix) {
    num = num.replace(",", ".");
    const mult = suffix === "jt" || suffix === "juta" ? 1_000_000 : 1_000;
    const v = Math.round(parseFloat(num) * mult);
    return v > 0 ? v : null;
  }
  // no suffix: dots/commas are thousand separators
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) num = num.replace(/[.,]/g, "");
  else if (/[.,]/.test(num)) return null;
  const v = parseInt(num, 10);
  return v > 0 ? v : null;
}

export function parseExpense(text: string): Parsed | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const amount = toAmount(parts[parts.length - 1]);
  if (amount === null) return null;
  const name = parts.slice(0, -1).join(" ").trim();
  if (!name) return null;
  return { name, amount };
}

/**
 * Parses one or multiple expenses from a single message.
 * - Multi-line messages where every non-empty line is a valid expense -> returns all.
 * - Comma/semicolon separated segments where every segment is a valid expense (e.g. "geprek 22k, es teh 5k") -> returns all.
 * - Single expense with a comma inside its name (e.g. "makan di polsek, geprek 22k") -> returns 1 item.
 */
export function parseMultipleExpenses(text: string): Parsed[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const results: Parsed[] = [];
  for (const line of lines) {
    const commaParts = line
      .split(/\s*[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (commaParts.length > 1) {
      const parsedParts = commaParts.map(parseExpense);
      if (parsedParts.every((p): p is Parsed => p !== null)) {
        results.push(...parsedParts);
        continue;
      }
    }

    const single = parseExpense(line);
    if (!single) return null;
    results.push(single);
  }

  return results.length > 0 ? results : null;
}

export function parseAmountOnly(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return toAmount(trimmed);
}

export function parseNutritionQuery(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("?")) {
    const q = trimmed.slice(1).trim();
    return q || null;
  }
  const m = trimmed.match(/^\/(?:nutri|nutrition|kalori|gizi)(?:@\S+)?(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

export function parseAskCommand(text: string): string | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^\/(?:ask|coach|tanya|saran)(?:@\S+)?(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

export function parseRecalcCommand(text: string): RecalcCommand | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^\/(?:recalc|recalculate|hitung)(?:@\S+)?(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  const arg = (m[1] ?? "").trim();
  if (!arg) {
    return { targetIndexOrId: null, extraContext: "" };
  }
  const numMatch = arg.match(/^#?(\d+)(?:\s+([\s\S]+))?$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    return {
      targetIndexOrId: num > 0 ? num : null,
      extraContext: (numMatch[2] ?? "").trim(),
    };
  }
  return {
    targetIndexOrId: null,
    extraContext: arg,
  };
}

export function parseSetGoalCommand(text: string): {
  patch: GoalPatch;
  hasUpdates: boolean;
  autoCalcFromWeight?: "cut" | "maintain" | "gain";
} | null {
  const trimmed = text.trim();
  const weightOnlyMatch = trimmed.match(
    /^\/(?:weight|berat|bb)(?:@\S+)?(?:\s+([0-9]+(?:[.,][0-9]+)?)\s*(?:kg)?)?(?:\s+(cut|cutting|maintain|maintenance|gain|bulk|bulking))?$/i,
  );
  if (weightOnlyMatch) {
    const rawW = weightOnlyMatch[1];
    if (!rawW) return { patch: {}, hasUpdates: false };
    const w = Number(rawW.replace(",", "."));
    if (!Number.isFinite(w) || w < 25 || w > 300) return { patch: {}, hasUpdates: false };
    const rawMode = (weightOnlyMatch[2] ?? "maintain").toLowerCase();
    const mode: "cut" | "maintain" | "gain" =
      rawMode.startsWith("cut") ? "cut" : rawMode.startsWith("gain") || rawMode.startsWith("bulk") ? "gain" : "maintain";
    return {
      patch: { body_weight_kg: Math.round(w * 10) / 10 },
      hasUpdates: true,
      autoCalcFromWeight: mode,
    };
  }

  const m = trimmed.match(/^\/(?:setgoal|goal|target|targets)(?:@\S+)?(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  const arg = (m[1] ?? "").trim();
  if (!arg) return { patch: {}, hasUpdates: false };

  const patch: GoalPatch = {};
  const pairRegex =
    /\b(weight|w|kg|berat|bb|daily|day|harian|budget|month|monthly|bulanan|kcal|cal|calories|kalori|p|pro|protein|c|carb|carbs|karbo|f|fat|lemak)\s*[:=]?\s*([0-9.,]+(?:k|rb|ribu|jt|juta)?(?:kg|g)?)/gi;

  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(arg)) !== null) {
    const key = match[1].toLowerCase();
    const rawVal = match[2].toLowerCase().replace(/(?:kg|g)$/, "");
    if (key === "weight" || key === "w" || key === "kg" || key === "berat" || key === "bb") {
      const n = Number(rawVal.replace(",", "."));
      if (Number.isFinite(n) && n >= 25 && n <= 300) patch.body_weight_kg = Math.round(n * 10) / 10;
    } else if (key === "daily" || key === "day" || key === "harian" || key === "budget") {
      const v = toAmount(rawVal);
      if (v) patch.daily_budget = v;
    } else if (key === "month" || key === "monthly" || key === "bulanan") {
      const v = toAmount(rawVal);
      if (v) patch.monthly_budget = v;
    } else if (key === "kcal" || key === "cal" || key === "calories" || key === "kalori") {
      const n = Number(rawVal.replace(/[.,]/g, ""));
      if (Number.isFinite(n) && n > 0) patch.daily_calories = Math.round(n);
    } else if (key === "p" || key === "pro" || key === "protein") {
      const n = Number(rawVal.replace(",", "."));
      if (Number.isFinite(n) && n > 0) patch.daily_protein_g = Math.round(n * 10) / 10;
    } else if (key === "c" || key === "carb" || key === "carbs" || key === "karbo") {
      const n = Number(rawVal.replace(",", "."));
      if (Number.isFinite(n) && n > 0) patch.daily_carbs_g = Math.round(n * 10) / 10;
    } else if (key === "f" || key === "fat" || key === "lemak") {
      const n = Number(rawVal.replace(",", "."));
      if (Number.isFinite(n) && n > 0) patch.daily_fat_g = Math.round(n * 10) / 10;
    }
  }

  const modeMatch = arg.match(/\b(cut|cutting|maintain|maintenance|gain|bulk|bulking)\b/i);
  const explicitMacroProvided =
    patch.daily_calories !== undefined ||
    patch.daily_protein_g !== undefined ||
    patch.daily_carbs_g !== undefined ||
    patch.daily_fat_g !== undefined;
  const autoCalcFromWeight =
    patch.body_weight_kg !== undefined && !explicitMacroProvided
      ? modeMatch
        ? modeMatch[1].toLowerCase().startsWith("cut")
          ? "cut"
          : modeMatch[1].toLowerCase().startsWith("gain") || modeMatch[1].toLowerCase().startsWith("bulk")
            ? "gain"
            : "maintain"
        : "maintain"
      : undefined;

  return {
    patch,
    hasUpdates: Object.keys(patch).length > 0,
    ...(autoCalcFromWeight ? { autoCalcFromWeight } : {}),
  };
}
