import type { Role } from "./auth";

export type { Role };

export interface ProductImage {
  id: number;
  path: string;
}

export interface ProductColor {
  id?: number;
  name: string;
  hex: string;
}

export interface ProductSize {
  id?: number;
  name: string;
}

export interface ProductVariant {
  color: string;
  size: string;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  price: number | string;
  cost_price?: number | string;
  stock: number;
  image_path?: string | null;
  description?: string | null;
  images?: ProductImage[];
  colors?: ProductColor[];
  sizes?: ProductSize[];
  variants?: ProductVariant[];
}

export interface SaleItem {
  id?: number;
  product_id: number;
  product: string;
  quantity: number;
  unit_price: number | string;
  unit_cost?: number | string;
  total_amount: number | string;
  cost_amount?: number | string;
  color?: string | null;
  size?: string | null;
}

export interface Sale {
  id: number;
  product_id: number;
  product: string;
  quantity: number;
  customer_id?: number | null;
  customer?: string | null;
  unit_price?: number | string;
  unit_cost?: number | string;
  total_amount: number | string;
  cost_amount?: number | string;
  paid_amount?: number | string;
  due_amount?: number | string;
  items?: SaleItem[];
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product: string;
  supplier_id?: number | null;
  supplier?: string | null;
  type: string;
  quantity: number;
  note: string | null;
  color?: string | null;
  size?: string | null;
  created_at: string;
}

export interface ProductLedgerEntry {
  id: number;
  type: string;
  quantity: number;
  inbound: number;
  outbound: number;
  balance: number;
  note: string | null;
  supplier?: string | null;
  color?: string | null;
  size?: string | null;
  created_at: string;
}

export interface ProductLedger {
  product: Product;
  totalIn: number;
  totalOut: number;
  rows: ProductLedgerEntry[];
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  balance: number | string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
}

export interface Expense {
  id: number;
  amount: number | string;
  note?: string | null;
  created_at: string;
}

export interface ShopSettings {
  shop_name: string;
  shop_slug?: string;
  low_stock_threshold: number;
  address?: string;
  logo_path?: string | null;
  delivery_enabled?: boolean;
  commission_percent?: number;
}

export interface PublicStore {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  logo_path: string | null;
  delivery_enabled: boolean;
  shop_slug: string;
}

export interface PlatformStore extends PublicStore {
  tenant_user_id: number;
  contact_name: string;
  contact_phone: string;
  username: string;
  commission_percent: number;
  status: string;
  created_at: string;
  orders?: number;
  revenue?: number | string;
  commission?: number | string;
}

export interface PlatformStats {
  period: string;
  totalStores: number;
  activeStores: number;
  customers: number;
  orders: number;
  revenue: number | string;
  commission: number | string;
  deliveryFees?: number | string;
  deliveryOrders?: number;
  platformEarnings?: number | string;
  topStores: {
    id: number;
    name: string;
    shop_slug: string;
    orders: number;
    revenue: number | string;
    commission: number | string;
  }[];
}

export type PlatformOrderKind = "online" | "walkin";

export interface PlatformOrder {
  order_kind?: PlatformOrderKind;
  id: number;
  sale_id?: number | null;
  store_id: number;
  store_name: string;
  shop_slug: string;
  customer_id?: number;
  customer?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  delivery_by?: "store" | "platform" | string;
  delivery_fee?: number | string;
  store_amount?: number | string;
  platform_delivery?: number | string;
  commission_percent: number;
  platform_fee: number | string;
  total_amount: number | string;
  payable_amount?: number | string;
  paid_amount?: number | string;
  due_amount?: number | string;
  created_at: string;
  items?: {
    product_id: number;
    product: string;
    quantity: number;
    unit_price?: number | string;
    total_amount: number | string;
    color?: string;
    size?: string;
  }[];
}

