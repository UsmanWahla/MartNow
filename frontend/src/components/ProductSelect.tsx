import Select from "./Select";
import { formatMoney, type Product } from "../types";
import { formatQuantity, saleStock, unitLabel } from "../productUnits";

interface ProductSelectProps {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function ProductSelect({ products, value, onChange, error }: ProductSelectProps) {
  return (
    <Select value={value} onChange={onChange} error={error}>
      <option value="">Select product</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name} — {formatMoney(product.price)}/{product.sale_unit || "piece"} (stock{" "}
          {formatQuantity(saleStock(product))} {unitLabel(product.sale_unit, saleStock(product))})
        </option>
      ))}
    </Select>
  );
}

export default ProductSelect;
