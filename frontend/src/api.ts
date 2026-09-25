import axios from "axios";
import { API_URL, authHeader } from "./auth";
import type { Paged } from "./hooks/useServerList";
import {
  buildProductLedger,
  type AdminOrder,
  type Customer,
  type DashboardPeriod,
  type DashboardStats,
  type Expense,
  type Product,
  type ProductLedger,
  type Sale,
  type ShopCart,
  type ShopOrder,
  type ShopSettings,
  type StaffMember,
  type StockMovement,
  type Supplier,
  type PlatformStats,
  type PlatformStore,
  type PlatformOrder,
  type PublicStore,
} from "./types";

export interface ListQuery {
  q?: string;
  page?: number;
  limit?: number;
  all?: boolean;
  product_id?: number;
  store_id?: number;
  date?: string;
  date_from?: string;
  date_to?: string;
  delivery_by?: "store" | "platform";
}

function listParams(options?: ListQuery) {
  if (!options || options.all) {
    return {
      all: 1,
      ...(options?.q ? { q: options.q } : {}),
      ...(options?.product_id ? { product_id: options.product_id } : {}),
      ...(options?.store_id ? { store_id: options.store_id } : {}),
      ...(options?.date ? { date: options.date } : {}),
      ...(options?.date_from ? { date_from: options.date_from } : {}),
      ...(options?.date_to ? { date_to: options.date_to } : {}),
      ...(options?.delivery_by ? { delivery_by: options.delivery_by } : {}),
    };
  }

  return {
    ...(options.q ? { q: options.q } : {}),
    ...(options.product_id ? { product_id: options.product_id } : {}),
    ...(options.store_id ? { store_id: options.store_id } : {}),
    ...(options.date ? { date: options.date } : {}),
    ...(options.date_from ? { date_from: options.date_from } : {}),
    ...(options.date_to ? { date_to: options.date_to } : {}),
    ...(options.delivery_by ? { delivery_by: options.delivery_by } : {}),
    page: options.page ?? 1,
    limit: options.limit ?? 5,
  };
}

function unwrapList<T>(data: Paged<T> | T[]): Paged<T> {
  if (Array.isArray(data)) {
    return { rows: data, total: data.length };
  }

  return { rows: data.rows ?? [], total: Number(data.total) || 0 };
}

async function fetchList<T>(path: string, options?: ListQuery) {
  const response = await axios.get<Paged<T> | T[]>(`${API_URL}${path}`, {
    headers: authHeader(),
    params: listParams(options ?? { all: true }),
  });
  return unwrapList<T>(response.data);
}

export async function fetchProducts(options?: ListQuery) {
  return fetchList<Product>("/api/products", options);
}

