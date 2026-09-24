import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconDots, IconPencil, IconTrash } from "./icons";

interface RowMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
  extras?: { label: string; onClick: () => void; icon?: ReactNode }[];
}

const MENU_HEIGHT = 188;
const GAP = 6;

function getMenuStyle(button: HTMLElement): CSSProperties {
  const rect = button.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const openUp = spaceBelow < MENU_HEIGHT && rect.top > spaceBelow;

  return {
    position: "fixed",
    top: openUp ? "auto" : rect.bottom + GAP,
    bottom: openUp ? window.innerHeight - rect.top + GAP : "auto",
    right: Math.max(8, window.innerWidth - rect.right),
    zIndex: 60,
  };
}

function RowMenu({ onEdit, onDelete, extras = [] }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasPrimary = extras.length > 0 || Boolean(onEdit);

  function placeMenu() {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    setStyle(getMenuStyle(button));
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeIfOutside(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function onReposition() {
      placeMenu();
    }

    document.addEventListener("mousedown", closeIfOutside);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const menu = (
    <div
      ref={panelRef}
      className="anim-menu surface-card w-40 overflow-hidden rounded-xl py-1"
      style={style}
    >
      {extras.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-teal-50"
          onClick={() => {
            setOpen(false);
            item.onClick();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      {onEdit ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-teal-50"
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
        >
          <IconPencil className="h-4 w-4 text-slate-500" />
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <>
          {hasPrimary ? <div className="my-1 border-t border-[#d7e5e0]" /> : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <IconTrash className="h-4 w-4 text-slate-500" />
            Delete
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        className="rounded-lg p-1.5 text-slate-500 transition-colors duration-150 hover:bg-teal-50 hover:text-teal-800"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }

          if (buttonRef.current) {
            setStyle(getMenuStyle(buttonRef.current));
          }

          setOpen(true);
        }}
      >
        <IconDots className="h-5 w-5" />
      </button>
      {open ? createPortal(menu, document.body) : null}
    </div>
  );
}

export default RowMenu;
