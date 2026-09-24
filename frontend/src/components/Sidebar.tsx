import { NavLink } from "react-router-dom";
import {
  IconBox,
  IconDashboard,
  IconLogout,
  IconProfit,
  IconSettings,
  IconStock,
  IconTruck,
  IconUdhaar,
} from "./icons";
import { getUser } from "../auth";
import {
  canManagePeople,
  canManageStock,
  canOpenSettings,
  getRole,
} from "../roles";
import type { ReactNode } from "react";

interface SidebarProps {
  onLogout: () => void;
  onNavigate?: () => void;
}

function Sidebar({ onLogout, onNavigate }: SidebarProps) {
  const user = getUser();
  const role = getRole(user);
  const shopName = user?.shop_name || "Inventory";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
      isActive
        ? "border-l-4 border-l-teal-300 bg-teal-600 text-white shadow-sm"
        : "border-l-4 border-l-transparent text-teal-100/85 hover:bg-white/10 hover:text-white"
    }`;

  const links: { to: string; label: string; icon: ReactNode }[] = [
    { to: "/dashboard", label: "Dashboard", icon: <IconDashboard className="h-4 w-4" /> },
    ...(canManageStock(role)
      ? [{ to: "/products", label: "Products", icon: <IconBox className="h-4 w-4" /> }]
      : []),
    ...(canManageStock(role)
      ? [{ to: "/stock", label: "Stock", icon: <IconStock className="h-4 w-4" /> }]
      : []),
    { to: "/orders", label: "Orders", icon: <IconTruck className="h-4 w-4" /> },
    { to: "/customers", label: "Customers", icon: <IconUdhaar className="h-4 w-4" /> },
    ...(canManagePeople(role)
      ? [{ to: "/suppliers", label: "Suppliers", icon: <IconTruck className="h-4 w-4" /> }]
      : []),
    ...(canManagePeople(role)
      ? [{ to: "/expenses", label: "Expenses", icon: <IconProfit className="h-4 w-4" /> }]
      : []),
    ...(canOpenSettings(role)
      ? [{ to: "/settings", label: "Settings", icon: <IconSettings className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <aside
      className="flex h-full w-60 flex-col p-5 text-white"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600">
          <IconBox className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-wide">{shopName}</h2>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-200/70">
            Ledger
          </p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={linkClass}
            onClick={onNavigate}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-teal-100 transition-colors duration-150 hover:border-red-400/40 hover:bg-white/5 hover:text-red-200"
        onClick={onLogout}
      >
        <IconLogout className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;