export interface LowStockItem {
  id: number;
  name: string;
  stock: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  billed: number;
  collected: number;
  revenue: number;
  cost: number;
  udhaar: number;
  expenses: number;
  profit: number;
  netProfit: number;
  totalSales: number;
  debtors: { id: number; name: string; balance: number }[];
  lowStockCount: number;
  lowStock: LowStockItem[];
  missingCostCount: number;
  missingCost: { id: number; name: string }[];
  shopName: string;
  lowStockThreshold: number;
  pendingOnlineOrders?: number;
  period: DashboardPeriod;
}

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at?: string;
}

export type DashboardPeriod = "today" | "week" | "month" | "all";

export interface ShopCartItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  price: number | string;
  stock: number;
  image_path?: string | null;
  color?: string;
  size?: string;
  line_total: number | string;
}

export interface ShopCart {
  items: ShopCartItem[];
  total: number | string;
  shop_name?: string;
}

export interface ShopOrder {
  id: number;
  shop_name?: string;
  shop_slug?: string;
  email: string;
  phone?: string | null;
  address: string;
  city: string;
  customer?: string;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  delivery_by?: "store" | "platform" | string;
  delivery_fee?: number | string;
  total_amount: number | string;
  payable_amount?: number | string;
  paid_amount?: number | string;
  due_amount?: number | string;
  created_at: string;
  items?: {
    product_id: number;
    product: string;
    quantity: number;
    unit_price: number | string;
    total_amount: number | string;
    color?: string;
    size?: string;
  }[];
}

export interface AdminOrder extends ShopOrder {
  sale_id?: number | null;
  customer_id?: number;
}

export function formatMoney(value: number | string) {
  return `PKR ${Number(value).toFixed(2)}`;
}

/** Online shop order pipeline label for admin + customer UI. */
export function onlineOrderStatusLabel(order: {
  delivery_status?: string | null;
  payment_status?: string | null;
}) {
  const delivery = String(order.delivery_status || "").toLowerCase();
  const payment = String(order.payment_status || "").toLowerCase();

  if (delivery === "cancelled") {
    return "Cancelled";
  }

  if (delivery === "delivered" || payment === "collected") {
    return "Paid";
  }

  if (delivery === "processing") {
    return "Processing";
  }

  if (delivery === "dispatched") {
    return "Dispatched";
  }

  return "Pending";
}

export function orderStatusTone(label: string) {
  if (label === "Paid") {
    return "bg-emerald-50 text-emerald-800";
  }

  if (label === "Processing") {
    return "bg-sky-50 text-sky-800";
  }

  if (label === "Dispatched") {
    return "bg-amber-50 text-amber-800";
  }

  if (label === "Cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

export function formatCardMoney(value: number | string) {
  const amount = Number(value);
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    return `PKR ${(amount / 1_000_000).toFixed(2)}M`;
  }

  if (abs >= 10_000) {
    return `PKR ${(amount / 1_000).toFixed(1)}k`;
  }

  return formatMoney(amount);
}

export function upsertById<T extends { id: number }>(items: T[], item?: T | null) {
  if (!item) {
    return items;
  }

  const exists = items.some((row) => row.id === item.id);
  return exists
    ? items.map((row) => (row.id === item.id ? item : row))
    : [item, ...items];
}

function movementDirection(type: string) {
  if (type === "opening" || type === "in" || type === "sale_return") {
    return 1;
  }

  if (type === "sale" || type === "damage" || type === "adjust") {
    return -1;
  }

  return 0;
}

export function buildProductLedger(
  product: Product,
  movements: StockMovement[]
): ProductLedger {
  let balance = 0;
  let totalIn = 0;
  let totalOut = 0;
  const rows = movements
    .filter((row) => row.product_id === product.id)
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((row) => {
      const quantity = Number(row.quantity);
      const direction = movementDirection(row.type);
      const inbound = direction > 0 ? quantity : 0;
      const outbound = direction < 0 ? quantity : 0;
      balance += direction * quantity;
      totalIn += inbound;
      totalOut += outbound;

      return {
        id: row.id,
        type: row.type,
        quantity,
        inbound,
        outbound,
        balance,
        note: row.note,
        supplier: row.supplier,
        color: row.color,
        size: row.size,
        created_at: row.created_at,
      };
    });

  return { product, totalIn, totalOut, rows };
}
