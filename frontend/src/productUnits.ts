import type { Product } from "./types";

export { formatQuantity, formatUnitCost } from "./numberFormat";

export type InventoryType = "unit" | "weight" | "volume" | "length" | "pack";

export const INVENTORY_PRESETS: Record<
  InventoryType,
  { label: string; baseUnit: string; saleUnit: string; step: number; conversion: number }
> = {
  unit: { label: "Pieces / variants", baseUnit: "piece", saleUnit: "piece", step: 1, conversion: 1 },
  weight: { label: "Weight", baseUnit: "kg", saleUnit: "kg", step: 0.25, conversion: 1 },
  volume: { label: "Volume", baseUnit: "liter", saleUnit: "liter", step: 0.25, conversion: 1 },
  length: { label: "Length", baseUnit: "meter", saleUnit: "meter", step: 0.25, conversion: 1 },
  pack: { label: "Pack / dozen", baseUnit: "piece", saleUnit: "dozen", step: 1, conversion: 12 },
};

export const BASE_UNITS = ["piece", "kg", "liter", "meter"];
export const SALE_UNITS = ["piece", "pair", "dozen", "pack", "box", "kg", "gram", "liter", "ml", "meter"];

export function roundQuantity(value: number) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

export function unitLabel(unit?: string | null, quantity = 2) {
  const name = unit || "piece";
  if (Math.abs(Number(quantity)) === 1 || ["kg", "gram", "liter", "ml", "meter", "dozen"].includes(name)) {
    return name;
  }
  return `${name}s`;
}

export function saleStock(product: Pick<Product, "stock" | "units_per_sale_unit">, baseStock?: number) {
  const conversion = Number(product.units_per_sale_unit || 1);
  return roundQuantity(Number(baseStock ?? product.stock) / conversion);
}

export function productStep(product?: Pick<Product, "quantity_step"> | null) {
  return Number(product?.quantity_step || 1);
}
