import SearchBar from "./SearchBar";

interface TableToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  count: number;
}

function TableToolbar({ search, onSearch, count }: TableToolbarProps) {
  return (
    <>
      <SearchBar value={search} onChange={onSearch} />
      <span className="text-sm font-medium text-slate-500">
        {count} {count === 1 ? "row" : "rows"}
      </span>
    </>
  );
}

export default TableToolbar;
