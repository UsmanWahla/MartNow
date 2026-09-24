import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { IconCart, IconShop, IconUser } from "../icons";
import { clearAuth, getUser, isShopperUser } from "../../auth";
import { fetchShopCart, fetchShopMeta, logoutAccount } from "../../api";
import ShopButton from "./ShopButton";
import ShopSearch from "./ShopSearch";

export interface ShopOutlet {
  shopName: string;
  slug: string;
}

function ShopLayout() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState("Shop");
  const [missing, setMissing] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState(getUser);
  const authPage = /\/(login|signup)\/?$/.test(location.pathname);

  useEffect(() => {
    function syncUser() {
      setUser(getUser());
    }

    window.addEventListener("auth-user-changed", syncUser);
    return () => window.removeEventListener("auth-user-changed", syncUser);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const meta = await fetchShopMeta(slug);
        setShopName(meta.shop_name);
        setMissing(false);
      } catch {
        setMissing(true);
      }
    }

    void load();
  }, [slug]);

  useEffect(() => {
    async function loadCart() {
      if (!isShopperUser(user)) {
        setCartCount(0);
        return;
      }

      try {
        const cart = await fetchShopCart(slug);
        setCartCount(cart.items.reduce((sum, item) => sum + Number(item.quantity), 0));
      } catch {
        setCartCount(0);
      }
    }

    void loadCart();
  }, [slug, user, user?.id]);

  async function handleLogout() {
    try {
      await logoutAccount();
    } catch {
      // still clear local session
    }

    clearAuth();
    navigate(`/shop/${slug}`);
  }

  if (missing) {
    return (
      <div className="mesh-bg grid min-h-screen place-items-center p-6 font-sans text-var(--ink)">
        <div className="surface-card max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">Shop not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This storefront link is invalid or the shop has not been published yet.
          </p>
        </div>
      </div>
    );
  }

  const shopper = isShopperUser(user);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `shop-nav ${
      isActive
        ? "bg-teal-50 text-teal-800"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="mesh-bg flex min-h-screen flex-col font-sans text-var(--ink)">
      <header className="sticky top-0 z-20 border-b border-(--hairline) bg-white/90 shadow-[0_8px_24px_rgba(15,118,110,0.06)] backdrop-blur-md">
        <div className="h-1 bg-[linear-gradient(90deg,#0f766e,#2dd4bf,#0f766e)]" />
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[1fr_auto_1fr] sm:px-6">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2 md:col-start-1">
            <Link to={`/shop/${slug}`} className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-700 text-white">
                <IconShop className="h-4 w-4" />
              </div>
              <p className="max-w-7rem truncate text-sm font-semibold text-slate-900 sm:max-w-12rem">
                {shopName}
              </p>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/stores" className={navClass}>
                Stores
              </NavLink>
              <NavLink to={`/shop/${slug}`} end className={navClass}>
                Shop
              </NavLink>
              {shopper ? (
                <NavLink to={`/shop/${slug}/account`} className={navClass}>
                  Account
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 md:col-start-3">
            <Link
              to={`/shop/${slug}/cart`}
              className="relative grid h-10 w-10 place-items-center rounded-xl text-teal-800 hover:bg-teal-50"
              aria-label="Cart"
            >
              <IconCart className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-teal-700 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            {shopper ? (
              <>
                <Link
                  to={`/shop/${slug}/account`}
                  className="grid h-10 w-10 place-items-center rounded-xl text-teal-800 hover:bg-teal-50 md:hidden"
                  aria-label="Account"
                >
                  <IconUser className="h-5 w-5" />
                </Link>
                <ShopButton variant="ghost" size="sm" onClick={() => void handleLogout()}>
                  Logout
                </ShopButton>
              </>
            ) : (
              <Link
                to={`/account/login?next=${encodeURIComponent(`/shop/${slug}`)}`}
                className="shop-btn h-10 bg-teal-700 px-4 text-white hover:bg-teal-800"
              >
                Login
              </Link>
            )}
          </div>

          {authPage ? null : (
            <div className="col-span-2 flex justify-center md:col-span-1 md:col-start-2 md:row-start-1">
              <ShopSearch slug={slug} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5">
        <Outlet context={{ shopName, slug } satisfies ShopOutlet} />
      </main>
    </div>
  );
}

export default ShopLayout;
