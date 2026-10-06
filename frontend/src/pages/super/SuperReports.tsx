import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReportDateFilter from "../../components/shared/ReportDateFilter";
import ReportTabs from "../../components/shared/ReportTabs";
import PagePanel from "../../components/shared/PagePanel";
import PlatformDeliveryReport from "../../components/super/reports/PlatformDeliveryReport";
import PlatformOverviewReport from "../../components/super/reports/PlatformOverviewReport";
import PlatformStoreReport from "../../components/super/reports/PlatformStoreReport";
import PlatformStoreTypeReport from "../../components/super/reports/PlatformStoreTypeReport";
import { fetchPlatformReport } from "../../api";
import { getApiError } from "../../auth";
import { useToast } from "../../hooks/useToast";
import type { PlatformReport, ReportRange } from "../../types";
import { currentMonthRange } from "../../utils/reporting";

type PlatformReportTab = "overview" | "stores" | "health" | "delivery" | "store_types";

const TABS: { id: PlatformReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stores", label: "Store performance" },
  { id: "health", label: "Store health" },
  { id: "delivery", label: "Delivery" },
  { id: "store_types", label: "Store types" },
];

function SuperReports() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState<PlatformReportTab>("overview");
  const [range, setRange] = useState<ReportRange>(currentMonthRange);
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchPlatformReport({
          date_from: range.from || undefined,
          date_to: range.to || undefined,
        });

        if (active) {
          setReport(data);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          const message = getApiError(loadError, "Unable to load platform analytics");
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

      {error && !report ? (
        <PagePanel><p className="text-sm text-red-700">{error}</p></PagePanel>
      ) : null}
      {loading && !report ? (
        <PagePanel><div className="h-56 animate-pulse rounded-xl bg-slate-100" /></PagePanel>
      ) : null}

      {report ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {tab === "overview" ? <PlatformOverviewReport report={report} /> : null}
          {tab === "stores" ? (
            <PlatformStoreReport
              rows={report.stores}
              range={range}
              onExported={exported}
              onOpenStore={(storeId) => navigate(`/super/stores/${storeId}`)}
            />
          ) : null}
          {tab === "health" ? (
            <PlatformStoreReport
              rows={report.stores}
              range={range}
              healthOnly
              onExported={exported}
              onOpenStore={(storeId) => navigate(`/super/stores/${storeId}`)}
            />
          ) : null}
          {tab === "delivery" ? (
            <PlatformDeliveryReport report={report} range={range} onExported={exported} />
          ) : null}
          {tab === "store_types" ? (
            <PlatformStoreTypeReport rows={report.store_types} range={range} onExported={exported} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SuperReports;
