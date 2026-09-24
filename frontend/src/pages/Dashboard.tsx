import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconBox, IconProfit, IconSales, IconStock, IconUdhaar } from "../components/icons";
import BarChart from "../components/BarChart";
import PieChart from "../components/PieChart";
import StatCard from "../components/StatCard";
import PeriodToggle from "../components/PeriodToggle";
import { useToast } from "../hooks/useToast";
import { getApiError, getUser } from "../auth";
import { fetchDashboard, fetchProducts, fetchSales } from "../api";
import { canSeeProfit, getRole } from "../roles";
import Money from "../components/Money";
import {
  formatCardMoney,
  type DashboardPeriod,
  type DashboardStats,
  type Product,
  type Sale,
} from "../types";

function inPeriod(dateValue: string, period: DashboardPeriod) {
  const date = new Date(dateValue);
  const now = new Date();

  if (period === "all") {
    return true;
  }

  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }

  if (period === "week") {
    const start = new Date(now);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - mondayOffset);
    return date >= start;
  }

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function Dashboard() {
  const { showToast } = useToast();
  const role = getRole(getUser());
  const showProfit = canSeeProfit(role);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const [nextStats, productList, saleList] = await Promise.all([
          fetchDashboard(period),
          fetchProducts({ all: true }),
          fetchSales({ all: true }),
        ]);

        setStats(nextStats);
        setProducts(productList.rows);
        setSales(saleList.rows);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load dashboard data"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [period, showToast]);

  const salesPoints = sales
    .filter((sale) => inPeriod(sale.created_at, period))
    .slice()
    .reverse()
    .reduce<{ label: string; amount: number }[]>((points, sale) => {
      const label = new Date(sale.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const existing = points.find((point) => point.label === label);
      const amount = Number(sale.paid_amount ?? sale.total_amount);

      if (existing) {
        existing.amount += amount;
      } else {
        points.push({ label, amount });
      }

      return points;
    }, [])
    .slice(-8);

  const stockPoints = products
    .map((product) => ({
      label: product.name,
      amount: Number(product.stock),
    }))
    .sort((left, right) => right.amount - left.amount);

  const profitNegative = Number(stats?.profit) < 0;
  const netNegative = Number(stats?.netProfit) < 0;

  const cards = [
    {
      label: "Products",
      value: stats ? stats.totalProducts : "—",
      numeric: stats?.totalProducts,
      icon: <IconBox className="h-5 w-5" />,
      iconWrap: "bg-teal-700",
      border: "border-teal-200 border-l-teal-600",
    },
    {
      label: "Stock",
      value: stats ? stats.totalStock : "—",
      numeric: stats?.totalStock,
      icon: <IconStock className="h-5 w-5" />,
      iconWrap: "bg-amber-500",
      border: "border-amber-200 border-l-amber-500",
    },
    {
      label: "Sales",
      value: stats ? formatCardMoney(stats.billed) : "—",
      numeric: stats?.billed,
      formatNumeric: formatCardMoney,
      icon: <IconSales className="h-5 w-5" />,
      iconWrap: "bg-slate-600",
      border: "border-slate-200 border-l-slate-500",
    },
    {
      label: "Collected",
      value: stats ? formatCardMoney(stats.collected ?? stats.revenue) : "—",
      numeric: stats?.collected ?? stats?.revenue,
      formatNumeric: formatCardMoney,
      icon: <IconSales className="h-5 w-5" />,
      iconWrap: "bg-sky-600",
      border: "border-sky-200 border-l-sky-500",
    },
    {
      label: "Udhaar",
      value: stats ? formatCardMoney(stats.udhaar) : "—",
      numeric: stats?.udhaar,
      formatNumeric: formatCardMoney,
      icon: <IconUdhaar className="h-5 w-5" />,
      iconWrap: "bg-orange-500",
      border: "border-orange-200 border-l-orange-500",
      valueText: Number(stats?.udhaar) > 0 ? "text-orange-700" : "text-slate-900",
    },
    ...(showProfit
      ? [
          {
            label: "Gross Profit",
            value: stats ? formatCardMoney(stats.profit) : "—",
            numeric: stats?.profit,
            formatNumeric: formatCardMoney,
            icon: <IconProfit className="h-5 w-5" />,
            iconWrap: profitNegative ? "bg-red-600" : "bg-emerald-600",
            border: profitNegative
              ? "border-red-200 border-l-red-500"
              : "border-emerald-200 border-l-emerald-500",
            valueText: profitNegative ? "text-red-600" : "text-slate-900",
          },
          {
            label: "Expenses",
            value: stats ? formatCardMoney(stats.expenses) : "—",
            numeric: stats?.expenses,
            formatNumeric: formatCardMoney,
            icon: <IconProfit className="h-5 w-5" />,
            iconWrap: "bg-rose-500",
            border: "border-rose-200 border-l-rose-500",
          },
          {
            label: "Net Profit",
            value: stats ? formatCardMoney(stats.netProfit) : "—",
            numeric: stats?.netProfit,
            formatNumeric: formatCardMoney,
            icon: <IconProfit className="h-5 w-5" />,
            iconWrap: netNegative ? "bg-red-600" : "bg-violet-600",
            border: netNegative
              ? "border-red-200 border-l-red-500"
              : "border-violet-200 border-l-violet-500",
            valueText: netNegative ? "text-red-600" : "text-slate-900",
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <div className="flex justify-end">
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {stats && Number(stats.pendingOnlineOrders) > 0 ? (
        <div className="hover-lift min-w-0 rounded-2xl border border-teal-200 border-l-4 border-l-teal-600 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Online orders in progress
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {stats.pendingOnlineOrders} order
                {stats.pendingOnlineOrders === 1 ? "" : "s"} pending, processing, or
                out for delivery
              </p>
            </div>
            <Link
              to="/orders"
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Open orders
            </Link>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-70" : ""}`}>
        {cards.map((card, index) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            iconWrap={card.iconWrap}
            border={card.border}
            valueText={card.valueText}
            delay={index * 50}
            numeric={card.numeric}
            formatNumeric={card.formatNumeric}
          />
        ))}
      </div>

      {stats && stats.debtors.length > 0 ? (
        <div className="hover-lift min-w-0 rounded-2xl border border-orange-200 border-l-4 border-l-orange-500 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Outstanding udhaar
            </h3>
            <Link
              to="/customers"
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Collect
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {stats.debtors.map((debtor) => (
              <li
                key={debtor.id}
                className="flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="truncate text-sm font-medium text-slate-700">
                  {debtor.name}
                </span>
                <span className="shrink-0 text-[15px] font-semibold text-orange-600">
                  <Money value={debtor.balance} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats && stats.missingCostCount > 0 && showProfit ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <p className="text-sm font-medium text-amber-800">
            Missing cost price on {stats.missingCostCount} products
          </p>
          <p className="mt-2 truncate text-sm text-amber-700">
            {stats.missingCost.map((item) => item.name).join(", ")}
          </p>
        </div>
      ) : null}

      {stats && stats.lowStockCount > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5">
          <p className="text-sm font-medium text-red-800">
            Low stock ({stats.lowStockCount})
          </p>
          <p className="mt-2 truncate text-sm text-red-700">
            {stats.lowStock
              .map((item) => `${item.name} (${item.stock})`)
              .join(", ")}
          </p>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <BarChart
          title="Sales"
          yLabel="Amount ($)"
          xLabel="by date"
          emptyMessage="No sales to show yet."
          color="#0f766e"
          border="border-teal-200 border-l-teal-600"
          points={salesPoints}
        />
        <PieChart
          title="Stock"
          emptyMessage="No stock to show yet."
          color="#d97706"
          border="border-amber-200 border-l-amber-500"
          points={stockPoints}
        />
      </div>
    </div>
  );
}

export default Dashboard;
