import type { DashboardPeriod } from "../types";

interface PeriodToggleProps {
  value: DashboardPeriod;
  onChange: (value: DashboardPeriod) => void;
}

function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  const options: { id: DashboardPeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="surface-card inline-flex rounded-xl p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${
            value === option.id
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-500 hover:bg-teal-50 hover:text-slate-800"
          }`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default PeriodToggle;
