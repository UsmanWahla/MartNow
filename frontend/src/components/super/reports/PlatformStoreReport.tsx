import { useMemo, useState } from "react";
import DataTable, { type DataTableColumn } from "../../shared/DataTable";
import ExportCsvButton from "../../shared/ExportCsvButton";
import Money from "../../shared/Money";
import PagePanel from "../../shared/PagePanel";
import TableToolbar from "../../shared/TableToolbar";
import type { PlatformReportStoreRow, ReportRange } from "../../../types";
import { csvDateTime, csvFilename, downloadCsv } from "../../../utils/csvExport";
import { formatReportDate, matchesReportSearch, reportRangeSuffix } from "../../../utils/reporting";

interface PlatformStoreReportProps {
  rows: PlatformReportStoreRow[];
  range: ReportRange;
  healthOnly?: boolean;
  onExported: () => void;
  onOpenStore: (storeId: number) => void;
}

const HEALTH_TONES: Record<PlatformReportStoreRow["health"], string> = {
  healthy: "bg-emerald-50 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  setup_required: "bg-amber-50 text-amber-800",
  out_of_stock: "bg-red-50 text-red-700",
  no_sales: "bg-sky-50 text-sky-700",
  inactive_sales: "bg-orange-50 text-orange-700",
};

function PlatformStoreReport({ rows, range, healthOnly = false, onExported, onOpenStore }: PlatformStoreReportProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => rows.filter((row) => (!healthOnly || row.health !== "healthy") && matchesReportSearch(search, [row.store, row.shop_slug, row.store_type, row.health_label])),
    [healthOnly, rows, search]
  );

  function exportRows() {
    downloadCsv(csvFilename(healthOnly ? "store-health" : "store-performance", reportRangeSuffix(range)), filtered, [
      { header: "Store", value: (row) => row.store },
      { header: "Store type", value: (row) => row.store_type },
      { header: "Status", value: (row) => row.status },
      { header: "Health", value: (row) => row.health_label },
      { header: "Sales", value: (row) => row.sales },
      { header: "Store revenue", value: (row) => row.revenue },
      { header: "Online orders", value: (row) => row.online_orders },
      { header: "Online GMV", value: (row) => row.online_gmv },
      { header: "Commission", value: (row) => row.commission },
      { header: "Commission outstanding", value: (row) => row.commission_outstanding },
      { header: "Products", value: (row) => row.products },
      { header: "Out of stock products", value: (row) => row.out_of_stock },
      { header: "Last sale", value: (row) => csvDateTime(row.last_sale_at) },
    ]);
  }

  const columns: DataTableColumn<PlatformReportStoreRow>[] = [
    { key: "store", header: "Store", sortable: true, sortValue: (row) => row.store, render: (row) => <div><p className="font-medium text-slate-800">{row.store}</p><p className="text-xs text-slate-400">{row.store_type} · {row.shop_slug}</p></div> },
    { key: "health", header: "Health", sortable: true, sortValue: (row) => row.health, render: (row) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${HEALTH_TONES[row.health]}`}>{row.health_label}</span> },
    { key: "revenue", header: "Store sales", sortable: true, sortValue: (row) => row.revenue, render: (row) => <div><Money value={row.revenue} /><p className="text-xs text-slate-400">{row.sales} sales</p></div> },
    { key: "online", header: "Online", sortable: true, sortValue: (row) => row.online_gmv, render: (row) => <div><Money value={row.online_gmv} /><p className="text-xs text-slate-400">{row.online_orders} orders</p></div> },
    { key: "commission", header: "Commission", sortable: true, sortValue: (row) => row.commission, render: (row) => <div><Money value={row.commission} /><p className="text-xs text-orange-600"><Money value={row.commission_outstanding} /> due</p></div> },
    { key: "catalog", header: "Catalog", sortable: true, sortValue: (row) => row.products, render: (row) => <div><p>{row.products} products</p><p className="text-xs text-red-600">{row.out_of_stock} out</p></div> },
    { key: "last_sale", header: "Last sale", sortable: true, sortValue: (row) => row.last_sale_at || "", render: (row) => formatReportDate(row.last_sale_at) },
  ];

  return (
    <PagePanel title={healthOnly ? "Stores requiring attention" : "Store performance"}>
      <div className="mb-3 flex justify-end"><TableToolbar search={search} onSearch={setSearch} count={filtered.length} actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />} /></div>
      <DataTable rows={filtered} columns={columns} rowKey={(row) => row.store_id} filterKey={`${search}|${healthOnly}`} emptyMessage={healthOnly ? "No store health issues found." : "No matching stores."} onRowClick={(row) => onOpenStore(row.store_id)} rowAriaLabel={(row) => `Open ${row.store} details`} />
    </PagePanel>
  );
}

export default PlatformStoreReport;
