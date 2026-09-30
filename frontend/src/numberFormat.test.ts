import { describe, expect, it } from "vitest";
import {
  formatCardMoney,
  formatMoney,
  formatNumberInput,
  formatQuantity,
  formatUnitCost,
} from "./numberFormat";

describe("number display formatting", () => {
  it("removes unnecessary quantity zeros while preserving useful precision", () => {
    expect(formatQuantity("5.000")).toBe("5");
    expect(formatQuantity("0.500")).toBe("0.5");
    expect(formatQuantity(1.2349)).toBe("1.235");
  });

  it("formats money and unit cost without forced zero decimals", () => {
    expect(formatMoney("12000.00")).toBe("PKR 12,000");
    expect(formatMoney("10.50")).toBe("PKR 10.5");
    expect(formatUnitCost("10.2575")).toBe("PKR 10.2575");
  });

  it("cleans database decimals for editable number inputs", () => {
    expect(formatNumberInput("500.0000")).toBe("500");
    expect(formatNumberInput("1.000")).toBe("1");
    expect(formatNumberInput("0.500")).toBe("0.5");
    expect(formatNumberInput(null)).toBe("");
  });

  it("keeps dashboard values compact and readable", () => {
    expect(formatCardMoney(10_000)).toBe("PKR 10k");
    expect(formatCardMoney(1_250_000)).toBe("PKR 1.25M");
  });
});
