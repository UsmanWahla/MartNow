import { Link, useOutletContext, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Money from "../../components/Money";
import { fetchShopOrder } from "../../api";
import { getApiError } from "../../auth";
import type { ShopOrder } from "../../types";
import { onlineOrderStatusLabel } from "../../types";
import type { ShopOutlet } from "../../components/shop/ShopLayout";

function ShopOrderPage() {
  const { slug = "", id = "" } = useParams();
  const { shopName } = useOutletContext<ShopOutlet>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrder(await fetchShopOrder(slug, Number(id)));
      } catch (loadError) {
        setError(getApiError(loadError, "Order not found"));
      }
    }

    void load();
  }, [slug, id]);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!order) {
    return <p className="text-sm text-slate-500">Loading order...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl shop-card p-6 sm:p-8">
      <p className="text-sm font-semibold text-teal-700">
        {shopName} · Order #{order.id}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Thank you</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Status: <span className="font-semibold text-teal-800">{onlineOrderStatusLabel(order)}</span>
        {order.delivery_status === "delivered" || order.payment_status === "collected"
          ? ". Payment received on delivery."
          : ". Pay cash when the parcel arrives."}
      </p>
      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <p className="font-semibold">{order.customer || "Delivery"}</p>
        <p>{order.address}</p>
        <p>{order.city}</p>
        <p className="mt-1">{order.phone}</p>
        <p>{order.email}</p>
        <p className="mt-2 text-xs font-medium text-teal-800">
          {order.delivery_by === "platform"
            ? "Delivered by platform"
            : `Delivered by ${order.shop_name || shopName}`}
        </p>
      </div>
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {(order.items || []).map((item) => (
          <li key={`${item.product_id}-${item.product}`} className="flex justify-between gap-3 py-2.5">
            <span>
              {item.product}
              {item.color || item.size
                ? ` · ${[item.color, item.size].filter(Boolean).join(" / ")}`
                : ""}{" "}
              × {item.quantity}
            </span>
            <Money value={item.total_amount} />
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 border-t border-(--hairline) pt-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <Money value={order.total_amount} />
        </div>
        {Number(order.delivery_fee || 0) > 0 ? (
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <Money value={order.delivery_fee || 0} />
          </div>
        ) : null}
        <div className="flex justify-between font-semibold">
          <span>Total (COD)</span>
          <Money value={order.payable_amount ?? order.total_amount} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={`/shop/${slug}`} className="shop-btn bg-teal-700 text-white hover:bg-teal-800">
          Continue shopping
        </Link>
        <Link to={`/shop/${slug}/account`} className="shop-btn border border-(--hairline) bg-white text-slate-700">
          View account
        </Link>
      </div>
    </div>
  );
}

export default ShopOrderPage;
