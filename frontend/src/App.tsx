import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Routes, Route } from "react-router-dom";

const Layout = lazy(() => import("./components/store-admin/Layout"));
const ShopLayout = lazy(() => import("./components/shop/ShopLayout"));
const SuperLayout = lazy(() => import("./components/super/SuperLayout"));
const MarketLayout = lazy(() => import("./components/market/MarketLayout"));
const CustomerAccountLayout = lazy(() => import("./components/customer/CustomerAccountLayout"));
const Dashboard = lazy(() => import("./pages/store-admin/Dashboard"));
const Products = lazy(() => import("./pages/store-admin/Products"));
const Stock = lazy(() => import("./pages/store-admin/Stock"));
const Orders = lazy(() => import("./pages/store-admin/Orders"));
const Customers = lazy(() => import("./pages/store-admin/Customers"));
const Suppliers = lazy(() => import("./pages/store-admin/Suppliers"));
const Expenses = lazy(() => import("./pages/store-admin/Expenses"));
const Commission = lazy(() => import("./pages/store-admin/Commission"));
const Reports = lazy(() => import("./pages/store-admin/Reports"));
const Settings = lazy(() => import("./pages/store-admin/Settings"));
const Login = lazy(() => import("./pages/store-admin/Login"));
const ShopHome = lazy(() => import("./pages/shop/ShopHome"));
const ShopProduct = lazy(() => import("./pages/shop/ShopProduct"));
const ShopCartPage = lazy(() => import("./pages/shop/ShopCart"));
const ShopCheckout = lazy(() => import("./pages/shop/ShopCheckout"));
const ShopLogin = lazy(() => import("./pages/shop/ShopLogin"));
const ShopSignup = lazy(() => import("./pages/shop/ShopSignup"));
const ShopOrderPage = lazy(() => import("./pages/shop/ShopOrder"));
const SuperLogin = lazy(() => import("./pages/super/SuperLogin"));
const SuperDashboard = lazy(() => import("./pages/super/SuperDashboard"));
const SuperStores = lazy(() => import("./pages/super/SuperStores"));
const SuperStoreTypes = lazy(() => import("./pages/super/SuperStoreTypes"));
const SuperStoreDetail = lazy(() => import("./pages/super/SuperStoreDetail"));
const SuperOrders = lazy(() => import("./pages/super/SuperOrders"));
const SuperDeliveries = lazy(() => import("./pages/super/SuperDeliveries"));
const SuperCommissionLedger = lazy(() => import("./pages/super/SuperCommissionLedger"));
const SuperReports = lazy(() => import("./pages/super/SuperReports"));
const MarketHome = lazy(() => import("./pages/market/MarketHome"));
const CustomerLogin = lazy(() => import("./pages/market/CustomerLogin"));
const CustomerRegister = lazy(() => import("./pages/market/CustomerRegister"));
const CustomerProfile = lazy(() => import("./pages/customer/CustomerProfile"));
const CustomerAddresses = lazy(() => import("./pages/customer/CustomerAddresses"));
const CustomerOrders = lazy(() => import("./pages/customer/CustomerOrders"));
const CustomerOrder = lazy(() => import("./pages/customer/CustomerOrder"));
const CustomerSecurity = lazy(() => import("./pages/customer/CustomerSecurity"));

function RouteFallback() {
  return (
    <div className="mesh-bg grid min-h-screen place-items-center px-4">
      <div className="surface-card rounded-2xl px-5 py-4 text-sm font-semibold text-slate-600">
        Loading...
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mesh-bg grid min-h-screen place-items-center px-4">
      <div className="surface-card max-w-md rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page may have moved or the address is incorrect.</p>
        <Link
          to="/stores"
          className="mt-6 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Go to marketplace
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<Navigate to="/stores" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/register" replace />} />
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/register" element={<CustomerRegister />} />
        <Route path="/super/login" element={<SuperLogin />} />

        <Route path="/stores" element={<MarketLayout />}>
          <Route index element={<MarketHome />} />
        </Route>

        <Route path="/account" element={<MarketLayout />}>
          <Route element={<CustomerAccountLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="addresses" element={<CustomerAddresses />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="orders/:id" element={<CustomerOrder />} />
            <Route path="security" element={<CustomerSecurity />} />
          </Route>
        </Route>

        <Route path="/shop/:slug" element={<ShopLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="product/:id" element={<ShopProduct />} />
          <Route path="cart" element={<ShopCartPage />} />
          <Route path="checkout" element={<ShopCheckout />} />
          <Route path="account" element={<Navigate to="/account/profile" replace />} />
          <Route path="orders/:id" element={<ShopOrderPage />} />
          <Route path="login" element={<ShopLogin />} />
          <Route path="signup" element={<ShopSignup />} />
        </Route>

        <Route path="/super" element={<SuperLayout />}>
          <Route index element={<SuperDashboard />} />
          <Route path="reports" element={<SuperReports />} />
          <Route path="orders" element={<SuperOrders />} />
          <Route path="deliveries" element={<SuperDeliveries />} />
          <Route path="commission-ledger" element={<SuperCommissionLedger />} />
          <Route path="stores" element={<SuperStores />} />
          <Route path="stores/:id" element={<SuperStoreDetail />} />
          <Route path="store-types" element={<SuperStoreTypes />} />
        </Route>

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/sales" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/commission" element={<Commission />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
