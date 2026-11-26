import { describe, expect, it } from "vitest";
import { parseAmountOnly, parseExpense, parseNutritionQuery, parseRecalcCommand } from "./parse";
import { categorize } from "./categorize";
import { signSession, verifySession } from "./session";
import { formatNutritionBlock } from "./nutrition";

describe("parseExpense", () => {
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
});

describe("parseAmountOnly, parseNutritionQuery & parseRecalcCommand", () => {
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
    expect(parseRecalcCommand("/recalc geprek tanpa nasi")).toEqual({
      targetIndexOrId: null,
      extraContext: "geprek tanpa nasi",
    });
    expect(parseRecalcCommand("nasi goreng 25k")).toBeNull();
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
