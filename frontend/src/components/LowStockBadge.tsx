function LowStockBadge({
  stock,
  threshold = 3,
}: {
  stock: number;
  threshold?: number;
}) {
  if (stock >= threshold) {
    return null;
  }

  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      Low
    </span>
  );
}

export default LowStockBadge;
