import { useEffect, useRef, useState } from "react";
import { productImageUrl } from "../../api";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconMinus,
  IconPlus,
} from "../icons";
import type { ProductImage } from "../../types";

interface ShopImageZoomProps {
  open: boolean;
  images: ProductImage[];
  index: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

function clampScale(value: number) {
  return Math.min(4, Math.max(1, Number(value.toFixed(2))));
}

function ShopImageZoom({
  open,
  images,
  index,
  alt,
  onClose,
  onIndexChange,
}: ShopImageZoomProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const onCloseRef = useRef(onClose);
  const onIndexChangeRef = useRef(onIndexChange);
  onCloseRef.current = onClose;
  onIndexChangeRef.current = onIndexChange;

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [open, index]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
      if (event.key === "ArrowLeft") {
        onIndexChangeRef.current((index - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        onIndexChangeRef.current((index + 1) % images.length);
      }
      if (event.key === "+" || event.key === "=") {
        setScale((current) => clampScale(current + 0.35));
      }
      if (event.key === "-" || event.key === "_") {
        setScale((current) => {
          const next = clampScale(current - 0.35);
          if (next <= 1) {
            setOffset({ x: 0, y: 0 });
          }
          return next;
        });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, index, images.length]);

  if (!open || images.length === 0) {
    return null;
  }

  const current = images[Math.min(index, images.length - 1)];

  function zoomBy(delta: number) {
    setScale((currentScale) => {
      const next = clampScale(currentScale + delta);
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }

  return (
    <div className="anim-backdrop fixed inset-0 z-50 bg-black/88" role="dialog" aria-modal="true">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3 sm:p-4">
        <p className="truncate px-1 text-sm font-medium text-white/80">{alt}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => zoomBy(-0.35)}
          >
            <IconMinus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => zoomBy(0.35)}
          >
            <IconPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-800"
            onClick={onClose}
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => onIndexChange((index + 1) % images.length)}
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}

      <div
        className="flex h-full w-full items-center justify-center overflow-hidden px-4 pb-8 pt-16"
        onClick={onClose}
      >
        <img
          src={productImageUrl(current.path)}
          alt={alt}
          className={`max-h-[78vh] max-w-[92vw] select-none object-contain ${
            scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          }`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            if (scale <= 1) {
              setScale(2);
            }
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
          onPointerDown={(event) => {
            if (scale <= 1) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current) {
              return;
            }
            setOffset({
              x: drag.current.ox + (event.clientX - drag.current.x),
              y: drag.current.oy + (event.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        />
      </div>
    </div>
  );
}

export default ShopImageZoom;
