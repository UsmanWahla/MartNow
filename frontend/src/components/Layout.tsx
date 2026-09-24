import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Avatar from "./Avatar";
import UserMenu from "./UserMenu";
import ConfirmModal from "./ConfirmModal";
import { IconMenu } from "./icons";
import { clearAuth, getToken, getUser, isCustomerSession, isSuperAdmin } from "../auth";
import { logoutAccount } from "../api";
import useBusy from "../hooks/useBusy";
import {
  canManagePeople,
  canManageStock,
  canOpenSettings,
  getRole,
} from "../roles";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Shop overview" },
  "/products": { title: "Products", subtitle: "Catalog and prices" },
  "/stock": { title: "Stock", subtitle: "In, damage, and on-hand" },
  "/orders": { title: "Orders", subtitle: "Counter sales and online orders" },
  "/customers": { title: "Customers", subtitle: "Udhaar and payments" },
  "/suppliers": { title: "Suppliers", subtitle: "Who you buy from" },
  "/expenses": { title: "Expenses", subtitle: "Shop costs" },
  "/settings": { title: "Settings", subtitle: "Shop, staff, and account" },
};

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getUser);
  const [menuForPath, setMenuForPath] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { busy: loggingOut, run } = useBusy();
  const menuOpen = menuForPath === location.pathname;

  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    window.addEventListener("auth-user-changed", syncUser);

    return () => {
      window.removeEventListener("auth-user-changed", syncUser);
    };
  }, []);

  if (!user || !getToken()) {
    return <Navigate to="/login" replace />;
  }

  const role = getRole(user);

  if (isSuperAdmin(user)) {
    return <Navigate to="/super" replace />;
  }

  if (isCustomerSession() || role === "shopper" || role === "customer") {
    return <Navigate to="/stores" replace />;
  }

  if (location.pathname === "/products" && !canManageStock(role)) {
    return <Navigate to="/orders" replace />;
  }

  if (location.pathname === "/stock" && !canManageStock(role)) {
    return <Navigate to="/orders" replace />;
  }

  if (location.pathname === "/suppliers" && !canManagePeople(role)) {
    return <Navigate to="/orders" replace />;
  }

  if (location.pathname === "/expenses" && !canManagePeople(role)) {
    return <Navigate to="/orders" replace />;
  }

  if (location.pathname === "/settings" && !canOpenSettings(role)) {
    return <Navigate to="/orders" replace />;
  }

  function askLogout() {
    setMenuForPath(null);
    setConfirmLogout(true);
  }

  async function handleLogout() {
    await run(async () => {
      try {
        await logoutAccount();
      } catch {
        // still clear local session
      }

      clearAuth();
      setConfirmLogout(false);
      navigate("/login");
    });
  }

  const meta = pageMeta[location.pathname] ?? {
    title: "Dashboard",
    subtitle: "Shop overview",
  };

  return (
    <div className="mesh-bg flex h-screen overflow-hidden font-sans text-var(--ink)">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar onLogout={askLogout} />
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="anim-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMenuForPath(null)}
          />
          <div className="relative z-50 h-full w-60">
            <Sidebar onLogout={askLogout} onNavigate={() => setMenuForPath(null)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-(--hairline) bg-white/75 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-1 text-teal-800 transition-colors duration-150 hover:bg-teal-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuForPath(location.pathname)}
            >
              <IconMenu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {meta.title}
              </h2>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {meta.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <span className="hidden text-sm font-medium text-slate-600 sm:inline">
              {user?.name ?? ""}
            </span>
            <UserMenu />
          </div>
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

export default Layout;
