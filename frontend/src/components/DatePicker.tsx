import { useEffect, useRef, useState } from "react";
import { DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

function fromDateValue(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : undefined;
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const date = fromDateValue(value);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : "Select date";
}

function DatePicker({ value, onChange, ariaLabel = "Select date" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = fromDateValue(value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="field-input flex min-w-11rem items-center justify-between gap-3 text-left"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>{formatDate(value)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4 shrink-0 text-teal-700"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
          style={
            {
              "--rdp-accent-color": "#0f766e",
              "--rdp-accent-background-color": "#ccfbf1",
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            showOutsideDays
            onSelect={(nextDate) => {
              if (nextDate) {
                onChange(toDateValue(nextDate));
                setOpen(false);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default DatePicker;
