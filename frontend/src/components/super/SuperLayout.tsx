import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { IconDashboard, IconLogout, IconShop, IconMenu, IconTruck, IconBox } from "../icons";
import ConfirmModal from "../ConfirmModal";
import { clearAuth, getToken, getUser, isSuperAdmin } from "../../auth";
import { logoutAccount } from "../../api";
import useBusy from "../../hooks/useBusy";

function SuperLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { busy: loggingOut, run } = useBusy();

  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    window.addEventListener("auth-user-changed", syncUser);
    return () => window.removeEventListener("auth-user-changed", syncUser);
  }, []);

  if (!user || !getToken()) {
    return <Navigate to="/super/login" replace />;
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/login" replace />;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
      isActive
        ? "border-l-4 border-l-teal-300 bg-teal-600 text-white shadow-sm"
        : "border-l-4 border-l-transparent text-teal-100/85 hover:bg-white/10 hover:text-white"
    }`;

  async function handleLogout() {
    await run(async () => {
      try {
        await logoutAccount();
      } catch {
        // still clear
      }

      clearAuth();
      setConfirmLogout(false);
      navigate("/super/login");
    });
  }

  const title = location.pathname.startsWith("/super/stores")
    ? "Stores"
    : location.pathname.startsWith("/super/deliveries")
      ? "Deliveries"
      : location.pathname.startsWith("/super/orders")
        ? "Orders"
        : "Dashboard";

  const nav = (
    <aside className="flex h-full w-60 flex-col p-5 text-white" style={{ background: "var(--sidebar)" }}>
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600">
          <IconShop className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-wide">Platform</h2>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-200/70">
            Super admin
          </p>
        </div>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <NavLink to="/super" end className={linkClass} onClick={() => setMenuOpen(false)}>
          <IconDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>
        <NavLink to="/super/orders" className={linkClass} onClick={() => setMenuOpen(false)}>
          <IconTruck className="h-4 w-4" />
          Orders
        </NavLink>
        <NavLink to="/super/deliveries" className={linkClass} onClick={() => setMenuOpen(false)}>
          <IconBox className="h-4 w-4" />
          Deliveries
        </NavLink>
        <NavLink to="/super/stores" className={linkClass} onClick={() => setMenuOpen(false)}>
          <IconShop className="h-4 w-4" />
          Stores
        </NavLink>
      </nav>
      <button
        type="button"
        className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-teal-100 transition-colors duration-150 hover:border-red-400/40 hover:bg-white/5 hover:text-red-200"
        onClick={() => setConfirmLogout(true)}
      >
        <IconLogout className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );

  return (
    <div className="mesh-bg flex h-screen overflow-hidden font-sans text-var(--ink)">
      <div className="hidden h-full shrink-0 md:block">{nav}</div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="anim-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 h-full w-60">{nav}</div>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-(--hairline) bg-white/75 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-1 text-teal-800 transition-colors duration-150 hover:bg-teal-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu className="h-6 w-6" />
            </button>
            <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <span className="hidden text-sm font-medium text-slate-600 sm:inline">Super Admin</span>
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-8 md:px-6 md:pb-10">
          <div className="mx-auto h-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      {confirmLogout ? (
        <ConfirmModal
          title="Logout"
          message="Are you sure want to logout?"
          confirmLabel="Yes"
          loading={loggingOut}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => void handleLogout()}
        />
      ) : null}
    </div>
  );
}

export default SuperLayout;
