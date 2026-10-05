import { Link } from "react-router-dom";
import Money from "../Money";
import type { ShopOrder } from "../../types";
import { formatOrderNumber, onlineOrderStatusLabel } from "../../types";
import { formatQuantity } from "../../productUnits";
import ShopOrderTimeline from "./ShopOrderTimeline";

interface ShopOrderDetailsProps {
  order: ShopOrder;
  title?: string;
  primaryLink: string;
  primaryLabel: string;
  secondaryLink: string;
  secondaryLabel: string;
}

function ShopOrderDetails({
  order,
  title = "Order details",
  primaryLink,
  primaryLabel,
  secondaryLink,
  secondaryLabel,
}: ShopOrderDetailsProps) {
  const hasCoordinates = order.latitude != null && order.longitude != null;

  return (
    <div className="shop-card p-5 sm:p-8">
      <p className="text-sm font-semibold text-teal-700">
        {order.shop_name || "Store"} · Order #{formatOrderNumber(order.id)}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Status: <span className="font-semibold text-teal-800">{onlineOrderStatusLabel(order)}</span>
        {order.delivery_status === "delivered" || order.payment_status === "collected"
          ? ". Payment received on delivery."
          : ". Pay cash when the parcel arrives."}
      </p>
      <ShopOrderTimeline deliveryStatus={order.delivery_status} />

      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{order.customer || "Delivery"}</p>
            <p>{order.address}</p>
            <p>{order.city}</p>
            <p className="mt-1">{order.phone}</p>
            <p>{order.email}</p>
          </div>
          {hasCoordinates ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
            >
              Open map
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-xs font-medium text-teal-800">
          {order.delivery_by === "platform"
            ? "Delivered by platform"
            : `Delivered by ${order.shop_name || "store"}`}
        </p>
      </div>

      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {(order.items || []).map((item, index) => (
          <li key={`${item.product_id}-${item.color || ""}-${item.size || ""}-${index}`} className="flex justify-between gap-3 py-2.5">
            <span>
              {item.product}
              {item.color || item.size
                ? ` · ${[item.color, item.size].filter(Boolean).join(" / ")}`
                : ""}{" "}
              × {formatQuantity(item.quantity)} {item.sale_unit || "piece"}
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
        <Link to={primaryLink} className="shop-btn bg-teal-700 text-white hover:bg-teal-800">
          {primaryLabel}
        </Link>
        <Link to={secondaryLink} className="shop-btn border border-(--hairline) bg-white text-slate-700">
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}

export default ShopOrderDetails;
