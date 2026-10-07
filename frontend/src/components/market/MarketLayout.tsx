import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { IconShop, IconUser } from "../shared/icons";
import { clearAuth, getUser, isShopperUser } from "../../auth";
import { logoutAccount } from "../../api";
import ShopButton from "../shop/ShopButton";
import ShopSearch from "../shop/ShopSearch";

function MarketLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getUser);
  const shopper = isShopperUser(user);
  const onStoresHome = location.pathname === "/stores" || location.pathname === "/stores/";

  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    window.addEventListener("auth-user-changed", syncUser);
    return () => window.removeEventListener("auth-user-changed", syncUser);
  }, []);

  async function handleLogout() {
    try {
      await logoutAccount();
    } catch {
      // still clear
    }

    clearAuth();
    navigate("/stores");
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `shop-nav px-2.5 ${
      isActive
        ? "bg-teal-50 text-teal-800"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="mesh-bg flex min-h-screen flex-col font-sans text-(--ink)">
      <header className="sticky top-0 z-20 border-b border-(--hairline) bg-white/90 shadow-[0_8px_24px_rgba(15,118,110,0.06)] backdrop-blur-md">
        <div className="h-1 bg-[linear-gradient(90deg,#0f766e,#2dd4bf,#0f766e)]" />
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2 md:col-start-1">
            <Link to="/stores" className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-700 text-white">
                <IconShop className="h-4 w-4" />
              </div>
              <p className="hidden truncate text-sm font-semibold text-slate-900 lg:block">Marketplace</p>
            </Link>
            <nav className="flex items-center gap-1" aria-label="Marketplace navigation">
              <NavLink to="/stores" end className={navClass}>
                Stores
              </NavLink>
              <NavLink to="/account/profile" className={navClass}>
                Account
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 md:col-start-3">
            {shopper ? (
              <>
                <Link to="/account/profile" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-teal-50 hover:text-teal-800">
                  <IconUser className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.name}</span>
                </Link>
                <ShopButton variant="ghost" size="sm" onClick={() => void handleLogout()}>
                  Logout
                </ShopButton>
              </>
            ) : (
              <Link
                to={`/account/login?next=${encodeURIComponent(location.pathname)}`}
                className="shop-btn h-10 bg-teal-700 px-4 text-white hover:bg-teal-800"
              >
                Login
              </Link>
            )}
          </div>

          {onStoresHome ? (
            <div className="col-span-2 flex justify-center md:col-span-1 md:col-start-2 md:row-start-1">
              <ShopSearch basePath="/stores" />
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5">
        <Outlet />
      </main>
    </div>
  );
}

export default MarketLayout;
