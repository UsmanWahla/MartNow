import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import RowMenu from "../components/RowMenu";
import PagePanel from "../components/PagePanel";
import DatePicker from "../components/DatePicker";
import AddButton from "../components/AddButton";
import Field from "../components/Field";
import TableToolbar from "../components/TableToolbar";
import ModalActions from "../components/ModalActions";
import Select from "../components/Select";
import SaleLines, { type SaleLine } from "../components/SaleLines";
import ReceiptModal from "../components/ReceiptModal";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import Money from "../components/Money";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import useOpenAddFromQuery from "../hooks/useOpenAddFromQuery";
import { useServerList } from "../hooks/useServerList";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError, getUser } from "../auth";
import { canEditSales, getRole } from "../roles";
import {
  createCustomer,
  createSale,
  fetchCustomers,
  fetchOrder,
  fetchOrders,
  fetchProducts,
  fetchSales,
  fetchSettings,
  removeSale,
  saveSale,
  updateOrderStatus,
} from "../api";
import {
  upsertById,
  onlineOrderStatusLabel,
  orderStatusTone,
  type AdminOrder,
  type Customer,
  type Product,
  type Sale,
} from "../types";
import { collectFieldErrors, requiredMessage } from "../utils/formValidate";
import {
  onlineOrderDeliveryColumn,
  onlineOrderSourceColumn,
} from "../components/super/platformOrderUi";

const emptyLine: SaleLine = { productId: "", quantity: "1" };

