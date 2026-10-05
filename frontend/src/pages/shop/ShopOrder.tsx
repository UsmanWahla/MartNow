import { useOutletContext, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchShopOrder } from "../../api";
import { getApiError } from "../../auth";
import type { ShopOrder } from "../../types";
import type { ShopOutlet } from "../../components/shop/ShopLayout";
import ShopOrderDetails from "../../components/shop/ShopOrderDetails";

function ShopOrderPage() {
  const { slug = "", id = "" } = useParams();
  const { shopName } = useOutletContext<ShopOutlet>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrder(await fetchShopOrder(slug, Number(id)));
      } catch (loadError) {
        setError(getApiError(loadError, "Order not found"));
      }
    }

    void load();
  }, [slug, id]);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!order) {
    return <p className="text-sm text-slate-500">Loading order...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ShopOrderDetails
        order={{ ...order, shop_name: order.shop_name || shopName }}
        title="Thank you"
        primaryLink={`/shop/${slug}`}
        primaryLabel="Continue shopping"
        secondaryLink="/account/orders"
        secondaryLabel="View all orders"
      />
    </div>
  );
}

export default ShopOrderPage;
