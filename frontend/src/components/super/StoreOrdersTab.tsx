import { useCallback, useState } from "react";
import { getApiError } from "../../auth";
import { fetchPlatformOrder, fetchPlatformOrders } from "../../api";
import { useServerList } from "../../hooks/useServerList";
import { useToast } from "../../hooks/useToast";
import { formatOrderNumber, type PlatformOrder } from "../../types";
import DataTable, { type DataTableColumn } from "../shared/DataTable";
import DatePicker from "../shared/DatePicker";
import Modal from "../shared/Modal";
import Money from "../shared/Money";
import PagePanel from "../shared/PagePanel";
import RowMenu from "../shared/RowMenu";
import TableToolbar from "../shared/TableToolbar";
import {
  onlineOrderDeliveryColumn,
  onlineOrderSourceColumn,
  platformOrderCustomerColumn,
  platformOrderStatusColumn,
  platformOrderTimeColumn,
} from "./platformOrderColumns";
import { PlatformOrderDetailBody } from "./platformOrderUi";

function StoreOrdersTab({ storeId }: { storeId: number }) {
  const { showToast } = useToast();
  const [viewing, setViewing] = useState<PlatformOrder | null>(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: orders,
    total,
    loading,
  } = useServerList<PlatformOrder>(
    useCallback(
      (q, nextPage) =>
        fetchPlatformOrders({
          q,
          page: nextPage,
          store_id: storeId,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }),
      [storeId, dateRange.from, dateRange.to]
    ),
    (error) => showToast(getApiError(error, "Unable to load store orders")),
    `${storeId}|${dateRange.from}|${dateRange.to}`
  );

  async function openOrder(order: PlatformOrder) {
    try {
      const kind = order.order_kind === "walkin" ? "walkin" : "online";
      setViewing(await fetchPlatformOrder(order.id, kind));
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load order"));
    }
  }

  function applyDateFilter(range: { from: string; to: string }) {
    setDateRange(range);
    setPage(1);
  }

  const columns: DataTableColumn<PlatformOrder>[] = [
    {
      key: "order_id",
      header: "Order ID",
      sortable: true,
      sortValue: (order) => order.sale_id ?? 0,
      render: (order) => formatOrderNumber(order.sale_id),
    },
    platformOrderTimeColumn(),
    platformOrderCustomerColumn(),
    onlineOrderSourceColumn((order) => order),
    onlineOrderDeliveryColumn((order) => order),
    {
      key: "total",
      header: "Total",
      sortable: true,
      sortValue: (order) => Number(order.total_amount),
      render: (order) => <Money value={order.total_amount} />,
    },
    {
      key: "fee",
      header: "Fee",
      sortable: true,
      sortValue: (order) => Number(order.platform_fee),
      render: (order) =>
        order.order_kind === "walkin" ? (
          <span className="text-slate-300">—</span>
        ) : (
          <Money value={order.platform_fee} />
        ),
    },
    platformOrderStatusColumn(),
    {
      key: "action",
      header: "Action",
      render: (order) => (
        <RowMenu extras={[{ label: "View", onClick: () => void openOrder(order) }]} />
      ),
    },
  ];

  const filterActive = Boolean(dateRange.from && dateRange.to);

  return (
    <>
      <PagePanel>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-11rem">
              <p className="mb-1.5 text-sm font-medium text-slate-600">Date</p>
              <DatePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={applyDateFilter}
                ariaLabel="Filter this store's orders by date"
              />
            </div>
            {filterActive ? (
              <button
                type="button"
                className="h-42px rounded-xl px-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
                onClick={() => applyDateFilter({ from: "", to: "" })}
              >
                Clear date
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TableToolbar search={search} onSearch={setSearch} count={total} />
          </div>
        </div>
        <DataTable
          rows={orders}
          columns={columns}
          rowKey={(order) => `${order.order_kind || "online"}-${order.id}`}
          filterKey={`${search}|${dateRange.from}|${dateRange.to}`}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search && !filterActive
              ? "No orders for this store yet."
              : "No matching orders."
          }
        />
      </PagePanel>

      {viewing ? (
        <Modal
          title={
            viewing.order_kind === "walkin"
              ? `Walk-in sale #${viewing.id}`
              : `Order #${viewing.id}`
          }
          wide
          onClose={() => setViewing(null)}
        >
          <PlatformOrderDetailBody order={viewing} variant="order" />
        </Modal>
      ) : null}
    </>
  );
}

export default StoreOrdersTab;
