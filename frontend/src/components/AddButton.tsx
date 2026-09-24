import { IconPlus } from "./icons";

interface AddButtonProps {
  onClick: () => void;
  label?: string;
}

function AddButton({ onClick, label = "Add" }: AddButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800"
      onClick={onClick}
    >
      <IconPlus className="h-4 w-4" />
      {label}
    </button>
  );
}

export default AddButton;
