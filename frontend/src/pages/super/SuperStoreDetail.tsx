import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getApiError } from "../../auth";
import {
  fetchPlatformCommissionLedgerSummary,
  fetchPlatformStore,
  productImageUrl,
} from "../../api";
import StoreCommissionTab from "../../components/super/StoreCommissionTab";
import StoreOrdersTab from "../../components/super/StoreOrdersTab";
import StoreOverviewTab from "../../components/super/StoreOverviewTab";
import StoreProductsTab from "../../components/super/StoreProductsTab";
import StatCard from "../../components/StatCard";
import {
  IconBox,
  IconChevronLeft,
  IconLedger,
  IconSales,
  IconShop,
} from "../../components/icons";
import { useToast } from "../../hooks/useToast";
import {
  formatCardMoney,
  type PlatformCommissionLedgerSummary,
  type PlatformStoreDetail,
} from "../../types";
import { formatQuantity } from "../../productUnits";

const tabs = ["overview", "products", "orders", "commission"] as const;
type StoreTab = (typeof tabs)[number];

const tabLabels: Record<StoreTab, string> = {
  overview: "Overview",
  products: "Products",
  orders: "Orders",
  commission: "Commission",
};

function SuperStoreDetail() {
  const { id } = useParams();
  const storeId = Number(id);
  const validStoreId = Number.isSafeInteger(storeId) && storeId > 0;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [detail, setDetail] = useState<PlatformStoreDetail | null>(null);
  const [commission, setCommission] = useState<PlatformCommissionLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestedTab = searchParams.get("tab") as StoreTab | null;
  const activeTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : "overview";

  const loadCommissionSummary = useCallback(async () => {
    if (!validStoreId) {
      return;
    }

    try {
      setCommission(await fetchPlatformCommissionLedgerSummary(storeId));
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load store commission summary"));
    }
  }, [showToast, storeId, validStoreId]);

  useEffect(() => {
    if (!validStoreId) {
      return;
    }

    async function loadStore() {
      setLoading(true);
      setError("");
      const [detailResult, commissionResult] = await Promise.allSettled([
        fetchPlatformStore(storeId),
        fetchPlatformCommissionLedgerSummary(storeId),
      ]);

      if (detailResult.status === "fulfilled") {
        setDetail(detailResult.value);
      } else {
        const message = getApiError(detailResult.reason, "Unable to load store details");
        setError(message);
        showToast(message);
      }

      if (commissionResult.status === "fulfilled") {
        setCommission(commissionResult.value);
      } else {
        setCommission(null);
        showToast(
          getApiError(commissionResult.reason, "Unable to load store commission summary")
        );
      }

      setLoading(false);
    }

    void loadStore();
  }, [showToast, storeId, validStoreId]);

  function selectTab(tab: StoreTab) {
    setSearchParams(tab === "overview" ? {} : { tab });
  }

  if (validStoreId && loading) {
    return (
      <div className="space-y-4 pb-8" aria-busy="true">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!validStoreId || !detail || error) {
    return (
      <div className="surface-card rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-red-700">
          {validStoreId ? error || "Store not found" : "Store not found"}
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={() => navigate("/super/stores")}
        >
          Back to stores
        </button>
      </div>
    );
  }

  const { store, overview } = detail;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="h-2 bg-gradient-to-r from-teal-700 via-emerald-500 to-sky-500" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800"
              aria-label="Back to stores"
              onClick={() => navigate("/super/stores")}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            {store.logo_path ? (
              <img
                src={productImageUrl(store.logo_path)}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl border border-slate-100 bg-white object-cover p-1"
              />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-teal-50 text-2xl font-bold text-teal-800">
                {store.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {store.name}
                </h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    store.status === "active"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {store.status}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">
                {store.store_type} · {store.shop_slug} · {Number(store.commission_percent)}% commission
              </p>
            </div>
          </div>
          <a
            href={`/shop/${store.shop_slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            Open storefront
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Products · ${formatQuantity(overview.stock)} units`}
          value={overview.products}
          numeric={overview.products}
          icon={<IconBox className="h-5 w-5" />}
          iconWrap="bg-sky-700"
          border="border-slate-200 border-l-sky-600"
        />
        <StatCard
          label="Orders"
          value={overview.orders}
          numeric={overview.orders}
          icon={<IconSales className="h-5 w-5" />}
          iconWrap="bg-teal-700"
          border="border-slate-200 border-l-teal-600"
        />
        <StatCard
          label="Store sales"
          value={formatCardMoney(overview.sales)}
          numeric={Number(overview.sales)}
          formatNumeric={formatCardMoney}
          icon={<IconShop className="h-5 w-5" />}
          iconWrap="bg-emerald-700"
          border="border-slate-200 border-l-emerald-600"
        />
        <StatCard
          label="Commission outstanding"
          value={commission ? formatCardMoney(commission.outstanding) : "—"}
          numeric={commission ? Number(commission.outstanding) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconLedger className="h-5 w-5" />}
          iconWrap="bg-amber-700"
          border="border-slate-200 border-l-amber-600"
        />
      </div>

      <div className="surface-card overflow-x-auto rounded-2xl p-1.5">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Store details">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
              onClick={() => selectTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === "overview" ? <StoreOverviewTab store={store} /> : null}
        {activeTab === "products" ? <StoreProductsTab storeId={store.id} /> : null}
        {activeTab === "orders" ? <StoreOrdersTab storeId={store.id} /> : null}
        {activeTab === "commission" ? (
          <StoreCommissionTab
            store={store}
            summary={commission}
            onSummaryReload={loadCommissionSummary}
          />
        ) : null}
      </div>
    </div>
  );
}

export default SuperStoreDetail;
