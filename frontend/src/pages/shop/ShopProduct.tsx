import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Money from "../../components/Money";
import ShopButton from "../../components/shop/ShopButton";
import ShopImageZoom from "../../components/shop/ShopImageZoom";
import ShopGalleryDots from "../../components/shop/ShopGalleryDots";
import ShopQtyStepper from "../../components/shop/ShopQtyStepper";
import { IconChevronLeft, IconExpand } from "../../components/icons";
import { addShopCartItem, fetchShopProduct, productImageUrl } from "../../api";
import { getApiError, isShopperSession, shopLoginPath } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import type { Product } from "../../types";
import { findVariantStock, hasVariantOptions, variantLabel } from "../../variantStock";

function ShopProduct() {
  const { slug = "", id = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [optionError, setOptionError] = useState("");
  const [error, setError] = useState("");
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchShopProduct(slug, Number(id));
        setProduct(data.product);
        setActiveImage(0);
        setZoomOpen(false);
        setColor("");
        setSize("");
        setQuantity(1);
        setOptionError("");
        setError("");
      } catch (loadError) {
        setError(getApiError(loadError, "Product not found"));
      }
    }

    void load();
  }, [slug, id]);

  const needsColor = Boolean(product?.colors?.length);
  const needsSize = Boolean(product?.sizes?.length);
  const optionReady = (!needsColor || Boolean(color)) && (!needsSize || Boolean(size));
  const available = product
    ? optionReady
      ? findVariantStock(product, color, size)
      : Number(product.stock)
    : 1;

  function missingOptionMessage() {
    if (needsColor && !color && needsSize && !size) {
      return "Choose a color and size";
    }
    if (needsColor && !color) {
      return "Choose a color";
    }
    if (needsSize && !size) {
      return "Choose a size";
    }
    return "";
  }

  useEffect(() => {
    const max = Math.max(1, available);
    setQuantity((current) => Math.min(current, max));
  }, [available]);

  async function handleAdd() {
    if (!isShopperSession()) {
      navigate(shopLoginPath(slug, `/shop/${slug}/product/${id}`));
      return;
    }

    const message = missingOptionMessage();
    if (message) {
      setOptionError(message);
      return;
    }

    setOptionError("");

    await run(async () => {
      try {
        await addShopCartItem(slug, {
          product_id: Number(id),
          quantity,
          color,
          size,
        });
        showToast("Added to cart", "success");
        window.dispatchEvent(new Event("auth-user-changed"));
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add to cart"));
      }
    });
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (!product) {
    return <p className="text-sm text-slate-500">Loading product...</p>;
  }

  const outOfStock = product
    ? hasVariantOptions(product)
      ? optionReady
        ? available <= 0
        : Number(product.stock) <= 0
      : Number(product.stock) <= 0
    : true;

  const images =
    product.images && product.images.length > 0
      ? product.images
      : product.image_path
        ? [{ id: 0, path: product.image_path }]
        : [];

  function showImage(index: number) {
    setActiveImage(index);
    const frame = galleryRef.current?.children[index] as HTMLElement | undefined;
    frame?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  function handleGalleryScroll() {
    const root = galleryRef.current;

    if (!root || root.clientWidth === 0) {
      return;
    }

    const index = Math.round(root.scrollLeft / root.clientWidth);
    setActiveImage(Math.min(images.length - 1, Math.max(0, index)));
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl items-start gap-4 md:grid-cols-2 md:gap-5">
      <div className="shop-card shop-card-lift relative w-full overflow-hidden">
        <Link
          to={`/shop/${slug}`}
          aria-label="Back"
          className="absolute left-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-teal-800 shadow-md"
        >
          <IconChevronLeft className="h-5 w-5" />
        </Link>
        {images.length > 0 ? (
          <button
            type="button"
            aria-label="Open image"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-teal-800 shadow-md"
            onClick={() => setZoomOpen(true)}
          >
            <IconExpand className="h-4 w-4" />
          </button>
        ) : null}
        <div className="shop-card-media relative">
          {images.length > 0 ? (
            <div
              ref={galleryRef}
              className="shop-scroll shop-scroll-gallery"
              onScroll={handleGalleryScroll}
            >
              {images.map((image, index) => (
                <button
                  key={`${image.id}-${image.path}`}
                  type="button"
                  className="aspect-4/3 w-full cursor-zoom-in border-0 bg-transparent p-0 sm:aspect-square"
                  onClick={() => {
                    setActiveImage(index);
                    setZoomOpen(true);
                  }}
                >
                  <img
                    src={productImageUrl(image.path)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid aspect-4/3 place-items-center text-sm text-teal-800/40 sm:aspect-square">
              No image
            </div>
          )}
          <ShopGalleryDots count={images.length} active={activeImage} />
        </div>
        {images.length > 1 ? (
          <div className="shop-scroll bg-[#dcefe9] p-2">
            {images.map((image, index) => (
              <button
                key={`${image.id}-${image.path}`}
                type="button"
                className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${
                  index === activeImage ? "border-teal-600" : "border-white"
                }`}
                onClick={() => showImage(index)}
              >
                <img src={productImageUrl(image.path)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="shop-card h-fit overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#0b1f1c_0%,#0f766e_100%)] px-3 py-2.5 text-white sm:px-4">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{product.name}</h1>
          </div>
          <div className="bg-[linear-gradient(180deg,#f3faf8_0%,#ffffff_70%)] p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#d7efe9] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">Price</p>
                <p className="mt-0.5 text-xl font-semibold text-teal-900">
                  <Money value={product.price} />
                </p>
              </div>
              <div className={`rounded-xl px-3 py-2.5 ${available <= 0 ? "bg-orange-50" : "bg-[#e7f4e4]"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">Stock</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  {hasVariantOptions(product) && !optionReady
                    ? `Choose ${needsColor && needsSize ? "color & size" : needsColor ? "a color" : "a size"}`
                    : available <= 0
                      ? "Out of stock"
                      : `${available} in stock`}
                </p>
                {variantLabel(color, size) ? (
                  <p className="mt-0.5 text-xs font-medium text-teal-800">{variantLabel(color, size)}</p>
                ) : null}
              </div>
            </div>

            {product.description ? (
              <div className="mt-3 rounded-2xl bg-[#eef6e4] p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">
                  Description
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-700">{product.description}</p>
              </div>
            ) : null}

            {product.colors && product.colors.length > 0 ? (
              <div className={`mt-3 rounded-xl bg-[#e7f6f1] p-2.5 ${optionError && !color ? "ring-1 ring-red-400" : ""}`}>
                <p className="mb-1.5 text-xs font-semibold text-teal-900">
                  Color{color ? <span className="font-medium text-teal-700"> · {color}</span> : null}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.colors.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
                        color === item.name
                          ? "border-teal-600 bg-white text-teal-800"
                          : "border-transparent bg-white/70 text-slate-700"
                      }`}
                      onClick={() => {
                        setColor(item.name);
                        setOptionError("");
                      }}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ background: item.hex }}
                      />
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {product.sizes && product.sizes.length > 0 ? (
              <div className={`mt-2.5 rounded-xl bg-[#dcefe9] p-2.5 ${optionError && !size ? "ring-1 ring-red-400" : ""}`}>
                <p className="mb-1.5 text-xs font-semibold text-teal-900">
                  Size{size ? <span className="font-medium text-teal-700"> · {size}</span> : null}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.sizes.map((item) => {
                    const sizeStock = color || !needsColor
                      ? findVariantStock(product, color, item.name)
                      : null;
                    const soldOut = sizeStock === 0;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2.5 text-xs font-semibold ${
                          size === item.name
                            ? "border-teal-600 bg-white text-teal-800"
                            : soldOut
                              ? "border-transparent bg-white/50 text-slate-400"
                              : "border-transparent bg-white/70 text-slate-700"
                        }`}
                        onClick={() => {
                          setSize(item.name);
                          setOptionError("");
                        }}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <form
              className="mt-3 flex items-center justify-between gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAdd();
              }}
            >
              <ShopQtyStepper
                size="sm"
                value={quantity}
                min={1}
                max={Math.max(1, available)}
                disabled={outOfStock || busy}
                onChange={setQuantity}
              />
              <ShopButton
                type="submit"
                size="sm"
                loading={busy}
                disabled={outOfStock}
                className="h-8 shrink-0 px-3 text-xs"
              >
                {busy
                  ? "Adding..."
                  : hasVariantOptions(product) && !optionReady
                    ? "Choose option"
                    : outOfStock
                      ? "Out of stock"
                      : "Add to cart"}
              </ShopButton>
            </form>
            {optionError ? (
              <p className="mt-2 text-sm font-medium text-red-600">{optionError}</p>
            ) : null}
          </div>
        </div>

      <ShopImageZoom
        open={zoomOpen}
        images={images}
        index={activeImage}
        alt={product.name}
        onClose={() => setZoomOpen(false)}
        onIndexChange={showImage}
      />
    </div>
  );
}

export default ShopProduct;
