import PagePanel from "../PagePanel";
import type { PlatformStore } from "../../types";

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

function StoreOverviewTab({ store }: { store: PlatformStore }) {
  const hasCoordinates = store.latitude != null && store.longitude != null;
  const createdAt = new Date(store.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PagePanel title="Store information">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Store name" value={store.name} />
          <DetailItem label="Store type" value={store.store_type} />
          <DetailItem label="Contact person" value={store.contact_name} />
          <DetailItem label="Contact phone" value={store.contact_phone} />
          <DetailItem label="Login username" value={`@${store.username}`} />
          <DetailItem label="Created" value={createdAt} />
        </div>
      </PagePanel>

      <PagePanel title="Storefront settings">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Shop URL" value={`/shop/${store.shop_slug}`} />
          <DetailItem
            label="Delivery handling"
            value={store.delivery_enabled ? "Store delivery" : "Platform delivery"}
          />
          <DetailItem label="Commission rate" value={`${Number(store.commission_percent)}%`} />
          <DetailItem label="Business hours" value={store.business_hours} />
        </div>
        <div className="mt-3 grid gap-3">
          <DetailItem label="Description" value={store.store_description} />
          <DetailItem label="Delivery note" value={store.delivery_note} />
        </div>
      </PagePanel>

      <div className="xl:col-span-2">
        <PagePanel
          title="Location"
          actions={
            hasCoordinates ? (
              <a
                href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                Open map
              </a>
            ) : null
          }
        >
          <p className="text-sm font-medium text-slate-800">{store.address || "No address saved"}</p>
          {hasCoordinates ? (
            <p className="mt-1 text-xs text-slate-500">
              {store.latitude}, {store.longitude}
            </p>
          ) : null}
        </PagePanel>
      </div>
    </div>
  );
}

export default StoreOverviewTab;
