import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import PagePanel from "../components/PagePanel";
import AddButton from "../components/AddButton";
import Field from "../components/Field";
import TableToolbar from "../components/TableToolbar";
import ModalActions from "../components/ModalActions";
import ProductSelect from "../components/ProductSelect";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import RowMenu from "../components/RowMenu";
import NoteCell from "../components/NoteCell";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import { useServerList } from "../hooks/useServerList";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError } from "../auth";
import {
  createStockMovement,
  fetchProducts,
  fetchStock,
  fetchSuppliers,
  removeStockMovement,
  saveStockMovement,
} from "../api";
import { upsertById, type Product, type StockMovement, type Supplier } from "../types";
import Select from "../components/Select";
import VariantPickers from "../components/VariantPickers";
import { collectFieldErrors, requiredMessage } from "../utils/formValidate";

type StockMode = "in" | "damage" | "adjust";

const emptyForm = { productId: "", quantity: "", note: "", color: "", size: "" };

const TYPE_LABELS: Record<string, string> = {
  opening: "Opening",
  in: "Stock in",
  sale: "Sale",
  sale_return: "Sale return",
  damage: "Damage",
  adjust: "Adjust out",
};

const TYPE_TONES: Record<string, string> = {
  opening: "bg-slate-100 text-slate-700",
  in: "bg-teal-50 text-teal-800",
  sale: "bg-sky-50 text-sky-800",
  sale_return: "bg-emerald-50 text-emerald-800",
  damage: "bg-amber-50 text-amber-800",
  adjust: "bg-rose-50 text-rose-800",
};

const INBOUND = new Set(["opening", "in", "sale_return"]);

function isEditableType(type: string): type is StockMode {
  return type === "in" || type === "damage" || type === "adjust";
}

