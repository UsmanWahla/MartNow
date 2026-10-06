import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Money from "../../components/shared/Money";
import Pagination from "../../components/shared/Pagination";
import { IconShop, IconTruck } from "../../components/shared/icons";
import {
  fetchCustomerOrders,
  productImageUrl,
  type CustomerOrderStatus,
} from "../../api";
import { getApiError } from "../../auth";
import { useToast } from "../../hooks/useToast";
import type { ShopOrder } from "../../types";
import { formatOrderNumber, onlineOrderStatusLabel, orderStatusTone } from "../../types";

const PAGE_SIZE = 8;
const filters: { value: CustomerOrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function CustomerOrders() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CustomerOrderStatus>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const result = await fetchCustomerOrders({ page, limit: PAGE_SIZE, status });
        if (active) {
          setOrders(result.rows);
          setTotal(result.total);
        }
      } catch (error) {
        if (active) showToast(getApiError(error, "Unable to load orders"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [page, status, showToast]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My orders</h1>
        <p className="mt-1 text-sm text-slate-500">Orders from every store, together in one place.</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              status === filter.value
                ? "bg-teal-700 text-white"
                : "border border-(--hairline) bg-white text-slate-600 hover:bg-teal-50"
            }`}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="surface-card rounded-2xl p-8 text-center">
          <IconTruck className="mx-auto h-9 w-9 text-teal-700" />
          <h2 className="mt-3 font-semibold text-slate-900">No orders found</h2>
          <p className="mt-1 text-sm text-slate-500">Orders you place at any store will appear here.</p>
          <Link to="/stores" className="shop-btn mt-4 bg-teal-700 text-white hover:bg-teal-800">Browse stores</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="surface-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-teal-50 text-teal-800">
                  {order.logo_path ? (
                    <img src={productImageUrl(order.logo_path)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <IconShop className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="truncate font-semibold text-slate-900">{order.shop_name || "Store"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Order #{formatOrderNumber(order.id)} · {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusTone(onlineOrderStatusLabel(order))}`}>
                      {onlineOrderStatusLabel(order)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs text-slate-500">Total</p>
                      <Money value={order.payable_amount ?? order.total_amount} className="font-semibold text-slate-900" />
                    </div>
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </section>
  );
}

export default CustomerOrders;
