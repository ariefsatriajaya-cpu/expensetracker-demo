export type Parsed = { name: string; amount: number };

export type RecalcCommand = {
  targetIndexOrId: number | null;
  extraContext: string;
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
