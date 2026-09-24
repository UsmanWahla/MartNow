interface FieldProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string | number;
  step?: string | number;
  className?: string;
  error?: string;
  name?: string;
  autoComplete?: string;
  preventAutofill?: boolean;
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  min,
  step,
  className = "field-input",
  error,
  name,
  autoComplete,
  preventAutofill = false,
}: FieldProps) {
  return (
    <div>
      {label ? <label className="mb-1 block font-semibold">{label}</label> : null}
      <input
        className={error ? `${className} field-input--error` : className}
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        step={step}
        readOnly={preventAutofill}
        aria-invalid={Boolean(error)}
        data-1p-ignore={preventAutofill ? "true" : undefined}
        data-lpignore={preventAutofill ? "true" : undefined}
        onFocus={preventAutofill ? (event) => event.currentTarget.removeAttribute("readonly") : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}

export default Field;
