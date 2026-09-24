import { IconMinus, IconPlus } from "../icons";

interface ShopQtyStepperProps {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  size?: "sm" | "md";
}

function ShopQtyStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  className = "",
  size = "md",
}: ShopQtyStepperProps) {
  const current = Number.isFinite(value) ? value : min;
  const ceiling = Math.max(min, max);
  const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className={`shop-qty ${size === "sm" ? "shop-qty-sm" : ""} ${className}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || current <= min}
        onClick={() => onChange(Math.max(min, current - 1))}
      >
        <IconMinus className={iconClass} />
      </button>
      <span className="font-ledger">{current}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || current >= ceiling}
        onClick={() => onChange(Math.min(ceiling, current + 1))}
      >
        <IconPlus className={iconClass} />
      </button>
    </div>
  );
}

export default ShopQtyStepper;
