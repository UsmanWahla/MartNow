import { IconMinus, IconPlus } from "../icons";

interface ShopQtyStepperProps {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  size?: "sm" | "md";
  step?: number;
}

function ShopQtyStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  className = "",
  size = "md",
  step = 1,
}: ShopQtyStepperProps) {
  const current = Number.isFinite(value) ? value : min;
  const ceiling = Math.max(min, max);
  const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const increment = Math.max(0.001, Number(step) || 1);
  const normalize = (next: number) =>
    Math.round(Math.min(ceiling, Math.max(min, next)) * 1000) / 1000;

  return (
    <div className={`shop-qty ${size === "sm" ? "shop-qty-sm" : ""} ${className}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || current <= min}
        onClick={() => onChange(normalize(current - increment))}
      >
        <IconMinus className={iconClass} />
      </button>
      <input
        aria-label="Quantity"
        className="font-ledger"
        type="number"
        min={min}
        max={ceiling}
        step={increment}
        disabled={disabled}
        value={current}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(normalize(next));
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || current >= ceiling}
        onClick={() => onChange(normalize(current + increment))}
      >
        <IconPlus className={iconClass} />
      </button>
    </div>
  );
}

export default ShopQtyStepper;
