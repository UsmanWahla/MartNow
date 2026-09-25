import { useCallback, useEffect, useState } from "react";
import PagePanel from "../../components/PagePanel";
import TableToolbar from "../../components/TableToolbar";
import Modal from "../../components/Modal";
import Select from "../../components/Select";
import DatePicker from "../../components/DatePicker";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import RowMenu from "../../components/RowMenu";
import Money from "../../components/Money";
import { useToast } from "../../hooks/useToast";
import { useServerList } from "../../hooks/useServerList";
import { getApiError } from "../../auth";
import {
  fetchPlatformOrder,
  fetchPlatformOrders,
  fetchPlatformStores,
} from "../../api";
import { formatOrderNumber, type PlatformOrder, type PlatformStore } from "../../types";
import {
  PlatformOrderDetailBody,
  onlineOrderDeliveryColumn,
  onlineOrderSourceColumn,
  platformOrderCustomerColumn,
  platformOrderStatusColumn,
  platformOrderStoreColumn,
  platformOrderTimeColumn,
} from "../../components/super/platformOrderUi";

function SuperOrders() {
  const { showToast } = useToast();
  const [viewing, setViewing] = useState<PlatformOrder | null>(null);
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [storeId, setStoreId] = useState("");
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
          store_id: storeId ? Number(storeId) : undefined,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }),
      [storeId, dateRange.from, dateRange.to]
    ),
    (error) => showToast(getApiError(error, "Unable to load orders")),
    `${storeId}|${dateRange.from}|${dateRange.to}`
  );

  useEffect(() => {
    async function loadStores() {
      try {
        const data = await fetchPlatformStores({ all: true });
        setStores(data.rows);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load stores"));
      }
    }

    void loadStores();
  }, [showToast]);

  function applyStoreFilter(value: string) {
    setStoreId(value);
    setPage(1);
  }

  function applyDateFilter(range: { from: string; to: string }) {
    setDateRange(range);
    setPage(1);
  }

  function clearFilters() {
    setStoreId("");
    setDateRange({ from: "", to: "" });
    setPage(1);
  }

  async function openView(order: PlatformOrder) {
    try {
      const kind = order.order_kind === "walkin" ? "walkin" : "online";
      setViewing(await fetchPlatformOrder(order.id, kind));
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load order"));
    }
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
    platformOrderStoreColumn(),
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
        <RowMenu extras={[{ label: "View", onClick: () => void openView(order) }]} />
      ),
    },
  ];

  const filtersActive = Boolean(storeId || (dateRange.from && dateRange.to));

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <PagePanel
        title={<TableToolbar search={search} onSearch={setSearch} count={total} />}
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-12rem flex-1 sm:max-w-xs">
            <p className="mb-1.5 text-sm font-medium text-slate-600">Store</p>
            <Select value={storeId} onChange={applyStoreFilter}>
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-11rem">
            <p className="mb-1.5 text-sm font-medium text-slate-600">Date</p>
            <DatePicker
              from={dateRange.from}
              to={dateRange.to}
              onChange={applyDateFilter}
              ariaLabel="Filter platform orders by date"
            />
          </div>
          {filtersActive ? (
            <button
              type="button"
              className="h-42px rounded-xl px-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <DataTable
          rows={orders}
          columns={columns}
          rowKey={(order) => `${order.order_kind || "online"}-${order.id}`}
          filterKey={`${search}|${storeId}|${dateRange.from}|${dateRange.to}`}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search && !filtersActive
              ? "No orders yet."
              : "No matching orders."
          }
        />
      </PagePanel>

      {viewing ? (
        <Modal
          title={
            viewing.order_kind === "walkin" ? `Walk-in sale #${viewing.id}` : `Order #${viewing.id}`
          }
          wide
          onClose={() => setViewing(null)}
        >
          <PlatformOrderDetailBody order={viewing} variant="order" />
        </Modal>
      ) : null}
    </div>
  );
}

export default SuperOrders;
