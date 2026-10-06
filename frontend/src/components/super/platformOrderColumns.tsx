import type { DataTableColumn } from "../shared/DataTable";
import {
  onlineOrderStatusLabel,
  orderStatusTone,
  type PlatformOrder,
} from "../../types";
import {
  OnlineOrderDeliveryCell,
  OnlineOrderSourceCell,
  type OnlineOrderChannel,
} from "./platformOrderUi";

function isWalkIn(order: OnlineOrderChannel | null | undefined) {
  return order?.order_kind === "walkin";
}

function resolveChannel(order: OnlineOrderChannel | null | undefined) {
  if (!order || isWalkIn(order)) {
    return null;
  }

  return String(order.delivery_by || "store").toLowerCase() === "platform" ? "platform" : "store";
}

export function onlineOrderSourceColumn<T>(
  resolve: (row: T) => OnlineOrderChannel | null | undefined
): DataTableColumn<T> {
  return {
    key: "source",
    header: "Source",
    sortable: true,
    sortValue: (row) => {
      const order = resolve(row);
      return order ? (isWalkIn(order) ? "Walk-in" : "Online") : "";
    },
    render: (row) => <OnlineOrderSourceCell order={resolve(row)} />,
  };
}

export function onlineOrderDeliveryColumn<T>(
  resolve: (row: T) => OnlineOrderChannel | null | undefined
): DataTableColumn<T> {
  return {
    key: "delivery",
    header: "Delivery",
    sortable: true,
    sortValue: (row) => resolveChannel(resolve(row)) || "",
    render: (row) => <OnlineOrderDeliveryCell order={resolve(row)} />,
  };
}

export function formatPlatformOrderTime(createdAt: string) {
  return new Date(createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function platformOrderTimeColumn(): DataTableColumn<PlatformOrder> {
  return {
    key: "created_at",
    header: "Time",
    sortable: true,
    sortValue: (order) => order.created_at,
    render: (order) => formatPlatformOrderTime(order.created_at),
  };
}

export function platformOrderStoreColumn(): DataTableColumn<PlatformOrder> {
  return {
    key: "store",
    header: "Store",
    sortable: true,
    sortValue: (order) => order.store_name,
    render: (order) => <p className="truncate font-medium text-slate-800">{order.store_name}</p>,
  };
}

export function platformOrderCustomerColumn(): DataTableColumn<PlatformOrder> {
  return {
    key: "customer",
    header: "Customer",
    sortable: true,
    sortValue: (order) => order.customer || "",
    render: (order) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{order.customer}</p>
        <p className="truncate text-xs text-slate-500">{order.city}</p>
      </div>
    ),
  };
}

export function platformOrderStatusColumn(): DataTableColumn<PlatformOrder> {
  return {
    key: "status",
    header: "Status",
    sortable: true,
    sortValue: (order) =>
      order.order_kind === "walkin" ? "In-store" : onlineOrderStatusLabel(order),
    render: (order) => {
      if (order.order_kind === "walkin") {
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            In-store
          </span>
        );
      }

      const label = onlineOrderStatusLabel(order);

      return (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${orderStatusTone(label)}`}
        >
          {label}
        </span>
      );
    },
  };
}
