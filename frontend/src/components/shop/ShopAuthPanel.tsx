import type { ReactNode } from "react";
import { IconShop } from "../icons";

interface ShopAuthPanelProps {
  shopName: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

function ShopAuthPanel({
  shopName,
  title,
  subtitle,
  children,
  footer,
}: ShopAuthPanelProps) {
  return (
    <div className="anim-fade-up mx-auto grid w-full max-w-4xl overflow-hidden rounded-2xl surface-card lg:grid-cols-[0.9fr_1.1fr]">
      <div
        className="relative hidden flex-col justify-between p-8 text-white lg:flex"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-10 top-8 h-40 w-40 rounded-full bg-teal-500/30 blur-2xl" />
          <div className="absolute bottom-6 right-0 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
        </div>
        <div className="relative">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600">
            <IconShop className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-200/80">
            Online shop
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug">{shopName}</h2>
        </div>
        <p className="relative text-sm leading-6 text-teal-100/75">
          Browse stock from this shop, check out with cash on delivery, and track your order.
        </p>
      </div>
      <div className="bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
        {children}
        <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>
      </div>
    </div>
  );
}

export default ShopAuthPanel;
