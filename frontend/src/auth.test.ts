import { afterEach, describe, expect, it } from "vitest";
import {
  clearAuth,
  getUser,
  hasSession,
  isShopperSession,
  safeNextPath,
  saveSession,
  shopLoginPath,
} from "./auth";

describe("session", () => {
  afterEach(() => {
    clearAuth();
  });

  it("keeps tokens out of localStorage and stores only a session marker", () => {
    localStorage.setItem("refreshToken", "old-refresh");

    saveSession({
      id: 1,
      name: "Ali",
      email: "ali@example.com",
      role: "owner",
      tenantId: 1,
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(hasSession()).toBe(true);
    expect(getUser()?.email).toBe("ali@example.com");
  });

  it("migrates an existing bearer-token session without retaining the token", () => {
    localStorage.setItem("token", "legacy-access-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, name: "Ali", email: "ali@example.com", role: "owner" })
    );

    expect(hasSession()).toBe(true);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("sessionActive")).toBe("1");
  });

  it("detects a shopper session and builds the shop login path", () => {
    expect(isShopperSession()).toBe(false);

    saveSession({
      id: 2,
      name: "Sara",
      email: "sara@example.com",
      role: "shopper",
      tenantId: 1,
    });

    expect(isShopperSession()).toBe(true);
    expect(shopLoginPath("ali-shop", "/shop/ali-shop/cart")).toBe(
      "/account/login?next=%2Fshop%2Fali-shop%2Fcart"
    );
  });

  it("only accepts local redirect paths", () => {
    expect(safeNextPath("/shop/ali-shop/cart?step=2")).toBe("/shop/ali-shop/cart?step=2");
    expect(safeNextPath("https://evil.example")).toBe("/stores");
    expect(safeNextPath("//evil.example")).toBe("/stores");
    expect(safeNextPath("/\\evil.example")).toBe("/stores");
  });
});
