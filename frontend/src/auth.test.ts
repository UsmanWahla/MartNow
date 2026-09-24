import { afterEach, describe, expect, it } from "vitest";
import {
  clearAuth,
  getToken,
  getRefreshToken,
  getUser,
  isShopperSession,
  saveSession,
  shopLoginPath,
} from "./auth";

describe("session", () => {
  afterEach(() => {
    clearAuth();
  });

  it("stores the access token for API calls and keeps refresh out of localStorage", () => {
    localStorage.setItem("refreshToken", "old-refresh");

    saveSession(
      {
        id: 1,
        name: "Ali",
        email: "ali@example.com",
        role: "owner",
        tenantId: 1,
      },
      "access-token"
    );

    expect(getToken()).toBe("access-token");
    expect(getRefreshToken()).toBeNull();
    expect(getUser()?.email).toBe("ali@example.com");
  });

  it("detects a shopper session and builds the shop login path", () => {
    expect(isShopperSession()).toBe(false);

    saveSession(
      {
        id: 2,
        name: "Sara",
        email: "sara@example.com",
        role: "shopper",
        tenantId: 1,
      },
      "shopper-token"
    );

    expect(isShopperSession()).toBe(true);
    expect(shopLoginPath("ali-shop", "/shop/ali-shop/cart")).toBe(
      "/account/login?next=%2Fshop%2Fali-shop%2Fcart"
    );
  });
});
