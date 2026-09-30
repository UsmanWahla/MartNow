import { describe, expect, it } from "vitest";
import { canViewCommission } from "./roles";

describe("commission permissions", () => {
  it("allows owners and managers but not cashiers", () => {
    expect(canViewCommission("owner")).toBe(true);
    expect(canViewCommission("manager")).toBe(true);
    expect(canViewCommission("cashier")).toBe(false);
  });
});
