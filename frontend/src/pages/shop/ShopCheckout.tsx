import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Field from "../../components/shared/Field";
import Money from "../../components/shared/Money";
import StoreLocationPicker from "../../components/shared/StoreLocationPicker";
import ShopButton from "../../components/shop/ShopButton";
import { IconChevronLeft, IconMapPin, IconShop, IconTruck } from "../../components/shared/icons";
import {
  fetchCheckoutProfile,
  fetchShopCart,
  fetchShopMeta,
  placeShopOrder,
  productImageUrl,
} from "../../api";
import { getApiError, getUser, isShopperSession, shopLoginPath } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import type { CustomerAddress, CustomerCheckoutProfile, ShopCart } from "../../types";
import { formatQuantity } from "../../productUnits";
import {
  collectFieldErrors,
  emailMessage,
  fieldInputClass,
  requiredMessage,
} from "../../utils/formValidate";

type DeliveryBy = "store" | "platform";

const CHECKOUT_FORM_ID = "shop-checkout-form";

function ShopCheckout() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [cart, setCart] = useState<ShopCart>({ items: [], total: 0 });
  const [shopName, setShopName] = useState("Store");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [platformFee, setPlatformFee] = useState(50);
  const [deliveryBy, setDeliveryBy] = useState<DeliveryBy>("store");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [accountProfile, setAccountProfile] = useState<CustomerCheckoutProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    address_id: null as number | null,
    latitude: "",
    longitude: "",
    save_address: false,
    address_label: "Home",
  });
  const { errors, clearError, report } = useFieldErrors();

  useEffect(() => {
    const user = getUser();

    if (!isShopperSession()) {
      navigate(shopLoginPath(slug, `/shop/${slug}/checkout`), { replace: true });
      return;
    }

    async function load() {
      try {
        const [nextCart, profile, meta] = await Promise.all([
          fetchShopCart(slug),
          fetchCheckoutProfile(slug),
          fetchShopMeta(slug),
        ]);
        setCart(nextCart);
        setShopName(meta.shop_name || "Store");
        const storeDelivers = meta.delivery_enabled !== false;
        setDeliveryEnabled(storeDelivers);
        setPlatformFee(Number(meta.platform_delivery_fee) || 50);
        setDeliveryBy(storeDelivers ? "store" : "platform");
        setAddresses(profile.addresses || []);
        setAccountProfile(profile);
        setForm({
          name: profile.name || user?.name || "",
          email: profile.email || user?.email || "",
          phone: profile.phone || "",
          address: profile.address || "",
          city: profile.city || "",
          address_id: profile.address_id || null,
          latitude: profile.latitude == null ? "" : String(profile.latitude),
          longitude: profile.longitude == null ? "" : String(profile.longitude),
          save_address: false,
          address_label: "Home",
        });

        if (nextCart.items.length === 0) {
          navigate(`/shop/${slug}/cart`, { replace: true });
        }
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load checkout"));
      }
    }

    void load();
  }, [slug, navigate, showToast]);

  const deliveryFee = deliveryBy === "platform" ? platformFee : 0;
  const payable = useMemo(
    () => Number(cart.total || 0) + Number(deliveryFee || 0),
    [cart.total, deliveryFee]
  );
  const itemCount = cart.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  async function handlePlace(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors = collectFieldErrors([
      ["name", requiredMessage(form.name, "Please enter your full name")],
      ["email", emailMessage(form.email)],
      ["phone", requiredMessage(form.phone, "Please enter your phone")],
      ["address", requiredMessage(form.address, "Please enter your delivery address")],
      ["city", requiredMessage(form.city, "Please enter your city")],
    ]);

    if (!report(nextErrors, showToast)) {
      return;
    }

    await run(async () => {
      try {
        const order = await placeShopOrder(slug, {
          ...form,
          payment_method: "cod",
          delivery_by: deliveryBy,
        });
        window.dispatchEvent(new Event("auth-user-changed"));
        navigate(`/shop/${slug}/orders/${order.id}`, { replace: true });
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to place order"));
      }
    });
  }

  function patchForm(patch: Partial<typeof form>, key: keyof typeof form) {
    setForm((current) => ({ ...current, ...patch }));
    clearError(key);
  }

  function chooseSavedAddress(address: CustomerAddress) {
    setForm((current) => ({
      ...current,
      name: address.recipient_name,
      phone: address.phone,
      address: address.address,
      city: address.city,
      address_id: address.id,
      latitude: address.latitude == null ? "" : String(address.latitude),
      longitude: address.longitude == null ? "" : String(address.longitude),
      save_address: false,
    }));
    clearError("name");
    clearError("phone");
    clearError("address");
    clearError("city");
  }

  function useDifferentAddress() {
    setForm((current) => ({
      ...current,
      name: accountProfile?.name || current.name,
      email: accountProfile?.email || current.email,
      phone: accountProfile?.phone || "",
      address: "",
      city: "",
      address_id: null,
      latitude: "",
      longitude: "",
      save_address: false,
      address_label: "Home",
    }));
  }

  function deliveryChip(active: boolean) {
    return `flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
      active
        ? "border-teal-400 bg-teal-50 text-teal-900"
        : "border-[var(--hairline)] bg-white text-slate-700 hover:border-teal-200"
    }`;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pb-16 sm:pb-4">
      <div className="mb-3 flex items-center gap-2">
        <Link
          to={`/shop/${slug}/cart`}
          aria-label="Back to cart"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-teal-800 shadow-sm ring-1 ring-(--hairline)"
        >
          <IconChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Checkout</h1>
          <p className="truncate text-xs text-slate-500">
            {shopName} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15.5rem] lg:gap-5">
        <form id={CHECKOUT_FORM_ID} className="shop-card p-4 sm:p-5" onSubmit={handlePlace}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Delivery address</p>
            <Link to="/account/addresses" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Manage addresses
            </Link>
          </div>

          {addresses.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {addresses.map((address) => {
                const selected = form.address_id === address.id;
                return (
                  <button
                    key={address.id}
                    type="button"
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-teal-500 bg-teal-50 ring-1 ring-teal-200"
                        : "border-(--hairline) bg-white hover:border-teal-200"
                    }`}
                    onClick={() => chooseSavedAddress(address)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{address.label}</span>
                      {address.is_default ? <span className="text-[10px] font-semibold text-teal-700">Default</span> : null}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{address.address}, {address.city}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`rounded-xl border border-dashed p-3 text-left text-xs font-semibold transition-colors ${
                  form.address_id == null
                    ? "border-teal-500 bg-teal-50 text-teal-800"
                    : "border-slate-300 bg-white text-slate-600 hover:border-teal-300"
                }`}
                onClick={useDifferentAddress}
              >
                + Use a different address
              </button>
            </div>
          ) : null}

          {form.address_id != null ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-800">{form.name} · {form.phone}</p>
              <p>{form.address}</p>
              <p>{form.city}</p>
              {form.latitude && form.longitude ? (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                  <IconMapPin className="h-3.5 w-3.5" /> Exact map location saved
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Receiver name"
                  value={form.name}
                  error={errors.name}
                  onChange={(name) => patchForm({ name }, "name")}
                />
              </div>
              <Field label="Email" type="email" value={form.email} disabled onChange={() => undefined} />
              <Field
                label="Phone"
                value={form.phone}
                error={errors.phone}
                onChange={(phone) => patchForm({ phone }, "phone")}
              />
              <Field
                label="City"
                value={form.city}
                error={errors.city}
                onChange={(city) => patchForm({ city }, "city")}
              />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold">Complete address</label>
                <textarea
                  className={`${fieldInputClass(errors.address)} min-h-20 resize-y`}
                  rows={3}
                  value={form.address}
                  aria-invalid={Boolean(errors.address)}
                  placeholder="House, street, area and nearby landmark"
                  onChange={(event) => patchForm({ address: event.target.value }, "address")}
                />
                {errors.address ? <p className="field-error-text">{errors.address}</p> : null}
              </div>

              <details className="rounded-xl border border-(--hairline) bg-slate-50 p-3 sm:col-span-2">
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">Select exact location on map (optional)</summary>
                <div className="mt-3">
                  <StoreLocationPicker
                    label="Search or pin delivery location"
                    searchPlaceholder="Search area, road or landmark"
                    showAdvancedCoordinates={false}
                    mapHeightClass="h-52"
                    value={{ address: form.address, latitude: form.latitude, longitude: form.longitude }}
                    onChange={({ address, latitude, longitude }) =>
                      patchForm({ address, latitude, longitude }, "address")
                    }
                  />
                </div>
              </details>

              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.save_address}
                  onChange={(event) => patchForm({ save_address: event.target.checked }, "save_address")}
                />
                Save this address for future orders
              </label>
              {form.save_address ? (
                <Field
                  label="Address label"
                  value={form.address_label}
                  placeholder="Home, Office, Parents"
                  onChange={(address_label) => patchForm({ address_label }, "address_label")}
                />
              ) : null}
            </div>
          )}

          <div className="mt-4 border-t border-(--hairline) pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">Delivered by</p>
            <div className={`flex gap-2 ${deliveryEnabled ? "flex-col sm:flex-row" : ""}`}>
              {deliveryEnabled ? (
                <button
                  type="button"
                  className={deliveryChip(deliveryBy === "store")}
                  onClick={() => setDeliveryBy("store")}
                >
                  <IconShop className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{shopName}</span>
                    <span className="text-[11px] text-slate-500">Free</span>
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                className={deliveryChip(deliveryBy === "platform")}
                onClick={() => setDeliveryBy("platform")}
              >
                <IconTruck className="h-4 w-4 shrink-0 opacity-80" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">Platform</span>
                  <span className="text-[11px] text-slate-500">
                    + <Money value={platformFee} className="inline" />
                  </span>
                </span>
              </button>
            </div>
            {!deliveryEnabled ? (
              <p className="mt-2 text-[11px] text-slate-500">Store delivery not available for this shop.</p>
            ) : null}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            <span className="font-medium text-slate-700">Cash on delivery</span> — pay when the order
            arrives. Online payment coming soon.
          </p>
        </form>

        <aside className="shop-card lg:sticky lg:top-[4.5rem] lg:self-start">
          <div className="border-b border-(--hairline) px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
          </div>
          <div className="max-h-52 overflow-y-auto px-3 py-2">
            <ul className="space-y-1.5">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-lg bg-[#f3faf8]/90 p-1.5">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-white">
                    {item.image_path ? (
                      <img
                        src={productImageUrl(item.image_path)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-500">
                      × {formatQuantity(item.quantity)} {item.sale_unit || "piece"}
                    </p>
                  </div>
                  <Money value={item.line_total} className="shrink-0 text-xs font-semibold text-teal-900" />
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5 border-t border-(--hairline) px-4 py-3 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <Money value={cart.total} />
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              {deliveryFee > 0 ? <Money value={deliveryFee} /> : <span className="text-teal-700">Free</span>}
            </div>
            <div className="flex justify-between pt-1 text-sm font-semibold text-teal-900">
              <span>Total</span>
              <Money value={payable} />
            </div>
            <ShopButton
              type="submit"
              form={CHECKOUT_FORM_ID}
              size="sm"
              block
              loading={busy}
              className="mt-2 h-9 max-lg:hidden"
            >
              {busy ? "Placing..." : "Place order"}
            </ShopButton>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-(--hairline) bg-(--page)/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Money value={payable} className="text-base font-semibold text-teal-900" />
          <ShopButton
            type="submit"
            form={CHECKOUT_FORM_ID}
            size="sm"
            loading={busy}
            className="h-9 shrink-0 px-4"
          >
            {busy ? "Placing..." : "Place order"}
          </ShopButton>
        </div>
      </div>
    </div>
  );
}

export default ShopCheckout;
