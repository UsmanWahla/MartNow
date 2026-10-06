import { useEffect, type ReactNode } from "react";
import { IconClose } from "./icons";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

function Modal({ title, children, onClose, wide = false }: ModalProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="anim-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-[3px]">
      <div
        className={`anim-modal surface-card max-h-[90vh] w-full overflow-hidden rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <h3 className="text-lg font-semibold tracking-tight text-slate-800">{title}</h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
