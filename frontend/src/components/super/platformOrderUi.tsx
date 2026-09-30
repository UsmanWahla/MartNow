import type { ReactNode } from "react";
import Money from "../Money";
import { onlineOrderStatusLabel, type PlatformOrder } from "../../types";
import { formatQuantity } from "../../productUnits";

export type OnlineOrderChannel = {
  delivery_by?: string | null;
  order_kind?: "online" | "walkin";
};

function isWalkIn(order: OnlineOrderChannel | null | undefined) {
  return order?.order_kind === "walkin";
}

function resolveChannel(order: OnlineOrderChannel | null | undefined) {
  if (!order || isWalkIn(order)) {
    return null;
  }

  return String(order.delivery_by || "store").toLowerCase() === "platform" ? "platform" : "store";
}

export function OnlineOrderSourceCell({ order }: { order: OnlineOrderChannel | null | undefined }) {
  if (!order) {
    return <span className="text-slate-300">—</span>;
  }

  if (isWalkIn(order)) {
    return (
      <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
        Walk-in
      </span>
    );
  }

  return (
    <span className="w-fit rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
      Online
    </span>
  );
}

export function OnlineOrderDeliveryCell({ order }: { order: OnlineOrderChannel | null | undefined }) {
  const channel = resolveChannel(order);

  if (!channel) {
    return <span className="text-slate-300">—</span>;
  }

  if (channel === "platform") {
    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
        Platform
      </span>
    );
  }

  return (
    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
      Store
    </span>
  );
}

export function PlatformOrderContact({ order }: { order: PlatformOrder }) {
  return (
    <div>
      <p>
        <span className="font-semibold">{order.customer || "Walk-in customer"}</span>
        {order.email ? <span className="text-slate-500"> · {order.email}</span> : null}
      </p>
      <p className="mt-1 text-slate-600">{order.phone}</p>
      <p className="text-slate-600">
        {order.address}
        {order.city ? `, ${order.city}` : ""}
      </p>
    </div>
  );
}

export function PlatformOrderItems({ order }: { order: PlatformOrder }) {
  return (
    <ul className="divide-y divide-slate-100">
      {(order.items || []).map((item) => (
        <li
          key={`${item.product_id}-${item.product}-${item.color}-${item.size}`}
          className="flex justify-between gap-3 py-2"
        >
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
  );
}

type StatusCardVariant = "order" | "delivery";

export function PlatformOrderStatusCards({
  order,
  variant,
}: {
  order: PlatformOrder;
  variant: StatusCardVariant;
}) {
  const statusNote =
    order.order_kind === "walkin"
      ? "Counter sale · No online checkout"
      : variant === "delivery"
        ? (
            <>
              Platform delivery · Fee <Money value={order.delivery_fee || 0} />
            </>
          )
        : (
            <>
              {order.delivery_by === "platform" ? "Platform delivery" : "Store delivery"}
              {" · "}
              Fee {Number(order.commission_percent)}% · <Money value={order.platform_fee} />
            </>
          );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</p>
        <p className="mt-1 font-semibold text-slate-800">{order.store_name}</p>
        <p className="text-xs text-slate-500">{order.shop_slug}</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
        <p className="mt-1 font-semibold text-slate-800">{onlineOrderStatusLabel(order)}</p>
        <p className="text-xs text-slate-500">{statusNote}</p>
      </div>
    </div>
  );
}

export function PlatformOrderSimpleTotal({ order }: { order: PlatformOrder }) {
  return (
    <div className="flex justify-between border-t border-(--hairline) pt-3 font-semibold">
      <span>Total</span>
      <Money value={order.total_amount} />
    </div>
  );
}

export function PlatformOrderDeliveryTotals({ order }: { order: PlatformOrder }) {
  return (
    <div className="space-y-1 border-t border-(--hairline) pt-3">
      <div className="flex justify-between text-slate-600">
        <span>Store (products)</span>
        <Money value={order.store_amount ?? order.total_amount} />
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Platform delivery</span>
        <Money value={order.platform_delivery ?? order.delivery_fee ?? 0} />
      </div>
      <div className="flex justify-between font-semibold">
        <span>Customer COD</span>
        <Money value={order.payable_amount ?? order.total_amount} />
      </div>
    </div>
  );
}

export function PlatformOrderDetailBody({
  order,
  variant,
  footer,
}: {
  order: PlatformOrder;
  variant: StatusCardVariant;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-4 text-sm">
      <PlatformOrderStatusCards order={order} variant={variant} />
      <PlatformOrderContact order={order} />
      <PlatformOrderItems order={order} />
      {variant === "delivery" ? (
        <PlatformOrderDeliveryTotals order={order} />
      ) : (
        <PlatformOrderSimpleTotal order={order} />
      )}
      {footer}
    </div>
  );
}
