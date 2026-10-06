import BarChart from "../../shared/BarChart";
import PagePanel from "../../shared/PagePanel";
import StatCard from "../../shared/StatCard";
import { IconProfit, IconSales, IconShop, IconTruck } from "../../shared/icons";
import { formatCardMoney, type PlatformReport } from "../../../types";

function chartLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PlatformOverviewReport({ report }: { report: PlatformReport }) {
  const summary = report.summary;
  const gmvPoints = report.marketplace_trend.slice(-8).map((row) => ({ label: chartLabel(row.date), amount: row.gmv }));
  const earningPoints = report.marketplace_trend.slice(-8).map((row) => ({ label: chartLabel(row.date), amount: row.commission + row.delivery_fees }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active stores" value={summary.active_stores} numeric={summary.active_stores} icon={<IconShop className="h-5 w-5" />} iconWrap="bg-teal-700" />
        <StatCard label="New stores" value={summary.new_stores} numeric={summary.new_stores} icon={<IconShop className="h-5 w-5" />} iconWrap="bg-sky-700" />
        <StatCard label="Store sales" value={formatCardMoney(summary.store_sales)} numeric={summary.store_sales} formatNumeric={formatCardMoney} icon={<IconSales className="h-5 w-5" />} iconWrap="bg-emerald-700" />
        <StatCard label="Online GMV" value={formatCardMoney(summary.online_gmv)} numeric={summary.online_gmv} formatNumeric={formatCardMoney} icon={<IconSales className="h-5 w-5" />} iconWrap="bg-indigo-700" />
        <StatCard label="Commission" value={formatCardMoney(summary.commission)} numeric={summary.commission} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-amber-700" />
        <StatCard label="Commission due" value={formatCardMoney(summary.commission_outstanding)} numeric={summary.commission_outstanding} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-orange-700" />
        <StatCard label="Delivery fees" value={formatCardMoney(summary.delivery_fees)} numeric={summary.delivery_fees} formatNumeric={formatCardMoney} icon={<IconTruck className="h-5 w-5" />} iconWrap="bg-violet-700" />
        <StatCard label="Platform earnings" value={formatCardMoney(summary.platform_earnings)} numeric={summary.platform_earnings} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-teal-900" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Marketplace GMV" yLabel="Delivered sales (PKR)" xLabel="by date" emptyMessage="No delivered marketplace orders." points={gmvPoints} />
        <BarChart title="Platform earnings trend" yLabel="Commission + delivery fees" xLabel="by date" emptyMessage="No platform earnings in this period." color="#7c3aed" border="border-violet-200 border-l-violet-600" points={earningPoints} />
      </div>

      <PagePanel title="Reporting definitions">
        <p className="text-sm leading-6 text-slate-600">
          Store sales include POS sales and delivered online sales. Marketplace GMV includes delivered online orders only. Platform earnings combine recognized commission and platform delivery fees.
        </p>
      </PagePanel>
    </div>
  );
}

export default PlatformOverviewReport;
