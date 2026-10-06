import { useEffect, useState, type ReactNode } from "react";
import Modal from "../shared/Modal";
import Money from "../shared/Money";
import { getApiError } from "../../auth";
import { fetchProductLedger } from "../../api";
import type { Product, ProductLedger, ProductLedgerEntry } from "../../types";
import { variantLabel } from "../../variantStock";
import { formatQuantity, unitLabel } from "../../productUnits";

const TYPE_LABELS: Record<string, string> = {
  opening: "Opening stock",
  in: "Stock in",
  sale: "Sale",
  sale_return: "Sale return",
  damage: "Damage",
  adjust: "Adjust out",
};

interface ProductLedgerModalProps {
  product: Product;
  onClose: () => void;
  onError: (message: string) => void;
}

function readableDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Metric({ label, value, tone = "slate" }: { label: string; value: ReactNode; tone?: "slate" | "teal" | "orange" | "sky" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-900",
    teal: "bg-teal-50 text-teal-800",
    orange: "bg-orange-50 text-orange-800",
    sky: "bg-sky-50 text-sky-800",
  };

  return (
    <div className={`rounded-xl px-2 py-2 text-center ${tones[tone]}`}>
      <p className="text-[11px] font-medium opacity-75">{label}</p>
      <p className="font-ledger mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SaleDetails({
  row,
  expanded,
  onToggle,
}: {
  row: ProductLedgerEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const allocations = row.allocations ?? [];

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs text-slate-500">
        Customer quantity: {formatQuantity(row.sale_quantity || row.quantity)}{" "}
        {unitLabel(row.sale_unit, row.sale_quantity || row.quantity)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label={`Sold at / ${row.sale_unit || "unit"}`}
          value={<Money value={row.unit_price || 0} />}
          tone="sky"
        />
        <Metric label="Revenue" value={<Money value={row.revenue_amount || 0} />} tone="teal" />
        <Metric label="FIFO cost" value={<Money value={row.cost_amount || 0} />} tone="orange" />
        <Metric
          label="Profit"
          value={<Money value={row.profit_amount || 0} />}
          tone={(row.profit_amount || 0) >= 0 ? "teal" : "orange"}
        />
      </div>

      {allocations.length > 0 ? (
        <>
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-teal-700 hover:text-teal-900"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            {expanded ? "Hide FIFO sources" : `Show FIFO sources (${allocations.length})`}
          </button>

          {expanded ? (
            <div className="mt-2 space-y-2">
              {allocations.map((allocation, index) => (
                <div
                  key={allocation.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        FIFO source {index + 1} · Batch #{allocation.batch_id}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Received {readableDate(allocation.received_at)}
                        {allocation.supplier ? ` · ${allocation.supplier}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {formatQuantity(allocation.quantity)} {unitLabel(allocation.base_unit, allocation.quantity)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                    <p className="text-slate-500">
                      Cost/unit <Money value={allocation.unit_cost} className="font-semibold text-slate-700" />
                    </p>
                    <p className="text-slate-500">
                      Cost <Money value={allocation.cost_amount} className="font-semibold text-orange-700" />
                    </p>
                    <p className="text-slate-500">
                      Revenue <Money value={allocation.revenue_amount} className="font-semibold text-teal-700" />
                    </p>
                    <p className="text-slate-500">
                      Profit <Money value={allocation.profit_amount} className="font-semibold text-teal-700" />
                    </p>
                  </div>
                  {allocation.batch_sale_price != null ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Sale price set when received: <Money value={allocation.batch_sale_price} />/{allocation.batch_sale_unit}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Batch allocation is unavailable for this legacy sale.</p>
      )}
    </div>
  );
}

function ProductLedgerModal({ product, onClose, onError }: ProductLedgerModalProps) {
  const [ledger, setLedger] = useState<ProductLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const nextLedger = await fetchProductLedger(product);

        if (!cancelled) {
          setLedger(nextLedger);
        }
      } catch (error) {
        if (!cancelled) {
          onError(getApiError(error, "Unable to load ledger"));
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open one product at a time
  }, [product.id]);

  const rows = ledger?.rows ?? [];
  const onHand = Number(ledger?.product.stock ?? product.stock);
  const baseUnit = ledger?.product.base_unit || product.base_unit;

  return (
    <Modal title="FIFO product ledger" wide onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">{product.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">Oldest available batch is consumed first.</p>
        </div>
        <Metric label="Current stock value" value={<Money value={ledger?.stockValue || 0} />} tone="sky" />
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <Metric
          label="On hand"
          value={`${formatQuantity(onHand)} ${unitLabel(baseUnit, onHand)}`}
        />
        <Metric
          label="Stock in"
          value={`${ledger ? formatQuantity(ledger.totalIn) : "—"} ${ledger ? unitLabel(baseUnit, ledger.totalIn) : ""}`}
          tone="teal"
        />
        <Metric
          label="Stock out"
          value={`${ledger ? formatQuantity(ledger.totalOut) : "—"} ${ledger ? unitLabel(baseUnit, ledger.totalOut) : ""}`}
          tone="orange"
        />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Metric label="Sales revenue" value={<Money value={ledger?.totalRevenue || 0} />} tone="teal" />
        <Metric label="FIFO cost" value={<Money value={ledger?.totalCost || 0} />} tone="orange" />
        <Metric
          label="Gross profit"
          value={<Money value={ledger?.totalProfit || 0} />}
          tone={(ledger?.totalProfit || 0) >= 0 ? "teal" : "orange"}
        />
      </div>

      {ledger?.product.variants &&
      ledger.product.variants.length > 0 &&
      (ledger.product.colors?.length || ledger.product.sizes?.length) ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ledger.product.variants.map((row) => (
            <span
              key={`${row.color}-${row.size}`}
              className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
            >
              {variantLabel(row.color, row.size) || "Default"} · {formatQuantity(row.stock)}
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-(--hairline) bg-[#f8fbfa] px-4 py-8 text-center text-sm text-slate-500">
          No stock history yet.
        </p>
      ) : (
        <ul className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => {
            const change = row.inbound || -row.outbound;
            const rowBaseUnit = row.base_unit || baseUnit;
            const note = row.supplier
              ? `${row.supplier}${row.note ? ` · ${row.note}` : ""}`
              : row.note;
            const rowKey = row.key || `movement-${row.id}`;
            const isSale = row.type === "sale";
            const isInboundBatch = (row.type === "opening" || row.type === "in") && row.batch_id;

            return (
              <li key={rowKey} className="rounded-xl border border-(--hairline) bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {isSale && row.sale_id ? `Sale #${row.sale_id}` : TYPE_LABELS[row.type] ?? row.type}
                        {row.color || row.size
                          ? ` · ${[row.color, row.size].filter(Boolean).join(" / ")}`
                          : ""}
                      </p>
                      {row.reversed ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Reversed
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="mt-0.5 truncate text-xs text-slate-500"
                      title={note || undefined}
                    >
                      {readableDate(isSale ? row.sold_at || row.created_at : row.received_at || row.created_at)}
                      {note ? ` · ${note}` : ""}
                    </p>
                    {row.reversed && row.reversal_note ? (
                      <p className="mt-1 text-[11px] font-medium text-slate-500">{row.reversal_note}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-ledger text-sm font-semibold ${
                        change > 0 ? "text-teal-700" : "text-orange-700"
                      }`}
                    >
                      {change > 0 ? `+${formatQuantity(change)}` : formatQuantity(change)}{" "}
                      {unitLabel(rowBaseUnit, Math.abs(change))}
                    </p>
                    <p className="font-ledger mt-0.5 text-xs text-slate-500">
                      Bal {formatQuantity(row.balance)}
                    </p>
                  </div>
                </div>

                {isInboundBatch ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
                    <Metric label="Batch" value={`#${row.batch_id}`} />
                    <Metric
                      label={`Purchase cost / ${rowBaseUnit}`}
                      value={<Money value={row.unit_cost || 0} />}
                      tone="orange"
                    />
                    <Metric
                      label={`Sale price set / ${row.sale_unit || "unit"}`}
                      value={row.sale_price_snapshot == null ? "—" : <Money value={row.sale_price_snapshot} />}
                      tone="sky"
                    />
                    <Metric
                      label="Batch remaining"
                      value={`${formatQuantity(row.batch_remaining_quantity || 0)} ${unitLabel(rowBaseUnit, row.batch_remaining_quantity || 0)}`}
                      tone="teal"
                    />
                  </div>
                ) : null}

                {isSale && row.sale_id ? (
                  <SaleDetails
                    row={row}
                    expanded={expandedSale === rowKey}
                    onToggle={() => setExpandedSale((current) => current === rowKey ? null : rowKey)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export default ProductLedgerModal;
