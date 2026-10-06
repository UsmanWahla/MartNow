import ExportCsvButton from "../../shared/ExportCsvButton";
import PagePanel from "../../shared/PagePanel";
import StatCard from "../../shared/StatCard";
import { IconLedger, IconPay, IconProfit } from "../../shared/icons";
import { formatCardMoney, type ReportRange, type StoreReport } from "../../../types";
import { csvFilename, downloadCsv } from "../../../utils/csvExport";
import { reportRangeSuffix } from "../../../utils/reporting";

interface StoreCommissionReportProps {
  report: StoreReport;
  range: ReportRange;
  onExported: () => void;
}

function StoreCommissionReport({ report, range, onExported }: StoreCommissionReportProps) {
  const commission = report.commission;
  const rows = [
    { item: "Current commission rate", amount: commission.rate, unit: "%" },
    { item: "Charged in selected period", amount: commission.charged, unit: "PKR" },
    { item: "Paid in selected period", amount: commission.paid, unit: "PKR" },
    { item: "Reversed in selected period", amount: commission.reversed, unit: "PKR" },
    { item: "Recognized commission", amount: commission.recognized, unit: "PKR" },
    { item: "Current outstanding", amount: commission.outstanding, unit: "PKR" },
  ];

  function exportRows() {
    downloadCsv(csvFilename("commission-report", reportRangeSuffix(range)), rows, [
      { header: "Item", value: (row) => row.item },
      { header: "Amount", value: (row) => row.amount },
      { header: "Unit", value: (row) => row.unit },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current rate" value={`${commission.rate}%`} numeric={commission.rate} formatNumeric={(value) => `${Math.round(value * 100) / 100}%`} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-sky-700" />
        <StatCard label="Period charged" value={formatCardMoney(commission.charged)} numeric={commission.charged} formatNumeric={formatCardMoney} icon={<IconProfit className="h-5 w-5" />} iconWrap="bg-amber-700" />
        <StatCard label="Period paid" value={formatCardMoney(commission.paid)} numeric={commission.paid} formatNumeric={formatCardMoney} icon={<IconPay className="h-5 w-5" />} iconWrap="bg-emerald-700" />
        <StatCard label="Current outstanding" value={formatCardMoney(commission.outstanding)} numeric={commission.outstanding} formatNumeric={formatCardMoney} icon={<IconLedger className="h-5 w-5" />} iconWrap="bg-teal-800" />
      </div>
      <PagePanel title="Commission reconciliation" actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />}>
        <p className="text-sm leading-6 text-slate-600">
          Recognized commission is charged commission minus reversals for the selected period. Payments reduce the current outstanding balance, but do not reduce the commission expense used in net profit.
        </p>
      </PagePanel>
    </div>
  );
}

export default StoreCommissionReport;
