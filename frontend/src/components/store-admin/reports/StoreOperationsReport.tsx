import ExportCsvButton from "../../shared/ExportCsvButton";
import PagePanel from "../../shared/PagePanel";
import StatCard from "../../shared/StatCard";
import { IconBox, IconSales, IconTruck } from "../../shared/icons";
import type { ReportRange, StoreReport } from "../../../types";
import { csvFilename, downloadCsv } from "../../../utils/csvExport";
import { reportRangeSuffix } from "../../../utils/reporting";

interface StoreOperationsReportProps {
  report: StoreReport;
  range: ReportRange;
  onExported: () => void;
}

function StoreOperationsReport({ report, range, onExported }: StoreOperationsReportProps) {
  const operations = report.operations;
  const statusRows = [
    { status: "Pending", orders: operations.pending },
    { status: "Processing", orders: operations.processing },
    { status: "Dispatched", orders: operations.dispatched },
    { status: "Delivered", orders: operations.delivered },
    { status: "Cancelled", orders: operations.cancelled },
  ];
  const maxOrders = Math.max(...statusRows.map((row) => row.orders), 1);

  function exportRows() {
    downloadCsv(csvFilename("order-operations", reportRangeSuffix(range)), statusRows, [
      { header: "Status", value: (row) => row.status },
      { header: "Orders", value: (row) => row.orders },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="POS sales" value={operations.pos_sales} numeric={operations.pos_sales} icon={<IconSales className="h-5 w-5" />} iconWrap="bg-slate-700" />
        <StatCard label="Online orders" value={operations.online_orders} numeric={operations.online_orders} icon={<IconBox className="h-5 w-5" />} iconWrap="bg-teal-700" />
        <StatCard label="Store delivery" value={operations.store_delivery} numeric={operations.store_delivery} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-sky-700" />
        <StatCard label="Platform delivery" value={operations.platform_delivery} numeric={operations.platform_delivery} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-indigo-700" />
      </div>

      <PagePanel title="Online order flow" actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />}>
        <div className="space-y-3">
          {statusRows.map((row) => (
            <div key={row.status} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="font-medium text-slate-600">{row.status}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${row.status === "Cancelled" ? "bg-red-500" : row.status === "Delivered" ? "bg-emerald-600" : "bg-teal-600"}`} style={{ width: `${Math.max(row.orders > 0 ? 4 : 0, (row.orders / maxOrders) * 100)}%` }} />
              </div>
              <span className="font-ledger text-right font-semibold text-slate-700">{row.orders}</span>
            </div>
          ))}
        </div>
      </PagePanel>
    </div>
  );
}

export default StoreOperationsReport;
