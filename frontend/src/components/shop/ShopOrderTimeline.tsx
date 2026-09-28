interface ShopOrderTimelineProps {
  deliveryStatus?: string | null;
}

const steps = [
  { key: "pending", label: "Order placed", description: "Your order has been received." },
  { key: "processing", label: "Preparing", description: "The store is preparing your order." },
  { key: "dispatched", label: "Dispatched", description: "Your order is on its way." },
  { key: "delivered", label: "Delivered", description: "Your order has been delivered." },
];

function activeStep(status?: string | null) {
  const value = String(status || "pending").toLowerCase();

  if (value === "delivered") {
    return 3;
  }
  if (value === "dispatched") {
    return 2;
  }
  if (value === "processing") {
    return 1;
  }
  return 0;
}

function ShopOrderTimeline({ deliveryStatus }: ShopOrderTimelineProps) {
  const cancelled = String(deliveryStatus || "").toLowerCase() === "cancelled";

  if (cancelled) {
    return (
      <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p className="font-semibold">Order cancelled</p>
        <p className="mt-0.5 text-xs leading-5 text-red-700">This order will not be delivered.</p>
      </div>
    );
  }

  const current = activeStep(deliveryStatus);

  return (
    <section className="mt-5 rounded-xl border border-teal-100 bg-[#f4fbf8] p-4">
      <p className="text-sm font-semibold text-slate-900">Order progress</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4 sm:gap-2">
        {steps.map((step, index) => {
          const complete = index <= current;
          const active = index === current;

          return (
            <li key={step.key} className="relative flex min-w-0 gap-2 sm:block sm:pr-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold sm:mb-2 ${
                  complete ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${active ? "text-teal-800" : "text-slate-700"}`}>
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default ShopOrderTimeline;
