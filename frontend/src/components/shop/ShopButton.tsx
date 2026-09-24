import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ShopButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "soft";
  size?: "md" | "sm";
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

function ShopButton({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ShopButtonProps) {
  const tone =
    variant === "ghost"
      ? "border border-[var(--hairline)] bg-white text-slate-700 hover:bg-slate-50"
      : variant === "danger"
        ? "bg-red-50 text-red-700 hover:bg-red-100"
        : variant === "soft"
          ? "bg-teal-50 text-teal-800 hover:bg-teal-100"
          : "bg-teal-700 text-white hover:bg-teal-800";

  return (
    <button
      type={type}
      className={`shop-btn ${size === "sm" ? "h-10 px-3" : ""} ${tone} ${block ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </button>
  );
}

export default ShopButton;
