import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import ShopProductCard from "../../components/shop/ShopProductCard";
import type { ShopOutlet } from "../../components/shop/ShopLayout";
import { fetchShopProducts } from "../../api";
import { getApiError } from "../../auth";
import type { Product } from "../../types";

function ShopHome() {
  const { slug = "" } = useParams();
  const { shopName } = useOutletContext<ShopOutlet>();
  const [params] = useSearchParams();
  const search = params.get("q") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchShopProducts(slug, { all: true });
        setProducts(data.rows);
        setError("");
      } catch (loadError) {
        setError(getApiError(loadError, "Unable to load products"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return products;
    }

    return products.filter((product) => {
      if (product.name.toLowerCase().includes(q)) {
        return true;
      }
      if ((product.description || "").toLowerCase().includes(q)) {
        return true;
      }
      if (product.colors?.some((item) => item.name.toLowerCase().includes(q))) {
        return true;
      }
      return Boolean(product.sizes?.some((item) => item.name.toLowerCase().includes(q)));
    });
  }, [products, search]);

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b1f1c_0%,#134e4a_55%,#0f766e_100%)] px-4 py-4 text-white sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">
          Online shop
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{shopName}</h1>
          <p className="text-sm text-teal-100/85">Same stock as the counter · Cash on delivery</p>
        </div>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            {search.trim() ? `Results for “${search.trim()}”` : "Products"}
          </h2>
          <p className="text-sm text-slate-500">
            {loading ? "Loading catalog..." : `${visible.length} item${visible.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="overflow-hidden rounded-2xl bg-white/80">
              <div className="aspect-4/3 animate-pulse bg-teal-100/70" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-1/3 animate-pulse rounded bg-teal-100" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-[#e7f6f1] px-6 py-12 text-center">
          <p className="font-semibold text-slate-800">
            {search ? "No matching products" : "No products yet"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {search ? "Try a different name." : "This shop has not listed any items."}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 items-stretch gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((product, index) => (
          <ShopProductCard key={product.id} slug={slug} product={product} tone={index} />
        ))}
      </div>
    </div>
  );
}

export default ShopHome;
