import { useMemo, useState } from "react";
import DataTable, { type DataTableColumn } from "../../shared/DataTable";
import ExportCsvButton from "../../shared/ExportCsvButton";
import Money from "../../shared/Money";
import PagePanel from "../../shared/PagePanel";
import Select from "../../shared/Select";
import TableToolbar from "../../shared/TableToolbar";
import { formatQuantity } from "../../../productUnits";
import type { ReportRange, StoreInventoryReportRow } from "../../../types";
import { csvDateTime, csvFilename, downloadCsv } from "../../../utils/csvExport";
import { formatReportDate, matchesReportSearch, reportRangeSuffix, variantStockSummary } from "../../../utils/reporting";

interface StoreInventoryReportProps {
  rows: StoreInventoryReportRow[];
  range: ReportRange;
  onExported: () => void;
}

const STATUS_LABELS = { healthy: "Healthy", low: "Low stock", out: "Out of stock" } as const;

function StoreInventoryReport({ rows, range, onExported }: StoreInventoryReportProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(
    () => rows.filter((row) => (status === "all" || row.status === status) && matchesReportSearch(search, [row.product, row.sku, row.category])),
    [rows, search, status]
  );

  function exportRows() {
    downloadCsv(csvFilename("inventory-health", reportRangeSuffix(range)), filtered, [
      { header: "Product", value: (row) => row.product },
      { header: "SKU", value: (row) => row.sku },
      { header: "Category", value: (row) => row.category },
      { header: "Status", value: (row) => STATUS_LABELS[row.status] },
      { header: "Base stock", value: (row) => row.stock },
      { header: "Base unit", value: (row) => row.base_unit },
      { header: "Sale stock", value: (row) => row.sale_stock },
      { header: "Sale unit", value: (row) => row.sale_unit },
      { header: "Remaining FIFO value", value: (row) => row.stock_value },
      { header: "Damaged in period", value: (row) => row.damage_quantity },
      { header: "Adjusted in period", value: (row) => row.adjustment_quantity },
      { header: "Oldest remaining batch", value: (row) => csvDateTime(row.oldest_received_at) },
      { header: "Variants", value: (row) => variantStockSummary(row.variants) },
    ]);
  }

  const columns: DataTableColumn<StoreInventoryReportRow>[] = [
    { key: "product", header: "Product", sortable: true, sortValue: (row) => row.product, render: (row) => <div><p className="font-medium text-slate-800">{row.product}</p><p className="text-xs text-slate-400">{row.sku || row.category || "No SKU"}</p></div> },
    { key: "status", header: "Health", sortable: true, sortValue: (row) => row.status, render: (row) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "healthy" ? "bg-emerald-50 text-emerald-700" : row.status === "low" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{STATUS_LABELS[row.status]}</span> },
    { key: "stock", header: "On hand", sortable: true, sortValue: (row) => row.stock, render: (row) => <div><p className="font-ledger">{formatQuantity(row.stock)} {row.base_unit}</p>{row.sale_unit !== row.base_unit ? <p className="text-xs text-slate-400">{formatQuantity(row.sale_stock)} {row.sale_unit}</p> : null}</div> },
    { key: "value", header: "FIFO value", sortable: true, sortValue: (row) => row.stock_value, render: (row) => <Money value={row.stock_value} /> },
    { key: "losses", header: "Damage / adjust", sortable: true, sortValue: (row) => row.damage_quantity + row.adjustment_quantity, render: (row) => <span className="font-ledger">{formatQuantity(row.damage_quantity)} / {formatQuantity(row.adjustment_quantity)}</span> },
    { key: "oldest", header: "Oldest batch", sortable: true, sortValue: (row) => row.oldest_received_at || "", render: (row) => formatReportDate(row.oldest_received_at) },
  ];

  return (
    <PagePanel title="Inventory health">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <div className="w-36"><Select value={status} onChange={setStatus}><option value="all">All stock</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></Select></div>
        <TableToolbar search={search} onSearch={setSearch} count={filtered.length} actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />} />
      </div>
      <DataTable rows={filtered} columns={columns} rowKey={(row) => row.product_id} filterKey={`${search}|${status}`} emptyMessage="No matching inventory records." />
    </PagePanel>
  );
}

export default StoreInventoryReport;
