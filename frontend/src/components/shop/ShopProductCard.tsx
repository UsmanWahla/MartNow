import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import Money from "../Money";
import ShopGalleryDots from "./ShopGalleryDots";
import { productImageUrl } from "../../api";
import type { Product } from "../../types";

interface ShopProductCardProps {
  slug: string;
  product: Product;
  tone?: number;
}

function ShopProductCard({ slug, product, tone = 0 }: ShopProductCardProps) {
  const dragged = useRef(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeImage, setActiveImage] = useState(0);
  const inStock = Number(product.stock) > 0;
  const productPath = `/shop/${slug}/product/${product.id}`;
  const wells = [
    "linear-gradient(180deg, #cdeae3 0%, #e7f4f0 100%)",
    "linear-gradient(180deg, #b7dcd3 0%, #e4f3ee 100%)",
    "linear-gradient(180deg, #d7e5c8 0%, #eef6f3 100%)",
    "linear-gradient(180deg, #9fcfc4 0%, #e2f2ec 100%)",
  ];
  const bodies = [
    "linear-gradient(180deg, #ffffff 0%, #e7f6f1 100%)",
    "linear-gradient(180deg, #ffffff 0%, #ddf3ec 100%)",
    "linear-gradient(180deg, #ffffff 0%, #f4f7e8 100%)",
    "linear-gradient(180deg, #ffffff 0%, #e0efe8 100%)",
  ];
  const well = wells[tone % wells.length];
  const body = bodies[tone % bodies.length];
  const images =
    product.images && product.images.length > 0
      ? product.images
      : product.image_path
        ? [{ id: 0, path: product.image_path }]
        : [];

  function handleGalleryScroll() {
    const root = galleryRef.current;
    dragged.current = true;

    if (!root || root.clientWidth === 0) {
      return;
    }

    const index = Math.round(root.scrollLeft / root.clientWidth);
    setActiveImage(Math.min(images.length - 1, Math.max(0, index)));
  }

  return (
    <article className="shop-card shop-card-lift flex h-full flex-col">
      <Link
        to={productPath}
        className="relative block"
        onClick={(event) => {
          if (dragged.current) {
            event.preventDefault();
          }
        }}
      >
        <div className="shop-card-media relative aspect-4/3 overflow-hidden" style={{ background: well }}>
          {images.length > 1 ? (
            <div
              ref={galleryRef}
              className="shop-scroll shop-scroll-gallery h-full"
              onPointerDown={() => {
                dragged.current = false;
              }}
              onScroll={handleGalleryScroll}
            >
              {images.map((image) => (
                <img
                  key={`${image.id}-${image.path}`}
                  src={productImageUrl(image.path)}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ))}
            </div>
          ) : images[0] ? (
            <img
              src={productImageUrl(images[0].path)}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm font-semibold text-teal-800/50">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${
              inStock ? "bg-teal-700 text-white" : "bg-white/90 text-slate-500"
            }`}
          >
            {inStock ? "In stock" : "Sold out"}
          </span>
          <ShopGalleryDots count={images.length} active={activeImage} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-2.5 py-2.5 sm:px-3" style={{ background: body }}>
        <Link to={productPath} className="min-w-0">
          <h2 className="line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-slate-900 sm:text-sm">
            {product.name}
          </h2>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <Money value={product.price} className="text-[15px] font-semibold text-teal-800 sm:text-base" />
          <Link
            to={productPath}
            className="rounded-lg bg-teal-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-800"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ShopProductCard;
