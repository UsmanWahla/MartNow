import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchPublicStores, productImageUrl } from "../../api";
import { getApiError } from "../../auth";
import type { PublicStore } from "../../types";

const STORE_WELLS = [
  "linear-gradient(180deg, #cdeae3 0%, #e7f4f0 100%)",
  "linear-gradient(180deg, #b7dcd3 0%, #e4f3ee 100%)",
  "linear-gradient(180deg, #d7e5c8 0%, #eef6f3 100%)",
  "linear-gradient(180deg, #9fcfc4 0%, #e2f2ec 100%)",
];

function MarketHome() {
  const [params] = useSearchParams();
  const search = params.get("q") || "";
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchPublicStores();
        setStores(data.rows);
        setError("");
      } catch (loadError) {
        setError(getApiError(loadError, "Unable to load stores"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return stores;
    }

    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(q) ||
        store.address.toLowerCase().includes(q) ||
        store.shop_slug.toLowerCase().includes(q)
    );
  }, [stores, search]);

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b1f1c_0%,#134e4a_55%,#0f766e_100%)] px-4 py-5 text-white sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">
          MarketPlace
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">All stores</h1>
        <p className="mt-1 text-sm text-teal-100/85">Pick a store and shop its catalog.</p>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-64 animate-pulse rounded-2xl bg-white/80" />
          ))}
        </div>
      ) : null}

      {!loading && visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-[#e7f6f1] px-6 py-12 text-center">
          <p className="font-semibold text-slate-800">No stores yet</p>
          <p className="mt-1 text-sm text-slate-500">Active stores will appear here.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((store, index) => (
          <Link
            key={store.id}
            to={`/shop/${store.shop_slug}`}
            className="shop-card shop-card-lift flex h-full flex-col overflow-hidden"
          >
            <div
              className="relative grid aspect-4/3 place-items-center p-5"
              style={{ background: STORE_WELLS[index % STORE_WELLS.length] }}
            >
              {store.logo_path ? (
                <img
                  src={productImageUrl(store.logo_path)}
                  alt=""
                  className="h-full max-h-40 w-full object-contain drop-shadow-sm"
                />
              ) : (
                <div className="grid h-28 w-28 place-items-center rounded-2xl bg-white/80 text-4xl font-semibold text-teal-800 shadow-sm">
                  {store.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 px-4 py-3">
              <h2 className="truncate text-base font-semibold text-slate-900">{store.name}</h2>
              <p className="line-clamp-2 text-sm text-slate-500">
                {store.address || "Local store"}
              </p>
              <p className="mt-auto pt-2 text-xs font-semibold text-teal-700">
                {store.delivery_enabled ? "Store or platform delivery" : "Platform delivery"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default MarketHome;
