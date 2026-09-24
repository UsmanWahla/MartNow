import type { ReactNode } from "react";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  error?: string;
  className?: string;
}

function Select({
  value,
  onChange,
  children,
  error,
  className = "w-full rounded-xl border border-[#c5d5d0] px-3 py-2 outline-none transition-[border-color,box-shadow] duration-150 focus:border-teal-700 focus:shadow-[0_0_0_3px_rgba(15,118,110,0.14)]",
}: SelectProps) {
  return (
    <div>
      <select
        className={error ? `${className} field-input--error` : className}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}

export default Select;
