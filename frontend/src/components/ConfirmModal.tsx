import Modal from "./Modal";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={loading ? () => undefined : onCancel}>
      <p className="text-slate-600">{message}</p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={loading}
          className="rounded-xl border border-(--hairline) px-4 py-2 text-sm font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onConfirm}
        >
          {loading ? "Please wait..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
