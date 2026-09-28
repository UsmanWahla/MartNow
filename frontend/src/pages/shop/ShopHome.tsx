import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import ShopProductCard from "../../components/shop/ShopProductCard";
import type { ShopOutlet } from "../../components/shop/ShopLayout";
import { fetchShopProducts, productImageUrl } from "../../api";
import { getApiError } from "../../auth";
import type { Product } from "../../types";

type ShopSort = "featured" | "newest" | "price-low" | "price-high";

function ShopHome() {
  const { slug = "" } = useParams();
  const { shopName, shopMeta } = useOutletContext<ShopOutlet>();
  const [params] = useSearchParams();
  const search = params.get("q") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sort, setSort] = useState<ShopSort>("featured");

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

  const categories = useMemo(() => {
    const labels = new Map<string, string>();

    products.forEach((product) => {
      const category = product.category?.trim();

      if (category) {
        labels.set(category.toLowerCase(), category);
      }
    });

    return [...labels.values()].sort((left, right) => left.localeCompare(right));
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matching = products.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.description || "").toLowerCase().includes(q) ||
        product.colors?.some((item) => item.name.toLowerCase().includes(q)) ||
        product.sizes?.some((item) => item.name.toLowerCase().includes(q));
      const matchesCategory =
        !selectedCategory || product.category?.toLowerCase() === selectedCategory.toLowerCase();

      return Boolean(matchesSearch && matchesCategory);
    });

    return [...matching].sort((left, right) => {
      if (sort === "price-low") {
        return Number(left.price) - Number(right.price);
      }

      if (sort === "price-high") {
        return Number(right.price) - Number(left.price);
      }

      if (sort === "newest") {
        return right.id - left.id;
      }

      return Number(right.featured) - Number(left.featured) || right.id - left.id;
    });
  }, [products, search, selectedCategory, sort]);

  const featuredProducts = visible.filter((product) => product.featured).slice(0, 5);
  const directionsUrl =
    shopMeta.latitude != null && shopMeta.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${shopMeta.latitude},${shopMeta.longitude}`
      : "";

  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b1f1c_0%,#134e4a_55%,#0f766e_100%)] px-4 py-4 text-white sm:px-6 sm:py-5">
        {shopMeta.banner_path ? (
          <img
            src={productImageUrl(shopMeta.banner_path)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        ) : null}
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">
            {shopMeta.store_type || "Online shop"}
          </p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 text-base font-semibold text-teal-800 shadow-sm sm:h-12 sm:w-12">
                {shopMeta.logo_path ? (
                  <img
                    src={productImageUrl(shopMeta.logo_path)}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  shopName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{shopName}</h1>
                {shopMeta.store_description ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-teal-100/90">
                    {shopMeta.store_description}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-teal-100/85">Counter stock and cash on delivery</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-teal-50">
            {shopMeta.address ? (
              <span className="rounded-full bg-white/10 px-2.5 py-1">{shopMeta.address}</span>
            ) : null}
            {shopMeta.delivery_note ? (
              <span className="rounded-full bg-white/10 px-2.5 py-1">{shopMeta.delivery_note}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">Cash on delivery</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Delivery</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {shopMeta.delivery_enabled ? "Store delivery available" : "Platform delivery"}
          </p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Business hours</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
            {shopMeta.business_hours || "Contact store for hours"}
          </p>
        </div>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 transition hover:bg-teal-100"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Visit store</p>
            <p className="mt-0.5 text-sm font-semibold text-teal-900">Get directions</p>
          </a>
        ) : (
          <div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Store location</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{shopMeta.address || "Contact store"}</p>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            {search.trim() ? `Results for "${search.trim()}"` : "Products"}
          </h2>
          <p className="text-sm text-slate-500">
            {loading ? "Loading catalog..." : `${visible.length} item${visible.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <label className="text-sm font-medium text-slate-600">
          Sort by
          <select
            className="field-input mt-1.5 min-w-44 py-2 text-sm"
            value={sort}
            onChange={(event) => setSort(event.target.value as ShopSort)}
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
      </div>

      {categories.length ? (
        <div className="shop-scroll -mx-1 px-1 pb-1">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              !selectedCategory ? "bg-teal-700 text-white" : "bg-white text-slate-600 hover:bg-teal-50"
            }`}
            onClick={() => setSelectedCategory("")}
          >
            All products
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                selectedCategory.toLowerCase() === category.toLowerCase()
                  ? "bg-teal-700 text-white"
                  : "bg-white text-slate-600 hover:bg-teal-50"
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

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
            {search || selectedCategory ? "No matching products" : "No products yet"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {search || selectedCategory ? "Try a different search or category." : "This shop has not listed any items."}
          </p>
        </div>
      ) : null}

      {!loading && featuredProducts.length ? (
        <section>
          <div className="mb-2">
            <h2 className="text-base font-semibold text-slate-900">Featured picks</h2>
            <p className="text-sm text-slate-500">Handpicked by {shopName}</p>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {featuredProducts.map((product, index) => (
              <ShopProductCard key={product.id} slug={slug} product={product} tone={index} />
            ))}
          </div>
        </section>
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
