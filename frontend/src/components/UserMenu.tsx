import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDots } from "./icons";
import { getUser } from "../auth";
import { canManageCatalog, canOpenSettings, getRole } from "../roles";

function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const role = getRole(getUser());

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="rounded-lg p-1 text-slate-600 transition-colors duration-150 hover:bg-slate-100"
        aria-label="Shortcuts"
        onClick={() => setOpen((current) => !current)}
      >
        <IconDots className="h-5 w-5" />
      </button>

      {open ? (
        <div className="anim-menu surface-card absolute right-0 top-9 z-30 w-44 rounded-xl py-1">
          {canOpenSettings(role) ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50"
              onClick={() => go("/settings")}
            >
              Profile
            </button>
          ) : null}
          {canManageCatalog(role) ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50"
              onClick={() => go("/products?add=1")}
            >
              Add Product
            </button>
          ) : null}
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50"
              onClick={() => go("/orders?add=1")}
            >
              Add Sale
            </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;
