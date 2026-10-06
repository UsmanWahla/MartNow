import type { ReactNode } from "react";
import SearchBar from "./SearchBar";

interface TableToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  count: number;
  actions?: ReactNode;
}

function TableToolbar({ search, onSearch, count, actions }: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchBar value={search} onChange={onSearch} />
      <span className="text-sm font-medium text-slate-500">
        {count} {count === 1 ? "row" : "rows"}
      </span>
      {actions}
    </div>
  );
}

export default TableToolbar;
