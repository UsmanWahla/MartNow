import { useEffect, useRef, useState, type ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconWrap: string;
  border?: string;
  valueText?: string;
  delay?: number;
  numeric?: number;
  formatNumeric?: (value: number) => string;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function StatCard({
  label,
  value,
  icon,
  iconWrap,
  border = "border-slate-200 border-l-slate-400",
  valueText = "text-slate-900",
  delay = 0,
  numeric,
  formatNumeric,
}: StatCardProps) {
  const [shown, setShown] = useState(numeric ?? 0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (numeric == null) {
      return;
    }

    if (prefersReducedMotion()) {
      const frameId = requestAnimationFrame(() => {
        setShown(numeric);
        last.current = numeric;
      });
      return () => cancelAnimationFrame(frameId);
    }

    const from = last.current == null ? 0 : last.current;
    last.current = numeric;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 400);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(from + (numeric - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric]);

  const display =
    numeric == null
      ? value
      : formatNumeric
        ? formatNumeric(shown)
        : String(Math.round(shown));

  return (
    <div
      className={`anim-fade-up hover-lift flex min-h-7.25rem min-w-0 items-center gap-3.5 overflow-hidden rounded-2xl border border-l-4 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${border}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${iconWrap}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13px] font-medium text-slate-500">{label}</h3>
        <p
          className={`font-ledger mt-1.5 whitespace-nowrap text-[1.55rem] font-semibold leading-none ${valueText}`}
        >
          {display}
        </p>
      </div>
    </div>
  );
}

export default StatCard;
