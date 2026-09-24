import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Money from "../../components/Money";
import ShopButton from "../../components/shop/ShopButton";
import ShopQtyStepper from "../../components/shop/ShopQtyStepper";
import { IconChevronLeft, IconTrash } from "../../components/icons";
import {
  fetchShopCart,
  productImageUrl,
  removeShopCartItem,
  saveShopCartItem,
} from "../../api";
import { getApiError, isShopperSession, shopLoginPath } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import type { ShopCart } from "../../types";

const ROW_TONES = ["#e7f6f1", "#eef6e4", "#dcefe9", "#f3faf8"];

function ShopCartPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [cart, setCart] = useState<ShopCart>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isShopperSession()) {
      navigate(shopLoginPath(slug, `/shop/${slug}/cart`), { replace: true });
      return;
    }

    async function load() {
      try {
        setCart(await fetchShopCart(slug));
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load cart"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug, navigate, showToast]);

  async function changeQty(productId: number, quantity: number) {
    await run(async () => {
      try {
        setCart(await saveShopCartItem(slug, productId, quantity));
        window.dispatchEvent(new Event("auth-user-changed"));
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update cart"));
      }
    });
  }

  async function removeItem(productId: number) {
    await run(async () => {
      try {
        setCart(await removeShopCartItem(slug, productId));
        window.dispatchEvent(new Event("auth-user-changed"));
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to remove item"));
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading cart...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={`/shop/${slug}`}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-teal-800 shadow-sm ring-1 ring-(--hairline)"
        >
          <IconChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cart</h1>
        <p className="ml-auto text-sm text-slate-500">
          {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
        </p>
      </div>
      {cart.items.length === 0 ? (
        <div className="shop-card bg-[#e7f6f1] px-6 py-12 text-center">
          <p className="font-semibold text-slate-800">Your cart is empty</p>
          <Link to={`/shop/${slug}`} className="mt-4 inline-flex shop-btn bg-teal-700 text-white hover:bg-teal-800">
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {cart.items.map((item, index) => (
              <li
                key={item.id}
                className="shop-card flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3"
                style={{ background: ROW_TONES[index % ROW_TONES.length] }}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white sm:h-14 sm:w-14">
                  {item.image_path ? (
                    <img
                      src={productImageUrl(item.image_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.color || item.size ? (
                    <p className="truncate text-[11px] font-medium text-teal-800">
                      {[item.color, item.size].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <Money value={item.price} className="text-xs text-slate-600" />
                </div>
                <ShopQtyStepper
                  size="sm"
                  value={item.quantity}
                  min={1}
                  max={Math.max(1, item.stock)}
                  disabled={busy}
                  onChange={(quantity) => void changeQty(item.id, quantity)}
                />
                <Money value={item.line_total} className="w-14 shrink-0 text-right text-sm font-semibold text-teal-900 sm:w-16" />
                <button
                  type="button"
                  aria-label="Delete item"
                  disabled={busy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => void removeItem(item.id)}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t border-(--hairline) bg-(--page)/95 py-3 backdrop-blur-md"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/shop/${slug}/checkout`);
            }}
          >
            <p className="text-sm font-semibold text-slate-800 sm:text-base">
              Total{" "}
              <Money value={cart.total} className="text-teal-800" />
            </p>
            <ShopButton type="submit" size="sm" className="h-9 px-4">
              Payment
            </ShopButton>
          </form>
        </>
      )}
    </div>
  );
}

export default ShopCartPage;
