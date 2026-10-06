interface ReportTab<T extends string> {
  id: T;
  label: string;
}

interface ReportTabsProps<T extends string> {
  tabs: ReportTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

function ReportTabs<T extends string>({ tabs, value, onChange }: ReportTabsProps<T>) {
  return (
    <div className="shop-scroll rounded-2xl border border-(--hairline) bg-white p-1.5" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
            value === tab.id
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default ReportTabs;
