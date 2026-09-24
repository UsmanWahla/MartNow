import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import PeriodToggle from "../../components/PeriodToggle";
import PagePanel from "../../components/PagePanel";
import Money from "../../components/Money";
import { IconBox, IconProfit, IconSales, IconShop, IconTruck } from "../../components/icons";
import { useToast } from "../../hooks/useToast";
import { getApiError } from "../../auth";
import { fetchPlatformStats } from "../../api";
import { formatCardMoney, type DashboardPeriod, type PlatformStats } from "../../types";

function SuperDashboard() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        setStats(await fetchPlatformStats(period));
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load analytics"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [period, showToast]);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800">Marketplace overview</h1>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active stores"
          value={stats?.activeStores ?? "—"}
          numeric={stats?.activeStores}
          icon={<IconShop className="h-5 w-5" />}
          iconWrap="bg-teal-700"
          border="border-slate-200 border-l-teal-600"
        />
        <Link to="/super/orders" className="block">
          <StatCard
            label="Orders"
            value={stats?.orders ?? "—"}
            numeric={stats?.orders}
            icon={<IconSales className="h-5 w-5" />}
            iconWrap="bg-sky-700"
            border="border-slate-200 border-l-sky-600"
          />
        </Link>
        <StatCard
          label="Store sales"
          value={stats ? formatCardMoney(stats.revenue) : "—"}
          numeric={stats ? Number(stats.revenue) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconBox className="h-5 w-5" />}
          iconWrap="bg-emerald-700"
          border="border-slate-200 border-l-emerald-600"
        />
        <StatCard
          label="Commission"
          value={stats ? formatCardMoney(stats.commission) : "—"}
          numeric={stats ? Number(stats.commission) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-amber-700"
          border="border-slate-200 border-l-amber-600"
        />
        <Link to="/super/deliveries" className="block">
          <StatCard
            label="Delivery fees"
            value={stats ? formatCardMoney(stats.deliveryFees ?? 0) : "—"}
            numeric={stats ? Number(stats.deliveryFees ?? 0) : undefined}
            formatNumeric={formatCardMoney}
            icon={<IconTruck className="h-5 w-5" />}
            iconWrap="bg-indigo-700"
            border="border-slate-200 border-l-indigo-600"
          />
        </Link>
        <StatCard
          label="Platform earnings"
          value={stats ? formatCardMoney(stats.platformEarnings ?? 0) : "—"}
          numeric={stats ? Number(stats.platformEarnings ?? 0) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-teal-800"
          border="border-slate-200 border-l-teal-800"
        />
      </div>

      <PagePanel title="Top stores">
        {loading ? (
          <p className="text-sm text-slate-500">Loading analytics...</p>
        ) : !stats?.topStores.length ? (
          <p className="text-sm text-slate-500">No stores yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.topStores.map((store) => (
              <div key={store.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{store.name}</p>
                  <p className="text-xs text-slate-500">
                    {store.orders} orders · {store.shop_slug}
                  </p>
                </div>
                <div className="text-right">
                  <Money value={store.revenue} className="font-semibold text-teal-800" />
                  <p className="text-xs text-slate-500">
                    Fee <Money value={store.commission} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link to="/super/stores" className="mt-3 inline-block text-sm font-semibold text-teal-700">
          Manage stores
        </Link>
      </PagePanel>
    </div>
  );
}

export default SuperDashboard;
