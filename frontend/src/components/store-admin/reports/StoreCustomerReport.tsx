import { useMemo, useState } from "react";
import DataTable, { type DataTableColumn } from "../../shared/DataTable";
import ExportCsvButton from "../../shared/ExportCsvButton";
import Money from "../../shared/Money";
import PagePanel from "../../shared/PagePanel";
import TableToolbar from "../../shared/TableToolbar";
import type { ReportRange, StoreCustomerReportRow } from "../../../types";
import { csvDateTime, csvFilename, downloadCsv } from "../../../utils/csvExport";
import { formatReportDate, matchesReportSearch, reportRangeSuffix } from "../../../utils/reporting";

interface StoreCustomerReportProps {
  rows: StoreCustomerReportRow[];
  range: ReportRange;
  onExported: () => void;
}

function StoreCustomerReport({ rows, range, onExported }: StoreCustomerReportProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => rows.filter((row) => matchesReportSearch(search, [row.customer, row.phone, row.email])),
    [rows, search]
  );

  function exportRows() {
    downloadCsv(csvFilename("customer-credit", reportRangeSuffix(range)), filtered, [
      { header: "Customer", value: (row) => row.customer },
      { header: "Phone", value: (row) => row.phone },
      { header: "Email", value: (row) => row.email },
      { header: "Orders in period", value: (row) => row.orders },
      { header: "Revenue in period", value: (row) => row.revenue },
      { header: "Paid in period", value: (row) => row.paid },
      { header: "Due from period sales", value: (row) => row.period_due },
      { header: "Current outstanding balance", value: (row) => row.current_balance },
      { header: "Last purchase", value: (row) => csvDateTime(row.last_purchase_at) },
    ]);
  }

  const columns: DataTableColumn<StoreCustomerReportRow>[] = [
    { key: "customer", header: "Customer", sortable: true, sortValue: (row) => row.customer, render: (row) => <div><p className="font-medium text-slate-800">{row.customer}</p><p className="text-xs text-slate-400">{row.phone || row.email || "No contact"}</p></div> },
    { key: "orders", header: "Orders", sortable: true, sortValue: (row) => row.orders },
    { key: "revenue", header: "Revenue", sortable: true, sortValue: (row) => row.revenue, render: (row) => <Money value={row.revenue} /> },
    { key: "paid", header: "Paid", sortable: true, sortValue: (row) => row.paid, render: (row) => <Money value={row.paid} /> },
    { key: "balance", header: "Current udhaar", sortable: true, sortValue: (row) => row.current_balance, render: (row) => <Money value={row.current_balance} className={row.current_balance > 0 ? "font-semibold text-orange-700" : "text-slate-600"} /> },
    { key: "last_purchase", header: "Last purchase", sortable: true, sortValue: (row) => row.last_purchase_at || "", render: (row) => formatReportDate(row.last_purchase_at) },
  ];

  return (
    <PagePanel title="Customers and credit">
      <div className="mb-3 flex justify-end">
        <TableToolbar search={search} onSearch={setSearch} count={filtered.length} actions={<ExportCsvButton onExport={exportRows} onSuccess={onExported} />} />
      </div>
      <DataTable rows={filtered} columns={columns} rowKey={(row) => row.customer_id} filterKey={search} emptyMessage={search ? "No matching customers." : "No customers available."} />
    </PagePanel>
  );
}

export default StoreCustomerReport;
