export const CATEGORIES = ["Food", "Drink", "Transport", "Groceries", "Bills", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

const KEYWORDS: Record<Exclude<Category, "Other">, string[]> = {
  Drink: ["kopi", "coffee", "teh", "tea", "jus", "juice", "boba", "latte", "susu", "milk", "air", "es "],
  Transport: ["grab", "gojek", "ojek", "bensin", "fuel", "parkir", "tol", "taxi", "bus", "krl", "mrt", "ojol"],
  Groceries: ["indomaret", "alfamart", "supermarket", "sayur", "belanja", "groceries", "buah"],
  Bills: ["listrik", "pulsa", "internet", "wifi", "token", "pdam", "bill", "tagihan", "kos", "sewa"],
  Food: ["nasi", "mie", "bakso", "soto", "ayam", "sate", "makan", "lunch", "dinner", "breakfast", "sarapan", "burger", "pizza", "roti", "gado", "rendang", "goreng"],
};

export function categorize(name: string): Category {
  const n = ` ${name.toLowerCase()} `;
  for (const cat of ["Drink", "Transport", "Groceries", "Bills", "Food"] as const) {
    if (KEYWORDS[cat].some((k) => n.includes(k.endsWith(" ") ? ` ${k}` : k))) return cat;
  }
  return "Other";
}
