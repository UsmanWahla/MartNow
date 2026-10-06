import DataTable, { type DataTableColumn } from "../../shared/DataTable";
import ExportCsvButton from "../../shared/ExportCsvButton";
import Money from "../../shared/Money";
import PagePanel from "../../shared/PagePanel";
import type { PlatformReport, ReportRange } from "../../../types";
import { csvFilename, downloadCsv } from "../../../utils/csvExport";
import { reportRangeSuffix } from "../../../utils/reporting";

type StoreTypeRow = PlatformReport["store_types"][number];

interface PlatformStoreTypeReportProps {
  rows: StoreTypeRow[];
  range: ReportRange;
  onExported: () => void;
}

function PlatformStoreTypeReport({ rows, range, onExported }: PlatformStoreTypeReportProps) {
  function exportRows() {
    downloadCsv(csvFilename("store-type-performance", reportRangeSuffix(range)), rows, [
      { header: "Store type", value: (row) => row.store_type },
      { header: "Stores", value: (row) => row.stores },
      { header: "Active stores", value: (row) => row.active_stores },
      { header: "Sales", value: (row) => row.sales },
      { header: "Store revenue", value: (row) => row.revenue },
      { header: "Online orders", value: (row) => row.online_orders },
      { header: "Online GMV", value: (row) => row.online_gmv },
      { header: "Commission", value: (row) => row.commission },
    ]);
  }

  const columns: DataTableColumn<StoreTypeRow>[] = [
    {
      key: "store_type",
      header: "Store type",
      sortable: true,
      sortValue: (row) => row.store_type,
      render: (row) => <span className="font-medium text-slate-800">{row.store_type}</span>,
    },
    {
      key: "stores",
      header: "Stores",
      sortable: true,
      sortValue: (row) => row.stores,
      render: (row) => (
        <div>
          <p className="font-ledger">{row.stores}</p>
          <p className="text-xs text-emerald-700">{row.active_stores} active</p>
        </div>
      ),
    },
    {
      key: "revenue",
      header: "Store sales",
      sortable: true,
      sortValue: (row) => row.revenue,
      render: (row) => (
        <div>
          <Money value={row.revenue} />
          <p className="text-xs text-slate-400">{row.sales} sales</p>
        </div>
      ),
    },
    {
      key: "online_gmv",
      header: "Online GMV",
      sortable: true,
      sortValue: (row) => row.online_gmv,
      render: (row) => (
        <div>
          <Money value={row.online_gmv} />
          <p className="text-xs text-slate-400">{row.online_orders} orders</p>
        </div>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      sortable: true,
      sortValue: (row) => row.commission,
      render: (row) => <Money value={row.commission} />,
    },
  ];

  return (
    <PagePanel
      title="Store type performance"
      actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />}
    >
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.store_type}
        emptyMessage="No store type data is available for this period."
        pageSize={8}
      />
    </PagePanel>
  );
}

export default PlatformStoreTypeReport;