export async function createProduct(payload: {
  name: string;
  sku?: string;
  price: number;
  cost_price: number;
  stock: number;
  description?: string;
  images?: File[];
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  variants?: { color: string; size: string; stock: number }[];
}) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("sku", payload.sku || "");
  form.append("price", String(payload.price));
  form.append("cost_price", String(payload.cost_price));
  form.append("stock", String(payload.stock));
  form.append("description", payload.description || "");
  form.append("colors", JSON.stringify(payload.colors || []));
  form.append("sizes", JSON.stringify(payload.sizes || []));
  form.append("variants", JSON.stringify(payload.variants || []));

  for (const image of payload.images || []) {
    form.append("images", image);
  }

  const response = await axios.post<{ message: string; product: Product }>(
    `${API_URL}/api/products`,
    form,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveProduct(
  id: number,
  payload: {
    name: string;
    sku?: string;
    price: number;
    cost_price: number;
    description?: string;
    images?: File[];
    colors?: { name: string; hex: string }[];
    sizes?: string[];
    keep_image_ids?: number[];
    keep_image_paths?: string[];
  }
) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("sku", payload.sku || "");
  form.append("price", String(payload.price));
  form.append("cost_price", String(payload.cost_price));
  form.append("description", payload.description || "");

  if (payload.colors) {
    form.append("colors", JSON.stringify(payload.colors));
  }

  if (payload.sizes) {
    form.append("sizes", JSON.stringify(payload.sizes));
  }

  if (payload.keep_image_ids !== undefined) {
    form.append("keep_image_ids", JSON.stringify(payload.keep_image_ids));
  }

  if (payload.keep_image_paths !== undefined) {
    form.append("keep_image_paths", JSON.stringify(payload.keep_image_paths));
  }

  for (const image of payload.images || []) {
    form.append("images", image);
  }

  const response = await axios.put<{ message: string; product: Product }>(
    `${API_URL}/api/products/${id}`,
    form,
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeProduct(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/products/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchProductLedger(product: Product) {
  const response = await axios.get<ProductLedger | StockMovement[] | { rows: StockMovement[]; total: number }>(
    `${API_URL}/api/stock`,
    {
      headers: authHeader(),
      params: { all: 1, product_id: product.id, ledger: 1 },
    }
  );
  const data = response.data;

  if (
    data &&
    !Array.isArray(data) &&
    "product" in data &&
    "totalIn" in data &&
    "rows" in data
  ) {
    return data;
  }

  const movements = Array.isArray(data) ? data : data.rows ?? [];
  return buildProductLedger(product, movements);
}

export async function fetchSales(options?: ListQuery) {
  return fetchList<Sale>("/api/sales", options);
}

export async function createSale(payload: {
  items: { product_id: number; quantity: number }[];
  customer_id?: number | null;
  paid_amount?: number;
}) {
  const response = await axios.post<{
    message: string;
    sale: Sale;
    product?: Product;
    products?: Product[];
  }>(`${API_URL}/api/sales`, payload, { headers: authHeader() });
  return response.data;
}

export async function saveSale(
  id: number,
  payload: {
    items?: { product_id: number; quantity: number }[];
    customer_id?: number | null;
    paid_amount?: number;
    created_at?: string;
  }
) {
  const response = await axios.put<{
    message: string;
    sale: Sale;
    product?: Product;
    products?: Product[];
    previous_product?: Product;
  }>(`${API_URL}/api/sales/${id}`, payload, { headers: authHeader() });
  return response.data;
}

export async function removeSale(id: number) {
  const response = await axios.delete<{
    message: string;
    product?: Product;
    products?: Product[];
  }>(`${API_URL}/api/sales/${id}`, { headers: authHeader() });
  return response.data;
}

export async function fetchDashboard(period: DashboardPeriod = "month") {
  const response = await axios.get<DashboardStats>(`${API_URL}/api/dashboard`, {
    headers: authHeader(),
    params: { period },
  });
  return response.data;
}

export async function fetchStock(options?: ListQuery) {
  return fetchList<StockMovement>("/api/stock", options);
}

export async function createStockMovement(payload: {
  product_id: number;
  type: "in" | "damage" | "adjust";
  quantity: number;
  note?: string;
  supplier_id?: number;
  color?: string;
  size?: string;
}) {
  const response = await axios.post<{ message: string; product: Product }>(
    `${API_URL}/api/stock`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveStockMovement(
  id: number,
  payload: {
    product_id: number;
    type: "in" | "damage" | "adjust";
    quantity: number;
    note?: string;
    supplier_id?: number;
    color?: string;
    size?: string;
  }
) {
  const response = await axios.put<{
    message: string;
    product: Product;
    movement: StockMovement;
  }>(`${API_URL}/api/stock/${id}`, payload, { headers: authHeader() });
  return response.data;
}

export async function removeStockMovement(id: number) {
  const response = await axios.delete<{ message: string; product: Product }>(
    `${API_URL}/api/stock/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchStaff() {
  const response = await axios.get<StaffMember[]>(`${API_URL}/api/staff`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function createStaff(payload: {
  name: string;
  email: string;
  password: string;
  role: "manager" | "cashier";
}) {
  const response = await axios.post<{ message: string; user: StaffMember }>(
    `${API_URL}/api/staff`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeStaff(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/staff/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchCustomers(options?: ListQuery) {
  return fetchList<Customer>("/api/customers", options);
}

export async function createCustomer(payload: { name: string; phone?: string }) {
  const response = await axios.post<{ message: string; customer: Customer }>(
    `${API_URL}/api/customers`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveCustomer(
  id: number,
  payload: { name: string; phone?: string }
) {
  const response = await axios.put<{ message: string; customer: Customer }>(
    `${API_URL}/api/customers/${id}`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function payCustomer(id: number, amount: number) {
  const response = await axios.post<{ message: string; customer: Customer }>(
    `${API_URL}/api/customers/${id}/pay`,
    { amount },
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeCustomer(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/customers/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchSuppliers(options?: ListQuery) {
  return fetchList<Supplier>("/api/suppliers", options);
}

export async function createSupplier(payload: { name: string; phone?: string }) {
  const response = await axios.post<{ message: string; supplier: Supplier }>(
    `${API_URL}/api/suppliers`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveSupplier(
  id: number,
  payload: { name: string; phone?: string }
) {
  const response = await axios.put<{ message: string; supplier: Supplier }>(
    `${API_URL}/api/suppliers/${id}`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeSupplier(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/suppliers/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchExpenses(options?: ListQuery) {
  return fetchList<Expense>("/api/expenses", options);
}

export async function createExpense(payload: {
  amount: number;
  note?: string;
  created_at?: string;
}) {
  const response = await axios.post<{ message: string; expense: Expense }>(
    `${API_URL}/api/expenses`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveExpense(
  id: number,
  payload: { amount: number; note?: string }
) {
  const response = await axios.put<{ message: string; expense: Expense }>(
    `${API_URL}/api/expenses/${id}`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeExpense(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/expenses/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchSettings() {
  const response = await axios.get<ShopSettings>(`${API_URL}/api/settings`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function saveSettings(payload: ShopSettings) {
  const response = await axios.put<{
    message: string;
    settings: ShopSettings;
    user?: import("./auth").User;
  }>(`${API_URL}/api/settings`, payload, { headers: authHeader() });
  return response.data;
}

export async function saveProfile(payload: { name: string }) {
  const response = await axios.put<{
    message: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/profile`, payload, { headers: authHeader() });
  return response.data;
}

export async function savePassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const response = await axios.put<{ message: string }>(
    `${API_URL}/api/profile/password`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function loginAccount(payload: { username: string; password: string }) {
  const response = await axios.post<{
    message: string;
    token?: string;
    refreshToken?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/login`, payload);
  return response.data;
}

export async function loginSuperAccount(payload: { email: string; password: string }) {
  const response = await axios.post<{
    message: string;
    token?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/super/login`, payload);
  return response.data;
}

export async function loginCustomerAccount(payload: { email: string; password: string }) {
  const response = await axios.post<{
    message: string;
    token?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/customer/login`, payload);
  return response.data;
}

export async function signupCustomerAccount(payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const response = await axios.post<{
    message: string;
    token?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/customer/signup`, payload);
  return response.data;
}

export async function fetchPublicStores() {
  const response = await axios.get<{ rows: PublicStore[] }>(`${API_URL}/api/stores/public`);
  return response.data;
}

export async function fetchPlatformStats(period: DashboardPeriod = "month") {
  const response = await axios.get<PlatformStats>(`${API_URL}/api/super/dashboard`, {
    headers: authHeader(),
    params: { period },
  });
  return response.data;
}

export async function fetchPlatformStores(options?: ListQuery) {
  return fetchList<PlatformStore>("/api/super/stores", options);
}

export async function fetchPlatformOrders(options?: ListQuery) {
  return fetchList<PlatformOrder>("/api/super/orders", options);
}

export async function fetchPlatformDeliveries(options?: ListQuery) {
  return fetchList<PlatformOrder>("/api/super/deliveries", options);
}

export async function fetchPlatformOrder(
  id: number,
  kind: import("./types").PlatformOrderKind = "online"
) {
  const response = await axios.get<PlatformOrder>(`${API_URL}/api/super/orders/${id}`, {
    headers: authHeader(),
    params: kind === "walkin" ? { kind: "walkin" } : undefined,
  });
  return response.data;
}

export async function updatePlatformDeliveryStatus(id: number) {
  const response = await axios.patch<{ message: string; order: PlatformOrder }>(
    `${API_URL}/api/super/orders/${id}/status`,
    { delivery_status: "delivered" },
    { headers: authHeader() }
  );
  return response.data;
}

function storeForm(payload: {
  name: string;
  address: string;
  latitude?: string;
  longitude?: string;
  contact_name: string;
  contact_phone: string;
  username: string;
  password?: string;
  shop_slug?: string;
  delivery_enabled: boolean;
  commission_percent: number;
  logo?: File | null;
}) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("address", payload.address);
  form.append("latitude", payload.latitude || "");
  form.append("longitude", payload.longitude || "");
  form.append("contact_name", payload.contact_name);
  form.append("contact_phone", payload.contact_phone);
  form.append("username", payload.username);
  form.append("shop_slug", payload.shop_slug || "");
  form.append("delivery_enabled", payload.delivery_enabled ? "1" : "0");
  form.append("commission_percent", String(payload.commission_percent));

  if (payload.password) {
    form.append("password", payload.password);
  }

  if (payload.logo) {
    form.append("logo", payload.logo);
  }

  return form;
}

export async function createPlatformStore(payload: Parameters<typeof storeForm>[0]) {
  const response = await axios.post<{ message: string; store: PlatformStore }>(
    `${API_URL}/api/super/stores`,
    storeForm(payload),
    { headers: authHeader() }
  );
  return response.data;
}

export async function savePlatformStore(
  id: number,
  payload: Parameters<typeof storeForm>[0]
) {
  const response = await axios.put<{ message: string; store: PlatformStore }>(
    `${API_URL}/api/super/stores/${id}`,
    storeForm(payload),
    { headers: authHeader() }
  );
  return response.data;
}

export async function removePlatformStore(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/super/stores/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function deletePlatformStore(id: number) {
  const response = await axios.delete<{ message: string }>(
    `${API_URL}/api/super/stores/${id}`,
    { headers: authHeader(), params: { permanent: "1" } }
  );
  return response.data;
}

export async function logoutAccount() {
  const response = await axios.post<{ message: string }>(`${API_URL}/api/logout`, {});
  return response.data;
}

export function productImageUrl(path?: string | null) {
  if (!path) {
    return "";
  }

  if (path.startsWith("http")) {
    return path;
  }

  return `${API_URL}${path}`;
}

export async function fetchShopMeta(slug: string) {
  const response = await axios.get<{
    shop_name: string;
    shop_slug: string;
    address?: string;
    logo_path?: string | null;
    delivery_enabled?: boolean;
    platform_delivery_fee?: number;
  }>(`${API_URL}/api/shop/${slug}`);
  return response.data;
}

export async function fetchShopProducts(slug: string, options?: ListQuery) {
  const response = await axios.get<{
    shop_name: string;
    shop_slug: string;
    rows: Product[];
    total: number;
  }>(`${API_URL}/api/shop/${slug}/products`, {
    params: listParams(options ?? { all: true }),
  });
  return response.data;
}

export async function fetchShopProduct(slug: string, id: number) {
  const response = await axios.get<{
    shop_name: string;
    shop_slug: string;
    product: Product;
  }>(`${API_URL}/api/shop/${slug}/products/${id}`);
  return response.data;
}

export async function shopSignup(
  slug: string,
  payload: { name: string; email: string; password: string; phone?: string }
) {
  const response = await axios.post<{
    message: string;
    token?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/shop/${slug}/signup`, payload);
  return response.data;
}

export async function shopLogin(
  slug: string,
  payload: { email: string; password: string }
) {
  const response = await axios.post<{
    message: string;
    token?: string;
    user: import("./auth").User;
  }>(`${API_URL}/api/shop/${slug}/login`, payload);
  return response.data;
}

export async function fetchShopCart(slug: string) {
  const response = await axios.get<ShopCart>(`${API_URL}/api/shop/${slug}/cart`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function addShopCartItem(
  slug: string,
  payload: { product_id: number; quantity: number; color?: string; size?: string }
) {
  const response = await axios.post<ShopCart>(
    `${API_URL}/api/shop/${slug}/cart`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function saveShopCartItem(
  slug: string,
  itemId: number,
  quantity: number
) {
  const response = await axios.put<ShopCart>(
    `${API_URL}/api/shop/${slug}/cart/${itemId}`,
    { quantity },
    { headers: authHeader() }
  );
  return response.data;
}

export async function removeShopCartItem(slug: string, itemId: number) {
  const response = await axios.delete<ShopCart>(
    `${API_URL}/api/shop/${slug}/cart/${itemId}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchCheckoutProfile(slug: string) {
  const response = await axios.get<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  }>(`${API_URL}/api/shop/${slug}/checkout/profile`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function fetchShopProfile(slug: string) {
  const response = await axios.get<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  }>(`${API_URL}/api/shop/${slug}/profile`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function saveShopProfile(
  slug: string,
  payload: { name: string; phone: string; address: string; city: string }
) {
  const response = await axios.put<{
    message: string;
    user?: import("./auth").User;
    profile?: {
      name: string;
      email: string;
      phone: string;
      address: string;
      city: string;
    };
  }>(`${API_URL}/api/shop/${slug}/profile`, payload, {
    headers: authHeader(),
  });
  return response.data;
}

export async function saveShopPassword(
  slug: string,
  payload: { currentPassword: string; newPassword: string }
) {
  const response = await axios.put<{ message: string }>(
    `${API_URL}/api/shop/${slug}/profile/password`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchShopOrders(slug: string) {
  const response = await axios.get<{ rows: ShopOrder[] }>(
    `${API_URL}/api/shop/${slug}/orders`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function placeShopOrder(
  slug: string,
  payload: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    payment_method: "cod";
    delivery_by: "store" | "platform";
  }
) {
  const response = await axios.post<ShopOrder>(
    `${API_URL}/api/shop/${slug}/checkout`,
    payload,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchShopOrder(slug: string, id: number) {
  const response = await axios.get<ShopOrder>(
    `${API_URL}/api/shop/${slug}/orders/${id}`,
    { headers: authHeader() }
  );
  return response.data;
}

export async function fetchOrders(options?: ListQuery) {
  return fetchList<AdminOrder>("/api/orders", options);
}

export async function fetchOrder(id: number) {
  const response = await axios.get<AdminOrder>(`${API_URL}/api/orders/${id}`, {
    headers: authHeader(),
  });
  return response.data;
}

export async function collectOrder(id: number) {
  const response = await axios.post<{ message: string; order: AdminOrder }>(
    `${API_URL}/api/orders/${id}/collect`,
    {},
    { headers: authHeader() }
  );
  return response.data;
}

export async function updateOrderStatus(
  id: number,
  delivery_status: "pending" | "processing" | "dispatched" | "delivered" | "cancelled"
) {
  const response = await axios.put<{ message: string; order: AdminOrder }>(
    `${API_URL}/api/orders/${id}/status`,
    { delivery_status },
    { headers: authHeader() }
  );
  return response.data;
}
