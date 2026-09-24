interface SaveButtonProps {
  children?: string;
  loading?: boolean;
}

function SaveButton({ children = "Save", loading = false }: SaveButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Saving..." : children}
    </button>
  );
}

export default SaveButton;
