import BarChart from "../../shared/BarChart";
import PagePanel from "../../shared/PagePanel";
import StatCard from "../../shared/StatCard";
import { IconProfit, IconSales, IconStock, IconUdhaar } from "../../shared/icons";
import { formatCardMoney, type StoreReport } from "../../../types";

function chartLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StoreOverviewReport({ report }: { report: StoreReport }) {
  const summary = report.summary;
  const salesPoints = report.sales_trend.slice(-8).map((row) => ({
    label: chartLabel(row.date),
    amount: row.sales,
  }));
  const profitPoints = report.sales_trend.slice(-8).map((row) => ({
    label: chartLabel(row.date),
    amount: row.profit,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross sales" value={formatCardMoney(summary.billed)} numeric={summary.billed} formatNumeric={formatCardMoney} icon={<IconSales className="h-5 w-5" />} iconWrap="bg-teal-700" border="border-teal-200 border-l-teal-600" />
        <StatCard label="Collected" value={formatCardMoney(summary.collected)} numeric={summary.collected} formatNumeric={formatCardMoney} icon={<IconSales className="h-5 w-5" />} iconWrap="bg-sky-700" border="border-sky-200 border-l-sky-600" />
        <StatCard label="Outstanding" value={formatCardMoney(summary.outstanding)} numeric={summary.outstanding} formatNumeric={formatCardMoney} icon={<IconUdhaar className="h-5 w-5" />} iconWrap="bg-orange-600" border="border-orange-200 border-l-orange-500" />
        <StatCard label="Actual FIFO cost" value={formatCardMoney(summary.cost)} numeric={summary.cost} formatNumeric={formatCardMoney} icon={<IconStock className="h-5 w-5" />} iconWrap="bg-slate-700" border="border-slate-200 border-l-slate-500" />
        <StatCard label="Gross profit" value={formatCardMoney(summary.gross_profit)} numeric={summary.gross_profit} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap={summary.gross_profit < 0 ? "bg-red-600" : "bg-emerald-700"} border={summary.gross_profit < 0 ? "border-red-200 border-l-red-500" : "border-emerald-200 border-l-emerald-600"} />
        <StatCard label="Expenses" value={formatCardMoney(summary.expenses)} numeric={summary.expenses} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-rose-600" border="border-rose-200 border-l-rose-500" />
        <StatCard label="Commission" value={formatCardMoney(summary.commission)} numeric={summary.commission} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-amber-600" border="border-amber-200 border-l-amber-500" />
        <StatCard label="Net profit" value={formatCardMoney(summary.net_profit)} numeric={summary.net_profit} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap={summary.net_profit < 0 ? "bg-red-700" : "bg-violet-700"} border={summary.net_profit < 0 ? "border-red-200 border-l-red-500" : "border-violet-200 border-l-violet-600"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Sales trend" yLabel="Amount (PKR)" xLabel="by date" emptyMessage="No recognized sales in this period." points={salesPoints} />
        <BarChart title="Gross profit trend" yLabel="Profit (PKR)" xLabel="by date" emptyMessage="No profit data in this period." color="#7c3aed" border="border-violet-200 border-l-violet-600" points={profitPoints} />
      </div>

      <PagePanel title="Profit calculation">
        <div className="grid gap-3 text-sm md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Gross sales</p>
            <p className="mt-1 font-semibold text-emerald-900">{formatCardMoney(summary.billed)}</p>
          </div>
          <span className="hidden text-slate-400 md:block">−</span>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual FIFO cost</p>
            <p className="mt-1 font-semibold text-slate-800">{formatCardMoney(summary.cost)}</p>
          </div>
          <span className="hidden text-slate-400 md:block">=</span>
          <div className="rounded-xl bg-violet-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Gross profit</p>
            <p className="mt-1 font-semibold text-violet-900">{formatCardMoney(summary.gross_profit)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Net profit = gross profit − expenses − recognized commission. Online sales are recognized after delivery.
        </p>
      </PagePanel>
    </div>
  );
}

export default StoreOverviewReport;
