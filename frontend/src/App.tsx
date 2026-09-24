import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ShopLayout from "./components/shop/ShopLayout";
import SuperLayout from "./components/super/SuperLayout";
import MarketLayout from "./components/market/MarketLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ShopHome from "./pages/shop/ShopHome";
import ShopProduct from "./pages/shop/ShopProduct";
import ShopCartPage from "./pages/shop/ShopCart";
import ShopCheckout from "./pages/shop/ShopCheckout";
import ShopLogin from "./pages/shop/ShopLogin";
import ShopSignup from "./pages/shop/ShopSignup";
import ShopOrderPage from "./pages/shop/ShopOrder";
import ShopProfile from "./pages/shop/ShopProfile";
import SuperLogin from "./pages/super/SuperLogin";
import SuperDashboard from "./pages/super/SuperDashboard";
import SuperStores from "./pages/super/SuperStores";
import SuperOrders from "./pages/super/SuperOrders";
import SuperDeliveries from "./pages/super/SuperDeliveries";
import MarketHome from "./pages/market/MarketHome";
import CustomerLogin from "./pages/market/CustomerLogin";
import CustomerRegister from "./pages/market/CustomerRegister";

function App() {
  return (
    <BrowserRouter>
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

        <Route path="/shop/:slug" element={<ShopLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="product/:id" element={<ShopProduct />} />
          <Route path="cart" element={<ShopCartPage />} />
          <Route path="checkout" element={<ShopCheckout />} />
          <Route path="account" element={<ShopProfile />} />
          <Route path="orders/:id" element={<ShopOrderPage />} />
          <Route path="login" element={<ShopLogin />} />
          <Route path="signup" element={<ShopSignup />} />
        </Route>

        <Route path="/super" element={<SuperLayout />}>
          <Route index element={<SuperDashboard />} />
          <Route path="orders" element={<SuperOrders />} />
          <Route path="deliveries" element={<SuperDeliveries />} />
          <Route path="stores" element={<SuperStores />} />
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
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