function Orders() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { showAdd, setShowAdd } = useOpenAddFromQuery();
  const canEdit = canEditSales(getRole(getUser()));
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shopName, setShopName] = useState(getUser()?.shop_name || "Inventory");
  const [lines, setLines] = useState<SaleLine[]>([emptyLine]);
  const [customerId, setCustomerId] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [paidAmount, setPaidAmount] = useState("");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sale | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [onlineOrders, setOnlineOrders] = useState<AdminOrder[]>([]);
  const [viewing, setViewing] = useState<AdminOrder | null>(null);
  const [pendingCancel, setPendingCancel] = useState<AdminOrder | null>(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: sales,
    setRows: setSales,
    total,
    loading,
  } = useServerList<Sale>(
    useCallback(
      (q, nextPage) =>
        fetchSales({
          q,
          page: nextPage,
          date_from: dateRange.from || undefined,
          date_to: dateRange.to || undefined,
        }),
      [dateRange.from, dateRange.to]
    ),
    (error) => showToast(getApiError(error, "Unable to load orders")),
    `${dateRange.from}|${dateRange.to}`
  );

  useEffect(() => {
    async function loadLookups() {
      try {
        const [nextProducts, nextCustomers, settings, orders] = await Promise.all([
          fetchProducts({ all: true }),
          fetchCustomers({ all: true }),
          fetchSettings(),
          fetchOrders({ all: true }),
        ]);
        setProducts(nextProducts.rows);
        setCustomers(nextCustomers.rows);
        setShopName(settings.shop_name || "Inventory");
        setOnlineOrders(orders.rows);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load orders"));
      }
    }

    void loadLookups();
  }, [showToast]);

  function applyDateFilter(range: { from: string; to: string }) {
    setDateRange(range);
    setPage(1);
  }

  function clearDateFilter() {
    setDateRange({ from: "", to: "" });
    setPage(1);
  }

  const orderBySaleId = useMemo(() => {
    const map = new Map<number, AdminOrder>();

    for (const order of onlineOrders) {
      if (order.sale_id) {
        map.set(order.sale_id, order);
      }
    }

    return map;
  }, [onlineOrders]);

  function applyProducts(nextProducts?: Product[]) {
    (nextProducts || []).forEach((product) => {
      setProducts((current) => upsertById(current, product));
    });
  }

  function closeModals() {
    setShowAdd(false);
    setEditingSale(null);
    setLines([emptyLine]);
    setCustomerId("");
    setAddingCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setPaidAmount("");
    clearAll();
  }

  function openAdd() {
    clearAll();
    setLines([emptyLine]);
    setCustomerId("");
    setAddingCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setPaidAmount("");
    setShowAdd(true);
  }

  function openEdit(sale: Sale) {
    clearAll();
    setEditingSale(sale);
    setLines(
      (sale.items || []).map((item) => ({
        productId: String(item.product_id),
        quantity: String(item.quantity),
        color: item.color || "",
        size: item.size || "",
      }))
    );
    setCustomerId(sale.customer_id ? String(sale.customer_id) : "");
    setAddingCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setPaidAmount(String(sale.paid_amount ?? sale.total_amount));
  }

  async function resolveCustomerId() {
    if (!addingCustomer) {
      return customerId ? Number(customerId) : null;
    }

    const name = newCustomer.name.trim();

    if (!name) {
      throw new Error("Customer name is required");
    }

    const response = await createCustomer({
      name,
      phone: newCustomer.phone,
    });
    setCustomers((current) => upsertById(current, response.customer));
    return response.customer.id;
  }

  function payload(nextCustomerId: number | null) {
    return {
      items: lines
        .filter((line) => line.productId)
        .map((line) => ({
          product_id: Number(line.productId),
          quantity: Number(line.quantity),
          color: line.color || "",
          size: line.size || "",
        })),
      customer_id: nextCustomerId,
      paid_amount: paidAmount === "" ? undefined : Number(paidAmount),
    };
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors = collectFieldErrors([
      [
        "lines",
        lines.some((line) => line.productId)
          ? ""
          : "Please add at least one product",
      ],
      [
        "customerName",
        addingCustomer
          ? requiredMessage(newCustomer.name, "Please enter the customer name")
          : "",
      ],
    ]);

    if (!report(nextErrors, showToast)) {
      return;
    }

    await run(async () => {
      try {
        const nextCustomerId = await resolveCustomerId();
        const response = await createSale(payload(nextCustomerId));
        setSales((current) => upsertById(current, response.sale));
        applyProducts(response.products);
        showToast(response.message, "success");
        closeModals();
      } catch (loadError) {
        showToast(
          loadError instanceof Error && loadError.message === "Customer name is required"
            ? loadError.message
            : getApiError(loadError, "Unable to add sale")
        );
      }
    });
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editingSale) {
      return;
    }

    const nextErrors = collectFieldErrors([
      [
        "lines",
        lines.some((line) => line.productId)
          ? ""
          : "Please add at least one product",
      ],
      [
        "customerName",
        addingCustomer
          ? requiredMessage(newCustomer.name, "Please enter the customer name")
          : "",
      ],
    ]);

    if (!report(nextErrors, showToast)) {
      return;
    }

    await run(async () => {
      try {
        const nextCustomerId = await resolveCustomerId();
        const response = await saveSale(editingSale.id, payload(nextCustomerId));
        setSales((current) => upsertById(current, response.sale));
        applyProducts(response.products);
        showToast(response.message, "success");
        closeModals();
      } catch (loadError) {
        showToast(
          loadError instanceof Error && loadError.message === "Customer name is required"
            ? loadError.message
            : getApiError(loadError, "Unable to update sale")
        );
      }
    });
  }

  async function deleteSale(sale: Sale) {
    await run(async () => {
      try {
        const response = await removeSale(sale.id);
        setSales((current) => current.filter((row) => row.id !== sale.id));
        applyProducts(response.products);
        setOnlineOrders((current) => current.filter((order) => order.sale_id !== sale.id));
        setPendingDelete(null);
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to delete sale"));
      }
    });
  }

  async function openView(order: AdminOrder) {
    try {
      setViewing(await fetchOrder(order.id));
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load order"));
    }
  }

  async function refreshSaleRow(saleId: number | null | undefined) {
    if (!saleId) {
      return;
    }

    try {
      const salesList = await fetchSales({ all: true });
      const updated = salesList.rows.find((row) => row.id === saleId);

      if (updated) {
        setSales((current) => upsertById(current, updated));
      }
    } catch {
      // keep current row
    }
  }

  async function markStatus(
    order: AdminOrder,
    delivery_status: "processing" | "dispatched" | "delivered" | "cancelled"
  ) {
    await run(async () => {
      try {
        const response = await updateOrderStatus(order.id, delivery_status);
        setOnlineOrders((current) => upsertById(current, response.order));
        if (viewing?.id === order.id) {
          setViewing(response.order);
        }
        if (delivery_status === "cancelled" && order.sale_id) {
          setSales((current) => current.filter((row) => row.id !== order.sale_id));
        } else if (delivery_status === "delivered") {
          await refreshSaleRow(response.order.sale_id);
        }
        setPendingCancel(null);
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update order"));
      }
    });
  }

  function statusDisplay(order: AdminOrder | undefined) {
    if (!order || order.delivery_status === "cancelled") {
      return null;
    }

    const label = onlineOrderStatusLabel(order);
    return { label, tone: orderStatusTone(label) };
  }

  const columns: DataTableColumn<Sale>[] = [
    {
      key: "product",
      header: "Items",
      sortable: true,
      sortValue: (sale) => sale.product,
    },
    {
      key: "quantity",
      header: "Qty",
      sortable: true,
      sortValue: (sale) => Number(sale.quantity),
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (sale) => sale.customer || "",
      render: (sale) => sale.customer || "Walk-in",
    },
    onlineOrderSourceColumn((sale) => {
      const order = orderBySaleId.get(sale.id);
      return order || { order_kind: "walkin" };
    }),
    onlineOrderDeliveryColumn((sale) => orderBySaleId.get(sale.id)),
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (sale) => statusDisplay(orderBySaleId.get(sale.id))?.label || "",
      render: (sale) => {
        const status = statusDisplay(orderBySaleId.get(sale.id));

        if (!status) {
          return <span className="text-slate-300">—</span>;
        }

        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${status.tone}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (sale) => Number(sale.total_amount),
      render: (sale) => <Money value={sale.total_amount} />,
    },
    {
      key: "due",
      header: "Udhaar",
      sortable: true,
      sortValue: (sale) => Number(sale.due_amount),
      render: (sale) =>
        Number(sale.due_amount) > 0 ? <Money value={sale.due_amount || 0} /> : "—",
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (sale) => new Date(sale.created_at).getTime(),
      render: (sale) => new Date(sale.created_at).toLocaleDateString(),
    },
    {
      key: "action",
      header: "Action",
      render: (sale) => {
        const order = orderBySaleId.get(sale.id);

        return (
          <RowMenu
            extras={[
              { label: "Print", onClick: () => setReceipt(sale) },
              ...(order
                ? [
                    { label: "View online", onClick: () => void openView(order) },
                    ...(order.delivery_status === "pending"
                      ? [
                          {
                            label: "Processing",
                            onClick: () => void markStatus(order, "processing"),
                          },
                        ]
                      : []),
                    ...(order.delivery_status === "processing"
                      ? [
                          {
                            label: "Mark dispatched",
                            onClick: () => void markStatus(order, "dispatched"),
                          },
                        ]
                      : []),
                    ...(order.delivery_status === "dispatched" &&
                    order.delivery_by !== "platform"
                      ? [
                          {
                            label: "Mark delivered",
                            onClick: () => void markStatus(order, "delivered"),
                          },
                        ]
                      : []),
                    ...(order.delivery_status !== "cancelled" &&
                    order.delivery_status !== "delivered"
                      ? [{ label: "Cancel", onClick: () => setPendingCancel(order) }]
                      : []),
                  ]
                : []),
            ]}
            onEdit={canEdit && !order ? () => openEdit(sale) : undefined}
            onDelete={canEdit && !order ? () => setPendingDelete(sale) : undefined}
          />
        );
      },
    },
  ];

  const saleForm = (
    <>
      <SaleLines
        products={products}
        lines={lines}
        onChange={(next) => {
          setLines(next);
          clearError("lines");
        }}
      />
      {errors.lines ? <p className="field-error-text">{errors.lines}</p> : null}
      <Select
        value={addingCustomer ? "__new__" : customerId}
        onChange={(value) => {
          if (value === "__new__") {
            setAddingCustomer(true);
            setCustomerId("");
            return;
          }

          setAddingCustomer(false);
          setNewCustomer({ name: "", phone: "" });
          setCustomerId(value);
        }}
      >
        <option value="">Walk-in customer</option>
        <option value="__new__">+ New customer</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </Select>
      {addingCustomer ? (
        <>
          <Field
            placeholder="Customer name"
            value={newCustomer.name}
            error={errors.customerName}
            onChange={(name) => {
              setNewCustomer({ ...newCustomer, name });
              clearError("customerName");
            }}
          />
          <Field
            placeholder="Phone (optional)"
            value={newCustomer.phone}
            onChange={(phone) => setNewCustomer({ ...newCustomer, phone })}
          />
        </>
      ) : null}
      <Field
        type="number"
        placeholder="Paid now (blank = full)"
        min="0"
        step="0.01"
        value={paidAmount}
        onChange={setPaidAmount}
      />
    </>
  );

  const filtersActive = Boolean(dateRange.from && dateRange.to);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <PagePanel
        title={<TableToolbar search={search} onSearch={setSearch} count={total} />}
        actions={<AddButton onClick={openAdd} />}
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-11rem">
            <p className="mb-1.5 text-sm font-medium text-slate-600">Date</p>
            <DatePicker
              from={dateRange.from}
              to={dateRange.to}
              onChange={applyDateFilter}
              ariaLabel="Filter store orders by date"
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
          rows={sales}
          columns={columns}
          rowKey={(sale) => sale.id}
          filterKey={`${search}|${dateRange.from}|${dateRange.to}`}
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

      {showAdd ? (
        <Modal title="Add Sale" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleAdd}>
            {saleForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {editingSale ? (
        <Modal title="Edit Sale" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleEdit}>
            {saleForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete Sale"
          message={`Delete sale #${pendingDelete.id}?`}
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void deleteSale(pendingDelete)}
        />
      ) : null}

      {receipt ? (
        <ReceiptModal
          sale={receipt}
          shopName={shopName}
          onClose={() => setReceipt(null)}
        />
      ) : null}

      {viewing ? (
        <Modal title={`Order #${viewing.id}`} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">{viewing.customer}</span>
              <span className="text-slate-500"> · {viewing.email}</span>
            </p>
            <p className="text-slate-600">{viewing.phone}</p>
            <p className="text-slate-600">
              {viewing.address}, {viewing.city}
            </p>
            <p className="text-slate-600">
              Online ·{" "}
              {viewing.delivery_by === "platform" ? "Platform delivery" : "Store delivery"} ·{" "}
              {onlineOrderStatusLabel(viewing)}
              {viewing.delivery_status === "cancelled"
                ? ""
                : viewing.delivery_status === "delivered" ||
                    viewing.payment_status === "collected"
                  ? ""
                  : " · COD"}
            </p>
            {viewing.delivery_by === "platform" &&
            Number(viewing.delivery_fee || 0) > 0 ? (
              <p className="text-xs text-slate-500">
                Product to store · Delivery fee{" "}
                <Money value={viewing.delivery_fee || 0} /> to platform
              </p>
            ) : null}
            <ul className="divide-y divide-slate-100">
              {(viewing.items || []).map((item) => (
                <li key={`${item.product_id}-${item.product}`} className="flex justify-between py-2">
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
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <Money value={viewing.total_amount} />
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingCancel ? (
        <ConfirmModal
          title="Cancel order"
          message="Cancel this order and return stock?"
          loading={busy}
          onCancel={() => setPendingCancel(null)}
          onConfirm={() => void markStatus(pendingCancel, "cancelled")}
        />
      ) : null}
    </div>
  );
}

export default Orders;
