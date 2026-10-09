import BrandMark from "./BrandMark";

interface BrandLogoProps {
  tone?: "light" | "dark";
  align?: "start" | "center";
}

function BrandLogo({ tone = "dark", align = "start" }: BrandLogoProps) {
  const nameClass = tone === "dark" ? "text-white" : "text-slate-900";
  const detailClass = tone === "dark" ? "text-teal-200/80" : "text-teal-700";

  return (
    <div className={`flex items-center gap-3 ${align === "center" ? "justify-center" : "justify-start"}`}>
      <BrandMark size="lg" />
      <div className="min-w-0 text-left">
        <p className={`text-lg font-semibold tracking-wide ${nameClass}`}>MartNow</p>
        <p className={`text-[11px] font-medium uppercase tracking-[0.16em] ${detailClass}`}>
          Marketplace
        </p>
      </div>
    </div>
  );
}

export default BrandLogo;
