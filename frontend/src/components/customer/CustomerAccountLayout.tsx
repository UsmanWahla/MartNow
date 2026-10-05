import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { getUser, getUserInitials, isShopperSession } from "../../auth";
import { IconChevronLeft, IconLock, IconMapPin, IconTruck, IconUser } from "../icons";

const links = [
  { to: "/account/profile", label: "Profile", icon: IconUser },
  { to: "/account/addresses", label: "Addresses", icon: IconMapPin },
  { to: "/account/orders", label: "My orders", icon: IconTruck },
  { to: "/account/security", label: "Password", icon: IconLock },
];

function CustomerAccountLayout() {
  const location = useLocation();
  const user = getUser();

  if (!isShopperSession()) {
    return (
      <Navigate
        to={`/account/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
        replace
      />
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? "bg-teal-700 text-white shadow-sm"
        : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
    }`;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/stores"
          aria-label="Back to stores"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-(--hairline) bg-white text-teal-800 shadow-sm hover:bg-teal-50"
        >
          <IconChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">My account</h1>
          <p className="text-xs text-slate-500">Profile, addresses, orders and security</p>
        </div>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="surface-card overflow-hidden rounded-2xl md:sticky md:top-24">
        <div className="hidden border-b border-(--hairline) p-5 md:block">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-sm font-bold text-white">
            {getUserInitials(user)}
          </div>
          <p className="mt-3 truncate font-semibold text-slate-900">{user?.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3" aria-label="Customer account">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default CustomerAccountLayout;
