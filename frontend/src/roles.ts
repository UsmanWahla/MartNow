import type { Role, User } from "./auth";

export function getRole(user?: User | null): Role {
  return user?.role ?? "owner";
}

export function canManageCatalog(role?: Role | string | null) {
  return role === "owner" || role === "manager";
}

export function canManageStock(role?: Role | string | null) {
  return canManageCatalog(role);
}

export function canManageStaff(role?: Role | string | null) {
  return role === "owner";
}

export function canSeeProfit(role?: Role | string | null) {
  return canManageCatalog(role);
}

export function canEditSales(role?: Role | string | null) {
  return canManageCatalog(role);
}

export function canManagePeople(role?: Role | string | null) {
  return canManageCatalog(role);
}

export function canOpenSettings(role?: Role | string | null) {
  return role === "owner" || role === "manager";
}

export function isPlatformAdmin(role?: Role | string | null) {
  return role === "super_admin";
}

export function isCustomerRole(role?: Role | string | null) {
  return role === "shopper" || role === "customer";
}
