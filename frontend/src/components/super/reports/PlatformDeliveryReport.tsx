import BarChart from "../../shared/BarChart";
import ExportCsvButton from "../../shared/ExportCsvButton";
import PagePanel from "../../shared/PagePanel";
import StatCard from "../../shared/StatCard";
import { IconBox, IconTruck } from "../../shared/icons";
import { formatCardMoney, type PlatformReport, type ReportRange } from "../../../types";
import { csvFilename, downloadCsv } from "../../../utils/csvExport";
import { reportRangeSuffix } from "../../../utils/reporting";

interface PlatformDeliveryReportProps {
  report: PlatformReport;
  range: ReportRange;
  onExported: () => void;
}

function PlatformDeliveryReport({ report, range, onExported }: PlatformDeliveryReportProps) {
  const delivery = report.delivery;
  const rows = [
    { status: "Pending", orders: delivery.pending },
    { status: "Processing", orders: delivery.processing },
    { status: "Dispatched", orders: delivery.dispatched },
    { status: "Delivered", orders: delivery.delivered },
    { status: "Cancelled", orders: delivery.cancelled },
  ];
  const points = report.marketplace_trend.slice(-8).map((row) => ({
    label: new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: row.orders,
  }));

  function exportRows() {
    downloadCsv(csvFilename("delivery-operations", reportRangeSuffix(range)), rows, [
      { header: "Status", value: (row) => row.status },
      { header: "Orders", value: (row) => row.orders },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online orders" value={delivery.online_orders} numeric={delivery.online_orders} icon={<IconBox className="h-5 w-5" />} iconWrap="bg-teal-700" />
        <StatCard label="Store delivery" value={delivery.store_delivery} numeric={delivery.store_delivery} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-sky-700" />
        <StatCard label="Platform delivery" value={delivery.platform_delivery} numeric={delivery.platform_delivery} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-indigo-700" />
        <StatCard label="Delivery fees" value={formatCardMoney(delivery.delivery_fees)} numeric={delivery.delivery_fees} formatNumeric={formatCardMoney} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-violet-700" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Online order volume" yLabel="Orders" xLabel="by date" emptyMessage="No online orders in this period." points={points} />
        <PagePanel title="Delivery status" actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />}>
          <div className="divide-y divide-slate-100">
            {rows.map((row) => <div key={row.status} className="flex items-center justify-between py-3 text-sm"><span className="font-medium text-slate-600">{row.status}</span><span className="font-ledger font-semibold text-slate-800">{row.orders}</span></div>)}
          </div>
        </PagePanel>
      </div>
    </div>
  );
}

export default PlatformDeliveryReport;
