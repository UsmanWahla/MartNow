import { useEffect, useState } from "react";
import InlineEdit from "../../components/store-admin/InlineEdit";
import Modal from "../../components/shared/Modal";
import ConfirmModal from "../../components/shared/ConfirmModal";
import RowMenu from "../../components/shared/RowMenu";
import PagePanel from "../../components/shared/PagePanel";
import AddButton from "../../components/shared/AddButton";
import Field from "../../components/shared/Field";
import TableToolbar from "../../components/shared/TableToolbar";
import ExportCsvButton from "../../components/shared/ExportCsvButton";
import ModalActions from "../../components/shared/ModalActions";
import ProductLedgerModal from "../../components/store-admin/ProductLedgerModal";
import LowStockBadge from "../../components/shared/LowStockBadge";
import DataTable, { type DataTableColumn } from "../../components/shared/DataTable";
import Money from "../../components/shared/Money";
import { IconLedger } from "../../components/shared/icons";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import useOpenAddFromQuery from "../../hooks/useOpenAddFromQuery";
import { useServerList } from "../../hooks/useServerList";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import { getApiError } from "../../auth";
import {
  createProduct,
  fetchProducts,
  fetchSettings,
  productImageUrl,
  removeProduct,
  saveProduct,
} from "../../api";
import { upsertById, type Product, type ProductImage } from "../../types";
import { variantCombos, variantKey, variantLabel, weakestStock } from "../../variantStock";
import { collectFieldErrors, requiredMessage } from "../../utils/formValidate";
import { formatNumberInput } from "../../numberFormat";
import { csvFilename, csvNumber, downloadCsv, fetchAllRows } from "../../utils/csvExport";
import {
  BASE_UNITS,
  formatQuantity,
  INVENTORY_PRESETS,
  SALE_UNITS,
  type InventoryType,
  saleStock,
  unitLabel,
} from "../../productUnits";

const emptyForm = {
  name: "",
  sku: "",
  price: "",
  cost: "",
  stock: "",
  description: "",
  category: "",
  featured: false,
  inventoryType: "unit" as InventoryType,
  baseUnit: "piece",
  saleUnit: "piece",
  quantityStep: "1",
  unitsPerSaleUnit: "1",
};

