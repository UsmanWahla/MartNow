import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ShopOrderDetails from "../../components/shop/ShopOrderDetails";
import { fetchCustomerOrder } from "../../api";
import { getApiError } from "../../auth";
import type { ShopOrder } from "../../types";

function CustomerOrder() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrder(await fetchCustomerOrder(Number(id)));
      } catch (loadError) {
        setError(getApiError(loadError, "Order not found"));
      }
    }

    void load();
  }, [id]);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!order) {
    return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />;
  }

  return (
    <ShopOrderDetails
      order={order}
      primaryLink={order.shop_slug ? `/shop/${order.shop_slug}` : "/stores"}
      primaryLabel={order.shop_slug ? `Shop at ${order.shop_name || "store"}` : "Browse stores"}
      secondaryLink="/account/orders"
      secondaryLabel="Back to orders"
    />
  );
}

export default CustomerOrder;
