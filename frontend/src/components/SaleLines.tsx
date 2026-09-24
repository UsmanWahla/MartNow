import Field from "./Field";
import ProductSelect from "./ProductSelect";
import VariantPickers from "./VariantPickers";
import Money from "./Money";
import { IconClose } from "./icons";
import type { Product } from "../types";
import { hasVariantOptions } from "../variantStock";

export interface SaleLine {
  productId: string;
  quantity: string;
  color?: string;
  size?: string;
}

interface SaleLinesProps {
  products: Product[];
  lines: SaleLine[];
  onChange: (lines: SaleLine[]) => void;
}

function lineTotal(products: Product[], line: SaleLine) {
  const product = products.find((item) => String(item.id) === line.productId);
  const quantity = Number(line.quantity);

  if (!product || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  return Math.round(Number(product.price) * quantity * 100) / 100;
}

function SaleLines({ products, lines, onChange }: SaleLinesProps) {
  function updateLine(index: number, changes: Partial<SaleLine>) {
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...changes } : line
      )
    );
  }

  const total = Math.round(
    lines.reduce((sum, line) => sum + lineTotal(products, line), 0) * 100
  ) / 100;

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => {
        const product = products.find((item) => String(item.id) === line.productId);

        return (
          <div
            key={index}
            className="rounded-xl border border-(--hairline) bg-[#f8fbfa] p-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ProductSelect
                  products={products}
                  value={line.productId}
                  onChange={(productId) =>
                    updateLine(index, { productId, color: "", size: "" })
                  }
                />
              </div>
              <div className="w-20 shrink-0">
                <Field
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={line.quantity}
                  onChange={(quantity) => updateLine(index, { quantity })}
                />
              </div>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Remove item"
                  onClick={() =>
                    onChange(lines.filter((_, lineIndex) => lineIndex !== index))
                  }
                >
                  <IconClose className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {hasVariantOptions(product) ? (
              <div className="mt-2">
                <VariantPickers
                  product={product}
                  color={line.color || ""}
                  size={line.size || ""}
                  onColor={(color) => updateLine(index, { color })}
                  onSize={(size) => updateLine(index, { size })}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="self-start text-sm font-semibold text-teal-700"
        onClick={() => onChange([...lines, { productId: "", quantity: "1" }])}
      >
        + Add item
      </button>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-600">Total</span>
        <span className="text-sm font-semibold text-slate-900">
          <Money value={total} />
        </span>
      </div>
    </div>
  );
}

export default SaleLines;