const COLOR_PRESETS = [
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#f8fafc" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Red", hex: "#b91c1c" },
  { name: "Beige", hex: "#d6c7b0" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];

function VariantStockGrid({
  colors,
  sizes,
  values,
  onChange,
  readOnly = false,
}: {
  colors: { name: string; hex: string }[];
  sizes: string[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  readOnly?: boolean;
}) {
  const combos = variantCombos(colors, sizes);
  const total = combos.reduce(
    (sum, row) => sum + (Number(values[variantKey(row.color, row.size)]) || 0),
    0
  );

  function cell(color: string, size: string) {
    const key = variantKey(color, size);
    if (readOnly) {
      return (
        <span className="font-ledger block text-center text-sm">
          {formatQuantity(values[key] || 0)}
        </span>
      );
    }

    return (
      <input
        className="field-input h-9 px-2 text-center"
        type="number"
        min="0"
        step="0.001"
        value={values[key] ?? ""}
        onChange={(event) => onChange(key, event.target.value)}
      />
    );
  }

  return (
    <div>
      {colors.length > 0 && sizes.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-(--hairline) bg-white">
          <table className="w-full min-w-[18rem] text-sm">
            <thead>
              <tr className="border-b border-(--hairline) text-xs text-slate-500">
                <th className="px-2 py-2 text-left font-medium">Color</th>
                {sizes.map((size) => (
                  <th key={size} className="px-1 py-2 font-medium">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color.name} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ background: color.hex }}
                      />
                      {color.name}
                    </span>
                  </td>
                  {sizes.map((size) => (
                    <td key={size} className="px-1 py-1.5">
                      {cell(color.name, size)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {combos.map((row) => (
            <div key={variantKey(row.color, row.size)} className="flex items-center gap-2">
              <p className="w-28 shrink-0 text-sm font-medium text-slate-700">
                {variantLabel(row.color, row.size) || "Default"}
              </p>
              <div className="min-w-0 flex-1">{cell(row.color, row.size)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs font-medium text-slate-500">
        Total {formatQuantity(total)}
      </p>
    </div>
  );
}

function Products() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { showAdd, setShowAdd } = useOpenAddFromQuery();
  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  const [lowStockLimit, setLowStockLimit] = useState(3);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorDraft, setColorDraft] = useState({ name: "", hex: "#0f766e" });
  const [sizeDraft, setSizeDraft] = useState("");
  const [variantStocks, setVariantStocks] = useState<Record<string, string>>({});
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: products,
    setRows: setProducts,
    total,
    loading,
  } = useServerList<Product>(
    (q, nextPage) => fetchProducts({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load products"))
  );

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        setLowStockLimit(settings.low_stock_threshold || 3);
      } catch {
        // table load already surfaces API errors
      }
    }

    void loadSettings();
  }, []);

  function closeModals() {
    setShowAdd(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImages([]);
    setColors([]);
    setSizes([]);
    setColorDraft({ name: "", hex: "#0f766e" });
    setSizeDraft("");
    setVariantStocks({});
    clearAll();
  }

  function openAdd() {
    clearAll();
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImages([]);
    setColors([]);
    setSizes([]);
    setColorDraft({ name: "", hex: "#0f766e" });
    setSizeDraft("");
    setVariantStocks({});
    setShowAdd(true);
  }

  function openEdit(product: Product) {
    clearAll();
    setEditingProduct(product);
    setImageFiles([]);
    setExistingImages(product.images || []);
    setColors(
      (product.colors || []).map((color) => ({ name: color.name, hex: color.hex }))
    );
    setSizes((product.sizes || []).map((size) => size.name));
    setVariantStocks(
      Object.fromEntries(
        (product.variants || []).map((row) => [
          variantKey(row.color, row.size),
          formatNumberInput(row.stock, "0"),
        ])
      )
    );
    setForm({
      name: product.name,
      sku: product.sku || "",
      price: formatNumberInput(product.price),
      cost: formatNumberInput(product.cost_price ?? 0, "0"),
      stock: formatNumberInput(product.stock, "0"),
      description: product.description || "",
      category: product.category || "",
      featured: Boolean(product.featured),
      inventoryType: product.inventory_type || "unit",
      baseUnit: product.base_unit || "piece",
      saleUnit: product.sale_unit || "piece",
      quantityStep: formatNumberInput(product.quantity_step || 1, "1"),
      unitsPerSaleUnit: formatNumberInput(product.units_per_sale_unit || 1, "1"),
    });
  }

  function validateProductForm() {
    return collectFieldErrors([
      ["name", requiredMessage(form.name, "Please enter the product name")],
      [
        "price",
        !form.price.trim() || Number(form.price) < 0
          ? "Please enter a valid price"
          : "",
      ],
      [
        "quantityStep",
        Number(form.quantityStep) <= 0 ? "Quantity step must be greater than zero" : "",
      ],
      [
        "unitsPerSaleUnit",
        Number(form.unitsPerSaleUnit) <= 0 ? "Unit conversion must be greater than zero" : "",
      ],
    ]);
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (!report(validateProductForm(), showToast)) {
      return;
    }

    await run(async () => {
      try {
        const variants =
          colors.length > 0 || sizes.length > 0
            ? variantCombos(colors, sizes).map((row) => ({
                color: row.color,
                size: row.size,
                stock: Number(variantStocks[variantKey(row.color, row.size)] || 0),
              }))
            : [{ color: "", size: "", stock: Number(form.stock) || 0 }];
        const response = await createProduct({
          name: form.name,
          sku: form.sku,
          price: Number(form.price),
          cost_price: Number(form.cost),
          stock: variants.reduce((sum, row) => sum + row.stock, 0),
          description: form.description,
          category: form.category,
          featured: form.featured,
          images: imageFiles,
          colors,
          sizes,
          variants,
          inventory_type: form.inventoryType,
          base_unit: form.baseUnit,
          sale_unit: form.saleUnit,
          quantity_step: Number(form.quantityStep),
          units_per_sale_unit: Number(form.unitsPerSaleUnit),
        });

        setProducts((current) => upsertById(current, response.product));
        showToast(response.message, "success");
        closeModals();
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add product"));
      }
    });
  }

  async function updateProduct(product: Product, changes: Partial<Product>) {
    try {
      const response = await saveProduct(product.id, {
        name: changes.name ?? product.name,
        sku: changes.sku ?? product.sku ?? "",
        price: Number(changes.price ?? product.price),
        cost_price: Number(changes.cost_price ?? product.cost_price ?? 0),
        description: product.description || "",
        category: changes.category ?? product.category ?? "",
        featured: changes.featured ?? product.featured ?? false,
        inventory_type: product.inventory_type || "unit",
        base_unit: product.base_unit || "piece",
        sale_unit: product.sale_unit || "piece",
        quantity_step: Number(product.quantity_step || 1),
        units_per_sale_unit: Number(product.units_per_sale_unit || 1),
      });

      setProducts((current) => upsertById(current, response.product));
      showToast(response.message, "success");
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to update product"));
    }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editingProduct) {
      return;
    }

    if (!report(validateProductForm(), showToast)) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveProduct(editingProduct.id, {
          name: form.name,
          sku: form.sku,
          price: Number(form.price),
          cost_price: Number(form.cost),
          description: form.description,
          category: form.category,
          featured: form.featured,
          inventory_type: form.inventoryType,
          base_unit: form.baseUnit,
          sale_unit: form.saleUnit,
          quantity_step: Number(form.quantityStep),
          units_per_sale_unit: Number(form.unitsPerSaleUnit),
          images: imageFiles,
          colors,
          sizes,
          keep_image_ids: existingImages
            .filter((image) => image.id > 0)
            .map((image) => image.id),
          keep_image_paths: existingImages
            .filter((image) => image.id === 0)
            .map((image) => image.path),
        });

        setProducts((current) => upsertById(current, response.product));
        showToast(response.message, "success");
        closeModals();
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update product"));
      }
    });
  }

  async function deleteProduct(product: Product) {
    await run(async () => {
      try {
        const response = await removeProduct(product.id);
        setProducts((current) => current.filter((row) => row.id !== product.id));
        setPendingDelete(null);
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to delete product"));
      }
    });
  }

  async function exportProducts() {
    const rows = await fetchAllRows((page) =>
      fetchProducts({ q: search.trim(), page, limit: 50 })
    );

    downloadCsv(csvFilename("products"), rows, [
      { header: "Product", value: (product) => product.name },
      { header: "SKU", value: (product) => product.sku || "" },
      { header: "Category", value: (product) => product.category || "" },
      { header: "Inventory type", value: (product) => product.inventory_type || "unit" },
      { header: "Base unit", value: (product) => product.base_unit || "piece" },
      { header: "Sale unit", value: (product) => product.sale_unit || "piece" },
      { header: "Minimum quantity step", value: (product) => csvNumber(product.quantity_step) },
      { header: "Units per sale unit", value: (product) => csvNumber(product.units_per_sale_unit) },
      { header: "Current cost price", value: (product) => csvNumber(product.cost_price) },
      { header: "Current sale price", value: (product) => csvNumber(product.price) },
      { header: "Available stock", value: (product) => csvNumber(product.stock) },
      {
        header: "Variants",
        value: (product) =>
          (product.variants || [])
            .map((variant) => {
              const label = [variant.color, variant.size].filter(Boolean).join(" / ");
              return `${label || "Default"}: ${formatQuantity(variant.stock)}`;
            })
            .join("; "),
      },
      { header: "Storefront", value: (product) => (product.featured ? "Featured" : "Standard") },
    ]);
  }

  const columns: DataTableColumn<Product>[] = [
    {
      key: "image",
      header: "",
      render: (product) => {
        const cover = product.images?.[0]?.path || product.image_path;
        return (
          <div className="flex items-center gap-2">
            {cover ? (
              <img
                src={productImageUrl(cover)}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-slate-100" />
            )}
            {product.colors && product.colors.length > 0 ? (
              <div className="flex max-w-16 flex-wrap gap-0.5">
                {product.colors.slice(0, 4).map((color) => (
                  <span
                    key={color.name}
                    className="h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ background: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (product) => product.name,
      render: (product) => (
        <InlineEdit
          value={product.name}
          onSave={(value) => void updateProduct(product, { name: value })}
        />
      ),
    },
    {
      key: "sku",
      header: "SKU",
      sortable: true,
      sortValue: (product) => product.sku || "",
      render: (product) => (
        <InlineEdit
          value={product.sku || ""}
          onSave={(value) => void updateProduct(product, { sku: value })}
        />
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (product) => product.category || "",
      render: (product) =>
        product.category ? (
          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
            {product.category}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "featured",
      header: "Storefront",
      sortable: true,
      sortValue: (product) => (product.featured ? 1 : 0),
      render: (product) =>
        product.featured ? (
          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Featured
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "cost",
      header: "Cost",
      sortable: true,
      sortValue: (product) => Number(product.cost_price),
      render: (product) => (
        <div>
          <InlineEdit
            type="number"
            value={formatNumberInput(product.cost_price ?? 0, "0")}
            display={<Money value={product.cost_price ?? 0} />}
            onSave={(value) =>
              void updateProduct(product, { cost_price: Number(value) })
            }
          />
          <p className="text-[11px] text-slate-400">per {product.base_unit || "piece"}</p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Sale price",
      sortable: true,
      sortValue: (product) => Number(product.price),
      render: (product) => (
        <div>
          <InlineEdit
            type="number"
            value={formatNumberInput(product.price)}
            display={<Money value={product.price} />}
            onSave={(value) =>
              void updateProduct(product, { price: Number(value) })
            }
          />
          <p className="text-[11px] text-slate-400">per {product.sale_unit || "piece"}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      sortValue: (product) => Number(product.stock),
      render: (product) => (
        <div className="min-w-7rem">
          <div className="flex items-center gap-2">
            <span className="font-ledger">
              {formatQuantity(product.stock)} {unitLabel(product.base_unit, Number(product.stock))}
            </span>
            <LowStockBadge
              stock={saleStock(product, weakestStock(product))}
              threshold={lowStockLimit}
            />
          </div>
          {product.variants &&
          product.variants.length > 0 &&
          (product.colors?.length || product.sizes?.length) ? (
            <p className="mt-0.5 max-w-12rem truncate text-[11px] text-slate-400">
              {product.variants
                .map(
                  (row) =>
                    `${variantLabel(row.color, row.size) || "Base"} ${formatQuantity(row.stock)}`
                )
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (product) => (
        <RowMenu
          extras={[
            {
              label: "Ledger",
              icon: <IconLedger className="h-4 w-4 text-slate-500" />,
              onClick: () => setLedgerProduct(product),
            },
          ]}
          onEdit={() => openEdit(product)}
          onDelete={() => setPendingDelete(product)}
        />
      ),
    },
  ];

  const unitLocked = Boolean(editingProduct && Number(editingProduct.stock) > 0);
  const usesVariants = colors.length > 0 || sizes.length > 0;
  const productForm = (
    <>
      <Field
        placeholder="Product name"
        value={form.name}
        error={errors.name}
        onChange={(name) => {
          setForm({ ...form, name });
          clearError("name");
        }}
      />
      <Field
        placeholder="SKU / barcode (optional)"
        value={form.sku}
        onChange={(sku) => setForm({ ...form, sku })}
      />
      <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800">Inventory & selling unit</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Stock and FIFO cost stay in the base unit; customers buy in the sale unit.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Product type
            <select
              className="field-input mt-1.5"
              value={form.inventoryType}
              disabled={unitLocked}
              onChange={(event) => {
                const inventoryType = event.target.value as InventoryType;
                const preset = INVENTORY_PRESETS[inventoryType];
                setForm({
                  ...form,
                  inventoryType,
                  baseUnit: preset.baseUnit,
                  saleUnit: preset.saleUnit,
                  quantityStep: String(preset.step),
                  unitsPerSaleUnit: String(preset.conversion),
                });
              }}
            >
              {Object.entries(INVENTORY_PRESETS).map(([value, preset]) => (
                <option key={value} value={value}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Base stock unit
            <select
              className="field-input mt-1.5"
              value={form.baseUnit}
              disabled={unitLocked}
              onChange={(event) => setForm({ ...form, baseUnit: event.target.value })}
            >
              {BASE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Customer sale unit
            <select
              className="field-input mt-1.5"
              value={form.saleUnit}
              disabled={unitLocked}
              onChange={(event) => setForm({ ...form, saleUnit: event.target.value })}
            >
              {SALE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <Field
            label={`Minimum quantity step (${form.saleUnit})`}
            type="number"
            min="0.001"
            step="0.001"
            disabled={unitLocked}
            value={form.quantityStep}
            error={errors.quantityStep}
            onChange={(quantityStep) => {
              setForm({ ...form, quantityStep });
              clearError("quantityStep");
            }}
          />
          <Field
            label={`${form.baseUnit}s in one ${form.saleUnit}`}
            type="number"
            min="0.001"
            step="0.001"
            disabled={unitLocked}
            value={form.unitsPerSaleUnit}
            error={errors.unitsPerSaleUnit}
            onChange={(unitsPerSaleUnit) => {
              setForm({ ...form, unitsPerSaleUnit });
              clearError("unitsPerSaleUnit");
            }}
          />
        </div>
        {unitLocked ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Units are locked while stock is on hand. Stock it out before changing conversion.
          </p>
        ) : null}
      </div>
      <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800">Pricing & opening stock</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Purchase cost uses the base unit; customer price uses the sale unit.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            type="number"
            label={`Cost price per ${form.baseUnit}`}
            placeholder="Cost price"
            min="0"
            step="0.0001"
            value={form.cost}
            onChange={(cost) => setForm({ ...form, cost })}
          />
          <Field
            type="number"
            label={`Sale price per ${form.saleUnit}`}
            placeholder="Sale price"
            min="1"
            step="0.01"
            value={form.price}
            error={errors.price}
            onChange={(price) => {
              setForm({ ...form, price });
              clearError("price");
            }}
          />
          {!editingProduct && !usesVariants ? (
            <Field
              type="number"
              label={`Opening stock (${form.baseUnit})`}
              placeholder="Opening stock"
              min="0"
              step="0.001"
              value={form.stock}
              onChange={(stock) => setForm({ ...form, stock })}
            />
          ) : null}
        </div>
        {usesVariants ? (
          <p className="mt-2 text-xs font-medium text-teal-700">
            Opening stock is entered separately for each color and size below.
          </p>
        ) : editingProduct ? (
          <p className="mt-2 text-xs font-medium text-slate-500">
            Use Stock In, Damage, or Adjust to change existing stock.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="block text-sm font-medium text-slate-700">
          Product category
          <input
            className="field-input mt-1.5"
            list="product-category-suggestions"
            maxLength={60}
            placeholder="e.g. Medicines, Grocery, Shirts"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 sm:mt-6">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(event) => setForm({ ...form, featured: event.target.checked })}
          />
          Feature on shop
        </label>
      </div>
      <datalist id="product-category-suggestions">
        {[...new Set(products.map((product) => product.category).filter(Boolean))]
          .sort()
          .map((category) => (
            <option key={category} value={category!} />
          ))}
      </datalist>
      <textarea
        className="field-input min-h-20"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Photos</p>
          <p className="text-xs text-slate-500">Up to 8 · first is the cover</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {existingImages.map((image) => (
            <div key={`${image.id}-${image.path}`} className="relative">
              <img
                src={productImageUrl(image.path)}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white"
                onClick={() =>
                  setExistingImages((current) =>
                    current.filter((row) => row.id !== image.id || row.path !== image.path)
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
          {imageFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white"
                onClick={() =>
                  setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                }
              >
                ×
              </button>
            </div>
          ))}
          {existingImages.length + imageFiles.length < 8 ? (
            <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl border border-dashed border-[#c5d5d0] bg-white text-xs font-semibold text-teal-800">
              + Add
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setImageFiles((current) => [...current, ...files].slice(0, 8 - existingImages.length));
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
        <p className="mb-1.5 text-sm font-semibold">Colors</p>
        <p className="mb-2 text-xs text-slate-500">Shoppers pick one color at checkout</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((preset) => {
            const active = colors.some((color) => color.name === preset.name);
            return (
              <button
                key={preset.name}
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold ${
                  active
                    ? "border-teal-600 bg-teal-50 text-teal-800"
                    : "border-(--hairline) bg-white text-slate-600"
                }`}
                onClick={() =>
                  setColors((current) =>
                    active
                      ? current.filter((color) => color.name !== preset.name)
                      : [...current, preset]
                  )
                }
              >
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ background: preset.hex }}
                />
                {preset.name}
              </button>
            );
          })}
        </div>
        <div className="mb-2 flex items-center gap-2">
          <input
            className="field-input min-w-0 flex-1"
            placeholder="Custom color"
            value={colorDraft.name}
            onChange={(event) => setColorDraft({ ...colorDraft, name: event.target.value })}
          />
          <input
            type="color"
            className="h-11 w-12 shrink-0 rounded-xl border border-[#c5d5d0] bg-white p-1"
            value={colorDraft.hex}
            onChange={(event) => setColorDraft({ ...colorDraft, hex: event.target.value })}
          />
          <button
            type="button"
            className="h-11 shrink-0 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800"
            onClick={() => {
              const name = colorDraft.name.trim();
              if (!name || colors.some((color) => color.name === name)) {
                return;
              }
              setColors((current) => [...current, { name, hex: colorDraft.hex }]);
              setColorDraft({ name: "", hex: "#0f766e" });
            }}
          >
            Add
          </button>
        </div>
        {colors.filter((color) => !COLOR_PRESETS.some((preset) => preset.name === color.name)).length >
        0 ? (
          <div className="flex flex-wrap gap-1.5">
            {colors
              .filter((color) => !COLOR_PRESETS.some((preset) => preset.name === color.name))
              .map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-50 px-2 text-xs font-semibold text-teal-800"
                  onClick={() =>
                    setColors((current) => current.filter((row) => row.name !== color.name))
                  }
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ background: color.hex }}
                  />
                  {color.name} ×
                </button>
              ))}
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
        <p className="mb-1.5 text-sm font-semibold">Sizes</p>
        <p className="mb-2 text-xs text-slate-500">Shoppers pick one size at checkout</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[...SIZE_PRESETS, ...sizes.filter((size) => !SIZE_PRESETS.includes(size))].map((preset) => {
            const active = sizes.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2.5 text-xs font-semibold ${
                  active
                    ? "border-teal-600 bg-teal-50 text-teal-800"
                    : "border-(--hairline) bg-white text-slate-600"
                }`}
                onClick={() =>
                  setSizes((current) =>
                    active ? current.filter((size) => size !== preset) : [...current, preset]
                  )
                }
              >
                {preset}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="field-input min-w-0 flex-1"
            placeholder="Custom size (32, 42, Free)"
            value={sizeDraft}
            onChange={(event) => setSizeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              const name = sizeDraft.trim();
              if (!name || sizes.includes(name)) {
                return;
              }
              setSizes((current) => [...current, name]);
              setSizeDraft("");
            }}
          />
          <button
            type="button"
            className="h-11 shrink-0 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800"
            onClick={() => {
              const name = sizeDraft.trim();
              if (!name || sizes.includes(name)) {
                return;
              }
              setSizes((current) => [...current, name]);
              setSizeDraft("");
            }}
          >
            Add
          </button>
        </div>
      </div>
      {usesVariants ? (
        <div className="rounded-2xl border border-(--hairline) bg-[#f8fbfa] p-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">
              {editingProduct ? "On hand by option" : "Opening stock by option"}
            </p>
            {editingProduct ? (
              <p className="text-xs text-slate-500">Use Stock In / Damage to change qty</p>
            ) : null}
          </div>
          <VariantStockGrid
            colors={colors}
            sizes={sizes}
            values={variantStocks}
            readOnly={Boolean(editingProduct)}
            onChange={(key, value) =>
              setVariantStocks((current) => ({ ...current, [key]: value }))
            }
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div>
      <PagePanel>
        <div className="mb-3 flex flex-col items-end gap-2">
          <AddButton onClick={openAdd} />
          <div className="flex flex-wrap items-center gap-3">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              count={total}
              actions={
                <ExportCsvButton
                  onExport={exportProducts}
                  onSuccess={() => showToast("Products CSV downloaded", "success")}
                  onError={(error) => showToast(getApiError(error, "Unable to export products"))}
                />
              }
            />
          </div>
        </div>
        <DataTable
          rows={products}
          columns={columns}
          rowKey={(product) => product.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search ? "No products yet." : "No matching products."
          }
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add Product" wide onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleAdd}>
            {productForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {editingProduct ? (
        <Modal title="Edit Product" wide onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleEdit}>
            {productForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete Product"
          message={`Delete ${pendingDelete.name}?`}
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void deleteProduct(pendingDelete)}
        />
      ) : null}

      {ledgerProduct ? (
        <ProductLedgerModal
          product={ledgerProduct}
          onClose={() => setLedgerProduct(null)}
          onError={(message) => showToast(message)}
        />
      ) : null}
    </div>
  );
}

export default Products;
