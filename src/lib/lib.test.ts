import { describe, expect, it } from "vitest";
import {
  parseAmountOnly,
  parseAskCommand,
  parseExpense,
  parseMultipleExpenses,
  parseNutritionQuery,
  parseRecalcCommand,
  parseSetGoalCommand,
} from "./parse";
import { categorize } from "./categorize";
import { signSession, verifySession } from "./session";
import { formatNutritionBlock } from "./nutrition";

describe("parseExpense & parseMultipleExpenses", () => {
  it.each([
    ["nasi goreng 25000", "nasi goreng", 25000],
    ["kopi 18k", "kopi", 18000],
    ["sate 25rb", "sate", 25000],
    ["bakso 1.5jt", "bakso", 1500000],
    ["makan 25.000", "makan", 25000],
    ["Rp25000 x 3 2k", "Rp25000 x 3", 2000],
  ])("%s", (t, name, amount) => {
    expect(parseExpense(t)).toEqual({ name, amount });
  });
  it.each(["hello", "nasi goreng", "nasi 0", "nasi 1.5", "25000"])("rejects %s", (t) => {
    expect(parseExpense(t)).toBeNull();
  });

  it("parses multi-item comma and newline expense messages while keeping single comma names intact", () => {
    expect(parseMultipleExpenses("geprek 22k, es teh 5k, parkir 2k")).toEqual([
      { name: "geprek", amount: 22000 },
      { name: "es teh", amount: 5000 },
      { name: "parkir", amount: 2000 },
    ]);
    expect(parseMultipleExpenses("makan di polsek, geprek 22k")).toEqual([
      { name: "makan di polsek, geprek", amount: 22000 },
    ]);
    expect(parseMultipleExpenses("saran makan malam budget 25k tinggi protein")).toBeNull();
  });
});

describe("Telegram AI & Goal commands", () => {
  it("parses standalone price captions for photos", () => {
    expect(parseAmountOnly("25k")).toBe(25000);
    expect(parseAmountOnly("Rp22.000")).toBe(22000);
    expect(parseAmountOnly("geprek 22k")).toBeNull();
  });

  it("parses standalone nutrition commands", () => {
    expect(parseNutritionQuery("/nutri nasi padang")).toBe("nasi padang");
    expect(parseNutritionQuery("? indomie telur")).toBe("indomie telur");
    expect(parseNutritionQuery("/nutri")).toBe("");
    expect(parseNutritionQuery("nasi goreng 25k")).toBeNull();
  });

  it("parses /recalc commands with optional item index and extra context", () => {
    expect(parseRecalcCommand("/recalc")).toEqual({ targetIndexOrId: null, extraContext: "" });
    expect(parseRecalcCommand("/recalc 1")).toEqual({ targetIndexOrId: 1, extraContext: "" });
    expect(parseRecalcCommand("/recalc #2 nasi setengah porsi, dada ayam")).toEqual({
      targetIndexOrId: 2,
      extraContext: "nasi setengah porsi, dada ayam",
    });
  });

  it("parses /setgoal commands", () => {
    expect(parseSetGoalCommand("/setgoal daily 120k month 3.5jt kcal 2100 p 130 c 230 f 65")).toEqual({
      patch: {
        daily_budget: 120000,
        monthly_budget: 3500000,
        daily_calories: 2100,
        daily_protein_g: 130,
        daily_carbs_g: 230,
        daily_fat_g: 65,
      },
      hasUpdates: true,
    });
    expect(parseSetGoalCommand("/setgoal")).toEqual({ patch: {}, hasUpdates: false });
  });

  it("parses /ask commands", () => {
    expect(parseAskCommand("/ask sisa kalori hari ini")).toBe("sisa kalori hari ini");
    expect(parseAskCommand("geprek 22k")).toBeNull();
  });

  it("formats nutrition macro block", () => {
    expect(
      formatNutritionBlock({
        calories: 650,
        protein_g: 32,
        carbs_g: 68,
        fat_g: 24,
        nutrition_note: "High protein",
      }),
    ).toContain("650 kcal");
  });
});

describe("categorize", () => {
  it("maps keywords", () => {
    expect(categorize("nasi goreng")).toBe("Food");
    expect(categorize("Kopi susu")).toBe("Drink");
    expect(categorize("grab ke kantor")).toBe("Transport");
    expect(categorize("random thing")).toBe("Other");
  });
});

describe("session", () => {
  it("verifies valid, rejects tampered/expired/missing", async () => {
    const tok = await signSession("s");
    expect(await verifySession(tok, "s")).toBe(true);
    expect(await verifySession(tok, "other")).toBe(false);
    expect(await verifySession(tok + "x", "s")).toBe(false);
    expect(await verifySession(undefined, "s")).toBe(false);
    expect(await verifySession(tok, "s", Date.now() + 31 * 24 * 3600 * 1000)).toBe(false);
  });
});
