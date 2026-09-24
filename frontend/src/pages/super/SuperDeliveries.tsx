import { useCallback, useState } from "react";
import PagePanel from "../../components/PagePanel";
import TableToolbar from "../../components/TableToolbar";
import Modal from "../../components/Modal";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import RowMenu from "../../components/RowMenu";
import Money from "../../components/Money";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useServerList } from "../../hooks/useServerList";
import { getApiError } from "../../auth";
import {
  fetchPlatformDeliveries,
  fetchPlatformOrder,
  updatePlatformDeliveryStatus,
} from "../../api";
import { type PlatformOrder } from "../../types";
import {
  PlatformOrderDetailBody,
  platformOrderCustomerColumn,
  platformOrderStatusColumn,
  platformOrderStoreColumn,
  platformOrderTimeColumn,
} from "../../components/super/platformOrderUi";

function SuperDeliveries() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [viewing, setViewing] = useState<PlatformOrder | null>(null);
  const [date, setDate] = useState("");
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: orders,
    setRows: setOrders,
    total,
    loading,
  } = useServerList<PlatformOrder>(
    useCallback(
      (q, nextPage) =>
        fetchPlatformDeliveries({
          q,
          page: nextPage,
          date: date || undefined,
        }),
      [date]
    ),
    (error) => showToast(getApiError(error, "Unable to load deliveries")),
    date
  );

  function applyDateFilter(value: string) {
    setDate(value);
    setPage(1);
  }

  function clearDateFilter() {
    setDate("");
    setPage(1);
  }

  async function openView(order: PlatformOrder) {
    try {
      setViewing(await fetchPlatformOrder(order.id));
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load order"));
    }
  }

  async function markDelivered(order: PlatformOrder) {
    await run(async () => {
      try {
        const response = await updatePlatformDeliveryStatus(order.id);
        setOrders((current) =>
          current.map((row) => (row.id === order.id ? { ...row, ...response.order } : row))
        );
        if (viewing?.id === order.id) {
          setViewing(response.order);
        }
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to mark delivered"));
      }
    });
  }

  const columns: DataTableColumn<PlatformOrder>[] = [
    platformOrderTimeColumn(),
    platformOrderStoreColumn(),
    platformOrderCustomerColumn(),
    {
      key: "delivery_fee",
      header: "Del. fee",
      sortable: true,
      sortValue: (order) => Number(order.delivery_fee || 0),
      render: (order) => <Money value={order.delivery_fee || 0} />,
    },
    {
      key: "payable",
      header: "COD",
      sortable: true,
      sortValue: (order) => Number(order.payable_amount ?? order.total_amount),
      render: (order) => <Money value={order.payable_amount ?? order.total_amount} />,
    },
    platformOrderStatusColumn(),
    {
      key: "action",
      header: "Action",
      render: (order) => {
        const extras = [{ label: "View", onClick: () => void openView(order) }];
        const canDeliver = order.delivery_status === "dispatched";

        if (canDeliver) {
          extras.push({
            label: busy ? "Saving..." : "Mark as delivered",
            onClick: () => void markDelivered(order),
          });
        }

        return <RowMenu extras={extras} />;
      },
    },
  ];

  const filtersActive = Boolean(date);

  const deliveryFooter =
    viewing?.delivery_status === "dispatched" ? (
      <button
        type="button"
        className="h-11 w-full rounded-xl bg-teal-700 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
        disabled={busy}
        onClick={() => void markDelivered(viewing)}
      >
        {busy ? "Saving..." : "Mark as delivered"}
      </button>
    ) : viewing &&
      viewing.delivery_status !== "delivered" &&
      viewing.delivery_status !== "cancelled" ? (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
        Waiting for shop admin to mark this order as dispatched.
      </p>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <PagePanel
        title={<TableToolbar search={search} onSearch={setSearch} count={total} />}
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-11rem">
            <p className="mb-1.5 text-sm font-medium text-slate-600">Date</p>
            <input
              type="date"
              className="field-input"
              value={date}
              onChange={(event) => applyDateFilter(event.target.value)}
            />
          </div>
          {filtersActive ? (
            <button
              type="button"
              className="h-42px rounded-xl px-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
              onClick={clearDateFilter}
            >
              Clear filter
            </button>
          ) : null}
        </div>
        <DataTable
          rows={orders}
          columns={columns}
          rowKey={(order) => order.id}
          filterKey={`${search}|${date}`}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search && !filtersActive
              ? "No platform deliveries yet."
              : "No matching deliveries."
          }
        />
      </PagePanel>

      {viewing ? (
        <Modal title={`Delivery #${viewing.id}`} wide onClose={() => setViewing(null)}>
          <PlatformOrderDetailBody
            order={viewing}
            variant="delivery"
            footer={deliveryFooter}
          />
        </Modal>
      ) : null}
    </div>
  );
}

export default SuperDeliveries;
