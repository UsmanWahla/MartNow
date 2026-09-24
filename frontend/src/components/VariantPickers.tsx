import Select from "./Select";
import type { Product } from "../types";
import { findVariantStock, hasVariantOptions, variantLabel } from "../variantStock";

interface VariantPickersProps {
  product?: Product;
  color: string;
  size: string;
  onColor: (value: string) => void;
  onSize: (value: string) => void;
}

function VariantPickers({ product, color, size, onColor, onSize }: VariantPickersProps) {
  if (!hasVariantOptions(product)) {
    return null;
  }

  const needsColor = Boolean(product?.colors?.length);
  const needsSize = Boolean(product?.sizes?.length);
  const ready = (!needsColor || Boolean(color)) && (!needsSize || Boolean(size));
  const onHand = ready ? findVariantStock(product as Product, color, size) : null;

  return (
    <div className="flex flex-col gap-2">
      {needsColor ? (
        <Select value={color} onChange={onColor}>
          <option value="">Color</option>
          {product?.colors?.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      ) : null}
      {needsSize ? (
        <Select value={size} onChange={onSize}>
          <option value="">Size</option>
          {product?.sizes?.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      ) : null}
      {ready ? (
        <p className="text-xs font-medium text-slate-500">
          On hand{variantLabel(color, size) ? ` · ${variantLabel(color, size)}` : ""}: {onHand}
        </p>
      ) : (
        <p className="text-xs font-medium text-slate-400">
          Choose {needsColor && needsSize ? "color and size" : needsColor ? "a color" : "a size"}
        </p>
      )}
    </div>
  );
}

export default VariantPickers;
