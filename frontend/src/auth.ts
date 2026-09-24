import axios from "axios";

export type Role = "owner" | "manager" | "cashier" | "shopper" | "customer" | "super_admin";

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  role?: Role;
  tenantId?: number | null;
  shop_name?: string;
  shop_slug?: string;
  low_stock_threshold?: number;
}

export const API_URL = import.meta.env.VITE_API_URL ?? "";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

export function getUser(): User | null {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    return null;
  }
}

export function isCustomerRole(role?: string | null): boolean {
  return role === "shopper" || role === "customer";
}

export function isShopperUser(user: User | null): boolean {
  return Boolean(user && getToken() && isCustomerRole(user.role));
}

export function isShopperSession(): boolean {
  return isShopperUser(getUser());
}

export function isCustomerSession(): boolean {
  return isShopperSession();
}

export function isSuperAdmin(user: User | null = getUser()): boolean {
  return Boolean(user && getToken() && user.role === "super_admin");
}

export function shopLoginPath(slug: string, next: string): string {
  return `/account/login?next=${encodeURIComponent(next || `/shop/${slug}`)}`;
}

export function clearAuth(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

export function saveUser(user: User): void {
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth-user-changed"));
}

export function saveSession(user: User, token?: string) {
  localStorage.removeItem("refreshToken");

  if (token) {
    localStorage.setItem("token", token);
  }

  saveUser(user);
}

export function getUserInitials(user: User | null): string {
  if (!user?.name) {
    return "U";
  }

  const parts = user.name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function authHeader(): Record<string, string> {
  const token = getToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data;

    if (
      apiMessage &&
      typeof apiMessage === "object" &&
      "message" in apiMessage &&
      typeof apiMessage.message === "string"
    ) {
      return apiMessage.message;
    }

    if (!error.response) {
      return "Unable to connect to server. Start the backend with node server.js";
    }
  }

  return fallback;
}

let refreshRequest: Promise<boolean> | null = null;
let responseInterceptor: number | null = null;

async function refreshSession() {
  const refreshToken = getRefreshToken();
  const response = await axios.post(
    `${API_URL}/api/refresh`,
    refreshToken ? { refreshToken } : {},
    { withCredentials: true }
  );
  saveSession(response.data.user, response.data.token);
  return true;
}

export function setupApi() {
  axios.defaults.withCredentials = true;
  axios.defaults.timeout = 15000;

  if (responseInterceptor !== null) {
    axios.interceptors.response.eject(responseInterceptor);
  }

  responseInterceptor = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config as {
        url?: string;
        _retry?: boolean;
        headers?: Record<string, string>;
      };
      const message =
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
          ? String(error.response.data.message)
          : "";

      const isExpiredAuth =
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        (message === "Please login first" ||
          message === "Invalid or expired token");

      const isAuthRoute =
        original?.url?.includes("/api/login") ||
        original?.url?.includes("/api/signup") ||
        original?.url?.includes("/api/refresh") ||
        original?.url?.includes("/api/customer/login") ||
        original?.url?.includes("/api/customer/signup") ||
        original?.url?.includes("/api/super/login") ||
        Boolean(original?.url?.match(/\/api\/shop\/[^/]+\/(login|signup)/));

      if (isExpiredAuth && !original?._retry && !isAuthRoute) {
        original._retry = true;

        try {
          refreshRequest = refreshRequest || refreshSession();
          const ok = await refreshRequest;
          refreshRequest = null;

          if (ok) {
            original.headers = {
              ...(original.headers || {}),
              ...authHeader(),
            };
            return axios(original);
          }
        } catch {
          refreshRequest = null;
        }

        clearAuth();
        const path = window.location.pathname;
        const search = window.location.search;
        const next = encodeURIComponent(`${path}${search}`);

        if (path.startsWith("/super")) {
          window.location.href = "/super/login";
        } else if (path.startsWith("/shop/") || path.startsWith("/stores") || path.startsWith("/account") || path.startsWith("/register")) {
          window.location.href = `/account/login?next=${next}`;
        } else if (path !== "/login" && path !== "/" && path !== "/signup") {
          window.location.href = "/login";
        }
      }

      return Promise.reject(error);
    }
  );
}
