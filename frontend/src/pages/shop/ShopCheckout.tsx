import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Field from "../../components/Field";
import Money from "../../components/Money";
import ShopButton from "../../components/shop/ShopButton";
import { IconChevronLeft, IconShop, IconTruck } from "../../components/icons";
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
import type { ShopCart } from "../../types";
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
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
        setForm({
          name: profile.name || user?.name || "",
          email: profile.email || user?.email || "",
          phone: profile.phone || "",
          address: profile.address || "",
          city: profile.city || "",
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
          <p className="mb-3 text-sm font-semibold text-slate-800">Delivery address</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Full name"
                value={form.name}
                error={errors.name}
                onChange={(name) => patchForm({ name }, "name")}
              />
            </div>
            <Field
              label="Email"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(email) => patchForm({ email }, "email")}
            />
            <Field
              label="Phone"
              value={form.phone}
              error={errors.phone}
              onChange={(phone) => patchForm({ phone }, "phone")}
            />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold">Address</label>
              <textarea
                className={`${fieldInputClass(errors.address)} min-h-4.5rem resize-y`}
                rows={2}
                value={form.address}
                aria-invalid={Boolean(errors.address)}
                onChange={(event) => patchForm({ address: event.target.value }, "address")}
              />
              {errors.address ? <p className="field-error-text">{errors.address}</p> : null}
            </div>
            <Field
              label="City"
              value={form.city}
              error={errors.city}
              onChange={(city) => patchForm({ city }, "city")}
            />
          </div>

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

        <aside className="shop-card lg:sticky lg:top-4.5rem lg:self-start">
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
                    <p className="text-[10px] text-slate-500">× {item.quantity}</p>
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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-(--hairline)] bg-(--page)/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
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
