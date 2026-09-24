interface ShopGalleryDotsProps {
  count: number;
  active: number;
}

function ShopGalleryDots({ count, active }: ShopGalleryDotsProps) {
  if (count <= 1) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-1 flex justify-center gap-1">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            index === active ? "w-3.5 bg-teal-700" : "w-1.5 bg-white/75"
          }`}
        />
      ))}
    </div>
  );
}

export default ShopGalleryDots;