function Stock() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<StockMode | null>(null);
  const [editing, setEditing] = useState<StockMovement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StockMovement | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: movements,
    total,
    loading,
    reload,
  } = useServerList<StockMovement>(
    (q, nextPage) => fetchStock({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load stock"))
  );

  useEffect(() => {
    async function loadLookups() {
      try {
        const [nextProducts, nextSuppliers] = await Promise.all([
          fetchProducts({ all: true }),
          fetchSuppliers({ all: true }),
        ]);
        setProducts(nextProducts.rows);
        setSuppliers(nextSuppliers.rows);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load stock"));
      }
    }

    void loadLookups();
  }, [showToast]);

  function closeModal() {
    setMode(null);
    setEditing(null);
    setForm(emptyForm);
    setSupplierId("");
    clearAll();
  }

  function openAdd(nextMode: StockMode) {
    clearAll();
    setEditing(null);
    setForm(emptyForm);
    setSupplierId("");
    setMode(nextMode);
  }

  function openEdit(movement: StockMovement) {
    if (!isEditableType(movement.type)) {
      return;
    }

    clearAll();
    setEditing(movement);
    setMode(movement.type);
    setForm({
      productId: String(movement.product_id),
      quantity: String(movement.quantity),
      note: movement.note || "",
      color: movement.color || "",
      size: movement.size || "",
    });
    setSupplierId(movement.supplier_id ? String(movement.supplier_id) : "");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!mode) {
      return;
    }

    if (
      !report(
        collectFieldErrors([
          ["productId", requiredMessage(form.productId, "Please select a product")],
          [
            "quantity",
            !form.quantity.trim() || Number(form.quantity) <= 0
              ? "Please enter a valid quantity"
              : "",
          ],
        ]),
        showToast
      )
    ) {
      return;
    }

    const payload = {
      product_id: Number(form.productId),
      type: mode,
      quantity: Number(form.quantity),
      note: form.note,
      supplier_id: supplierId ? Number(supplierId) : undefined,
      color: form.color,
      size: form.size,
    };

    await run(async () => {
      try {
        const response = editing
          ? await saveStockMovement(editing.id, payload)
          : await createStockMovement(payload);

        setProducts((current) => upsertById(current, response.product));
        await reload();
        showToast(response.message, "success");
        closeModal();
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update stock"));
      }
    });
  }

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: "product",
      header: "Product",
      sortable: true,
      sortValue: (movement) => movement.product,
      render: (movement) => (
        <div className="min-w-0 max-w-14rem">
          <p className="truncate font-medium text-slate-800">{movement.product}</p>
          {movement.color || movement.size || movement.supplier ? (
            <p className="truncate text-xs text-slate-500">
              {[movement.color, movement.size, movement.supplier].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (movement) => movement.type,
      render: (movement) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            TYPE_TONES[movement.type] || "bg-slate-100 text-slate-700"
          }`}
        >
          {TYPE_LABELS[movement.type] ?? movement.type}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      sortable: true,
      sortValue: (movement) => Number(movement.quantity),
      render: (movement) => {
        const inbound = INBOUND.has(movement.type);

        return (
          <span
            className={`font-ledger font-semibold ${
              inbound ? "text-teal-700" : "text-rose-700"
            }`}
          >
            {inbound ? "+" : "−"}
            {movement.quantity}
          </span>
        );
      },
    },
    {
      key: "note",
      header: "Note",
      render: (movement) => <NoteCell note={movement.note} />,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (movement) => new Date(movement.created_at).getTime(),
      render: (movement) => {
        const date = new Date(movement.created_at);

        return (
          <span className="whitespace-nowrap text-slate-600" title={date.toLocaleString()}>
            {date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      render: (movement) =>
        isEditableType(movement.type) ? (
          <RowMenu
            onEdit={() => openEdit(movement)}
            onDelete={() => setPendingDelete(movement)}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <PagePanel
        title={
          <TableToolbar
            search={search}
            onSearch={setSearch}
            count={total}
          />
        }
        actions={
          <>
            <AddButton label="Stock In" onClick={() => openAdd("in")} />
            <AddButton label="Damage" onClick={() => openAdd("damage")} />
            <AddButton label="Adjust" onClick={() => openAdd("adjust")} />
          </>
        }
      >
        <DataTable
          rows={movements}
          columns={columns}
          rowKey={(movement) => movement.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search
              ? "No stock movements yet."
              : "No matching movements."
          }
        />
      </PagePanel>

      {mode ? (
        <Modal
          title={
            editing
              ? "Edit stock"
              : mode === "in"
                ? "Stock In"
                : mode === "damage"
                  ? "Damage"
                  : "Adjust out"
          }
          onClose={busy ? () => undefined : closeModal}
        >
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            {editing ? (
              <Select
                value={mode}
                onChange={(nextMode) => setMode(nextMode as StockMode)}
              >
                <option value="in">Stock in</option>
                <option value="damage">Damage</option>
                <option value="adjust">Adjust out</option>
              </Select>
            ) : null}
            <ProductSelect
              products={products}
              value={form.productId}
              error={errors.productId}
              onChange={(productId) => {
                setForm({ ...form, productId, color: "", size: "" });
                clearError("productId");
              }}
            />
            <VariantPickers
              product={products.find((item) => String(item.id) === form.productId)}
              color={form.color}
              size={form.size}
              onColor={(color) => setForm({ ...form, color })}
              onSize={(size) => setForm({ ...form, size })}
            />
            <Field
              type="number"
              placeholder="Quantity"
              min="1"
              value={form.quantity}
              error={errors.quantity}
              onChange={(quantity) => {
                setForm({ ...form, quantity });
                clearError("quantity");
              }}
            />
            {mode === "in" && suppliers.length > 0 ? (
              <Select value={supplierId} onChange={setSupplierId}>
                <option value="">Supplier (optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <textarea
              className="field-input min-h-24 resize-y"
              placeholder="Note (optional)"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
            <ModalActions loading={busy} onCancel={closeModal} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete stock"
          message="Delete this movement and reverse its stock?"
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await removeStockMovement(pendingDelete.id);
                setProducts((current) => upsertById(current, response.product));
                await reload();
                setPendingDelete(null);
                showToast(response.message, "success");
              } catch (loadError) {
                showToast(getApiError(loadError, "Unable to delete stock"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default Stock;
