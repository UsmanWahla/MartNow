const SIZES = {
  xs: "h-5 w-5",
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

interface BrandMarkProps {
  size?: keyof typeof SIZES;
  className?: string;
}

function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <img
      src="/favicon.png"
      alt=""
      className={`${SIZES[size]} shrink-0 object-contain ${className}`}
    />
  );
}

export default BrandMark;
