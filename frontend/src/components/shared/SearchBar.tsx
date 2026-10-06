interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
}: SearchBarProps) {
  return (
    <input
      className="w-44 rounded-xl border border-[#c5d5d0] px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-teal-700 focus:shadow-[0_0_0_3px_rgba(15,118,110,0.14)]"
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default SearchBar;
