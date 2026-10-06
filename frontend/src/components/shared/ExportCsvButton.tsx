import { useState } from "react";
import { IconDownload } from "./icons";

interface ExportCsvButtonProps {
  onExport: () => Promise<void> | void;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  label?: string;
  disabled?: boolean;
}

function ExportCsvButton({
  onExport,
  onError,
  onSuccess,
  label = "Export CSV",
  disabled = false,
}: ExportCsvButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (disabled || exporting) {
      return;
    }

    setExporting(true);

    try {
      await onExport();
      onSuccess?.();
    } catch (error) {
      onError?.(error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => void handleExport()}
      disabled={disabled || exporting}
    >
      <IconDownload className="h-4 w-4" />
      {exporting ? "Exporting..." : label}
    </button>
  );
}

export default ExportCsvButton;
