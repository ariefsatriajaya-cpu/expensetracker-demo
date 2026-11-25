import { describe, expect, it } from "vitest";
import { parseExpense } from "./parse";
import { categorize } from "./categorize";
import { signSession, verifySession } from "./session";

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
