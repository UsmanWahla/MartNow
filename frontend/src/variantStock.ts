import type { Product, ProductColor } from "./types";

export function variantKey(color?: string | null, size?: string | null) {
  return `${color || ""}|${size || ""}`;
}

export function variantLabel(color?: string | null, size?: string | null) {
  return [color, size].filter(Boolean).join(" / ");
}

export function variantCombos(colors: ProductColor[], sizes: string[]) {
  const colorNames = colors.length > 0 ? colors.map((color) => color.name) : [""];
  const sizeNames = sizes.length > 0 ? sizes : [""];
  const rows: { color: string; size: string }[] = [];

  for (const color of colorNames) {
    for (const size of sizeNames) {
      rows.push({ color, size });
    }
  }

  return rows;
}

export function findVariantStock(product: Product, color?: string, size?: string) {
  const variants = product.variants;

  if (!variants || variants.length === 0) {
    return Number(product.stock) || 0;
  }

  const row = variants.find(
    (item) => (item.color || "") === (color || "") && (item.size || "") === (size || "")
  );
  return row ? Number(row.stock) || 0 : 0;
}

export function weakestStock(product: Product) {
  if (
    product.variants &&
    product.variants.length > 0 &&
    ((product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0))
  ) {
    return Math.min(...product.variants.map((item) => Number(item.stock) || 0));
  }

  return Number(product.stock) || 0;
}

export function hasVariantOptions(product?: Product | null) {
  return Boolean(product?.colors?.length || product?.sizes?.length);
}
