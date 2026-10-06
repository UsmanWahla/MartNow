import { useEffect, useState } from "react";
import ReportDateFilter from "../../components/shared/ReportDateFilter";
import ReportTabs from "../../components/shared/ReportTabs";
import PagePanel from "../../components/shared/PagePanel";
import StoreCommissionReport from "../../components/store-admin/reports/StoreCommissionReport";
import StoreCustomerReport from "../../components/store-admin/reports/StoreCustomerReport";
import StoreInventoryReport from "../../components/store-admin/reports/StoreInventoryReport";
import StoreOperationsReport from "../../components/store-admin/reports/StoreOperationsReport";
import StoreOverviewReport from "../../components/store-admin/reports/StoreOverviewReport";
import StoreProductReport from "../../components/store-admin/reports/StoreProductReport";
import { fetchStoreReport } from "../../api";
import { getApiError } from "../../auth";
import { useToast } from "../../hooks/useToast";
import type { ReportRange, StoreReport } from "../../types";
import { currentMonthRange } from "../../utils/reporting";

type StoreReportTab = "overview" | "products" | "inventory" | "customers" | "operations" | "commission";

const TABS: { id: StoreReportTab; label: string }[] = [
  { id: "overview", label: "Sales & profit" },
  { id: "products", label: "Products" },
  { id: "inventory", label: "Inventory" },
  { id: "customers", label: "Customers" },
  { id: "operations", label: "Operations" },
  { id: "commission", label: "Commission" },
];

function Reports() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<StoreReportTab>("overview");
  const [range, setRange] = useState<ReportRange>(currentMonthRange);
  const [report, setReport] = useState<StoreReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchStoreReport({
          date_from: range.from || undefined,
          date_to: range.to || undefined,
        });
        if (active) {
          setReport(data);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          const message = getApiError(loadError, "Unable to load reports");
          setError(message);
          showToast(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => { active = false; };
  }, [range.from, range.to, showToast]);

  const exported = () => showToast("Report CSV downloaded", "success");

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ReportTabs tabs={TABS} value={tab} onChange={setTab} />
        <ReportDateFilter value={range} onChange={setRange} loading={loading} />
      </div>

      {error && !report ? <PagePanel><p className="text-sm text-red-700">{error}</p></PagePanel> : null}
      {loading && !report ? <PagePanel><div className="h-56 animate-pulse rounded-xl bg-slate-100" /></PagePanel> : null}

      {report ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {tab === "overview" ? <StoreOverviewReport report={report} /> : null}
          {tab === "products" ? <StoreProductReport rows={report.products} range={range} onExported={exported} /> : null}
          {tab === "inventory" ? <StoreInventoryReport rows={report.inventory} range={range} onExported={exported} /> : null}
          {tab === "customers" ? <StoreCustomerReport rows={report.customers} range={range} onExported={exported} /> : null}
          {tab === "operations" ? <StoreOperationsReport report={report} range={range} onExported={exported} /> : null}
          {tab === "commission" ? <StoreCommissionReport report={report} range={range} onExported={exported} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export default Reports;
