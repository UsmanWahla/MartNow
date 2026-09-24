import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ToastContext, type ToastKind } from "../hooks/useToast";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "error") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, kind }]);

    const ttl = kind === "success" ? 1800 : 2800;

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, ttl);
  }, []);

  const toastLayer =
    toasts.length > 0
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-100 flex justify-center px-4 sm:bottom-7">
            <div className="flex w-full max-w-sm flex-col items-center gap-2">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  role="status"
                  className={`toast-pop w-fit max-w-full rounded-xl px-4 py-2.5 text-center text-sm font-medium shadow-[0_8px_24px_rgba(15,23,42,0.12)] ${
                    toast.kind === "error"
                      ? "border border-red-100 bg-white text-red-700"
                      : "border border-teal-100 bg-white text-teal-800"
                  }`}
                >
                  {toast.message}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastLayer}
    </ToastContext.Provider>
  );
}
