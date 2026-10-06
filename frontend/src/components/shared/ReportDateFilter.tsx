import DatePicker from "./DatePicker";
import type { ReportRange } from "../../types";

import { currentMonthRange, reportDateValue } from "../../utils/reporting";

function todayRange(): ReportRange {
  const today = reportDateValue(new Date());
  return { from: today, to: today };
}

interface ReportDateFilterProps {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  loading?: boolean;
}

function ReportDateFilter({ value, onChange, loading = false }: ReportDateFilterProps) {
  const month = currentMonthRange();
  const today = todayRange();
  const buttonClass = (active: boolean) =>
    `rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
      active ? "bg-teal-700 text-white" : "bg-white text-slate-600 hover:bg-teal-50"
    }`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-busy={loading}>
      <button
        type="button"
        className={buttonClass(value.from === today.from && value.to === today.to)}
        onClick={() => onChange(today)}
      >
        Today
      </button>
      <button
        type="button"
        className={buttonClass(value.from === month.from && value.to === month.to)}
        onClick={() => onChange(month)}
      >
        This month
      </button>
      <button
        type="button"
        className={buttonClass(!value.from && !value.to)}
        onClick={() => onChange({ from: "", to: "" })}
      >
        All time
      </button>
      <DatePicker
        from={value.from}
        to={value.to}
        onChange={onChange}
        ariaLabel="Filter reports by date"
      />
    </div>
  );
}

export default ReportDateFilter;
