import { useState } from "react";
import { IconEye, IconEyeOff } from "./icons";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  label?: string;
  name?: string;
  autoComplete?: string;
  preventAutofill?: boolean;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  className = "rounded-xl border border-[#c5d5d0] px-3 py-2.5 pr-10 outline-none transition-[border-color,box-shadow] duration-150 focus:border-teal-700 focus:shadow-[0_0_0_3px_rgba(15,118,110,0.14)]",
  error,
  label,
  name,
  autoComplete = "current-password",
  preventAutofill = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      {label ? <label className="mb-1 block font-semibold">{label}</label> : null}
      <div className="relative">
        <input
          className={`w-full ${error ? `${className} field-input--error` : className}`}
          type={show ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          aria-invalid={Boolean(error)}
          readOnly={preventAutofill}
          data-1p-ignore={preventAutofill ? "true" : undefined}
          data-lpignore={preventAutofill ? "true" : undefined}
          onFocus={preventAutofill ? (event) => event.currentTarget.removeAttribute("readonly") : undefined}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-teal-800"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <IconEyeOff className="h-4 w-4" />
          ) : (
            <IconEye className="h-4 w-4" />
          )}
        </button>
      </div>
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}

export default PasswordInput;
