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
    <div className="anim-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[3px]">
      <div className={`anim-modal surface-card max-h-[90vh] w-full overflow-y-auto rounded-2xl p-6 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-slate-800">{title}</h3>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
