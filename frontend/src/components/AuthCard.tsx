import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center p-5 font-sans">
      <div className="anim-fade-up surface-card flex w-full max-w-3xl overflow-hidden rounded-2xl">
        <div
          className="relative hidden w-[42%] flex-col justify-between p-8 text-white md:flex"
          style={{ background: "var(--sidebar)" }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-10 top-8 h-40 w-40 rounded-full bg-teal-500/30 blur-2xl" />
            <div className="absolute bottom-6 right-0 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />
          </div>
          <div className="relative">
            <BrandLogo />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-200/80">
              Mint Ledger
            </p>
            <h2 className="mt-4 text-2xl font-semibold leading-snug">
              Quiet tools for a busy counter.
            </h2>
          </div>
          <p className="relative text-sm leading-6 text-teal-100/75">
            Stock, sales, and udhaar in one calm shop OS.
          </p>
        </div>

        <div className="flex-1 bg-white p-8">
          <div className="mb-5 md:hidden">
            <BrandLogo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mb-6 text-slate-500">{subtitle}</p>
          {children}
          {footer ? <div className="mt-5 text-center text-sm text-slate-600">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default AuthCard;
