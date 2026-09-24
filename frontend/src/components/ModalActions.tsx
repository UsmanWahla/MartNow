interface ModalActionsProps {
  cancelLabel?: string;
  saveLabel?: string;
  loading?: boolean;
  onCancel: () => void;
}

function ModalActions({
  cancelLabel = "Cancel",
  saveLabel = "Save",
  loading = false,
  onCancel,
}: ModalActionsProps) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={loading}
        className="rounded-xl border border-(--hairline) px-4 py-2 text-sm font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving..." : saveLabel}
      </button>
    </div>
  );
}

export default ModalActions;
