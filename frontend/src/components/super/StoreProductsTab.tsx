import { useCallback } from "react";
import { getApiError } from "../../auth";
import { fetchPlatformStoreProducts, productImageUrl } from "../../api";
import { useServerList } from "../../hooks/useServerList";
import { useToast } from "../../hooks/useToast";
import type { Product } from "../../types";
import { weakestStock } from "../../variantStock";
import DataTable, { type DataTableColumn } from "../DataTable";
import LowStockBadge from "../LowStockBadge";
import Money from "../Money";
import PagePanel from "../PagePanel";
import TableToolbar from "../TableToolbar";

function StoreProductsTab({ storeId }: { storeId: number }) {
  const { showToast } = useToast();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: products,
    total,
    loading,
  } = useServerList<Product>(
    useCallback(
      (q, nextPage) => fetchPlatformStoreProducts(storeId, { q, page: nextPage }),
      [storeId]
    ),
    (error) => showToast(getApiError(error, "Unable to load store products")),
    String(storeId)
  );

  const columns: DataTableColumn<Product>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      sortValue: (product) => product.name,
      render: (product) => (
        <div className="flex min-w-10rem items-center gap-2.5">
          {product.image_path ? (
            <img
              src={productImageUrl(product.image_path)}
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{product.name}</p>
            <p className="truncate text-xs text-slate-500">{product.sku || "No SKU"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (product) => product.category || "",
      render: (product) => product.category || "—",
    },
    {
      key: "price",
      header: "Pricing",
      sortable: true,
      sortValue: (product) => Number(product.price),
      render: (product) => (
        <div className="whitespace-nowrap">
          <Money value={product.price} className="font-semibold text-slate-800" />
          <p className="text-xs text-slate-500">
            Cost <Money value={product.cost_price || 0} />
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      sortValue: (product) => Number(product.stock),
      render: (product) => (
        <div className="flex items-center gap-2">
          <span className="font-ledger">{product.stock}</span>
          <LowStockBadge stock={weakestStock(product)} />
        </div>
      ),
    },
    {
      key: "featured",
      header: "Visibility",
      sortValue: (product) => (product.featured ? 1 : 0),
      render: (product) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            product.featured ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {product.featured ? "Featured" : "Standard"}
        </span>
      ),
    },
  ];

  return (
    <PagePanel>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <TableToolbar search={search} onSearch={setSearch} count={total} />
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
        emptyMessage={total === 0 && !search ? "No products in this store yet." : "No matching products."}
      />
    </PagePanel>
  );
}

export default StoreProductsTab;
