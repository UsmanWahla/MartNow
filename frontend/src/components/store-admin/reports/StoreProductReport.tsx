import { useMemo, useState } from "react";
import DataTable, { type DataTableColumn } from "../../shared/DataTable";
import ExportCsvButton from "../../shared/ExportCsvButton";
import Money from "../../shared/Money";
import PagePanel from "../../shared/PagePanel";
import TableToolbar from "../../shared/TableToolbar";
import { formatQuantity } from "../../../productUnits";
import type { ReportRange, StoreProductReportRow } from "../../../types";
import { csvDateTime, csvFilename, downloadCsv } from "../../../utils/csvExport";
import { formatReportDate, matchesReportSearch, reportRangeSuffix, variantStockSummary } from "../../../utils/reporting";

interface StoreProductReportProps {
  rows: StoreProductReportRow[];
  range: ReportRange;
  onExported: () => void;
}

function StoreProductReport({ rows, range, onExported }: StoreProductReportProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => rows.filter((row) => matchesReportSearch(search, [row.product, row.sku, row.category])),
    [rows, search]
  );

  function exportRows() {
    downloadCsv(csvFilename("product-performance", reportRangeSuffix(range)), filtered, [
      { header: "Product", value: (row) => row.product },
      { header: "SKU", value: (row) => row.sku },
      { header: "Category", value: (row) => row.category },
      { header: "Quantity sold", value: (row) => row.quantity_sold },
      { header: "Sale unit", value: (row) => row.sale_unit },
      { header: "Revenue", value: (row) => row.revenue },
      { header: "Actual FIFO cost", value: (row) => row.cost },
      { header: "Gross profit", value: (row) => row.profit },
      { header: "Margin percent", value: (row) => row.margin_percent },
      { header: "Stock", value: (row) => row.stock },
      { header: "Base unit", value: (row) => row.base_unit },
      { header: "Variants", value: (row) => variantStockSummary(row.variants) },
      { header: "Last sale", value: (row) => csvDateTime(row.last_sale_at) },
    ]);
  }

  const columns: DataTableColumn<StoreProductReportRow>[] = [
    { key: "product", header: "Product", sortable: true, sortValue: (row) => row.product, render: (row) => <div><p className="font-medium text-slate-800">{row.product}</p><p className="text-xs text-slate-400">{row.sku || row.category || "No SKU"}</p></div> },
    { key: "sold", header: "Sold", sortable: true, sortValue: (row) => row.quantity_sold, render: (row) => <span className="font-ledger">{formatQuantity(row.quantity_sold)} {row.sale_unit}</span> },
    { key: "revenue", header: "Revenue", sortable: true, sortValue: (row) => row.revenue, render: (row) => <Money value={row.revenue} /> },
    { key: "cost", header: "FIFO cost", sortable: true, sortValue: (row) => row.cost, render: (row) => <Money value={row.cost} /> },
    { key: "profit", header: "Profit", sortable: true, sortValue: (row) => row.profit, render: (row) => <div><Money value={row.profit} className={row.profit < 0 ? "text-red-600" : "font-semibold text-emerald-700"} /><p className="text-xs text-slate-400">{formatQuantity(row.margin_percent)}% margin</p></div> },
    { key: "stock", header: "On hand", sortable: true, sortValue: (row) => row.stock, render: (row) => <div><span className="font-ledger">{formatQuantity(row.stock)} {row.base_unit}</span>{row.variants.length ? <p className="max-w-12rem truncate text-xs text-slate-400" title={variantStockSummary(row.variants)}>{variantStockSummary(row.variants)}</p> : null}</div> },
    { key: "last_sale", header: "Last sale", sortable: true, sortValue: (row) => row.last_sale_at || "", render: (row) => formatReportDate(row.last_sale_at) },
  ];

  return (
    <PagePanel title="Product performance">
      <div className="mb-3 flex justify-end">
        <TableToolbar search={search} onSearch={setSearch} count={filtered.length} actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />} />
      </div>
      <DataTable rows={filtered} columns={columns} rowKey={(row) => row.product_id} filterKey={search} emptyMessage={search ? "No matching products." : "No product data for this period."} />
    </PagePanel>
  );
}

export default StoreProductReport;
