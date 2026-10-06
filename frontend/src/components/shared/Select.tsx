import type { ReactNode } from "react";

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  error?: string;
  className?: string;
}

function Select({
  label,
  value,
  onChange,
  children,
  error,
  className = "field-input",
}: SelectProps) {
  return (
    <div>
      {label ? <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label> : null}
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
