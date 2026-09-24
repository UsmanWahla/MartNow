import { useEffect, useState } from "react";
import Modal from "./Modal";
import { getApiError } from "../auth";
import { fetchProductLedger } from "../api";
import type { Product, ProductLedger } from "../types";
import { variantLabel } from "../variantStock";

const TYPE_LABELS: Record<string, string> = {
  opening: "Opening",
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

function ProductLedgerModal({ product, onClose, onError }: ProductLedgerModalProps) {
  const [ledger, setLedger] = useState<ProductLedger | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <Modal title="Ledger" onClose={onClose}>
      <p className="mb-3 text-sm font-medium text-slate-700">{product.name}</p>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-slate-500">On hand</p>
          <p className="font-ledger mt-0.5 text-sm font-semibold text-slate-900">
            {onHand}
          </p>
        </div>
        <div className="rounded-xl bg-teal-50 px-2 py-2">
          <p className="text-teal-700">In</p>
          <p className="font-ledger mt-0.5 text-sm font-semibold text-teal-800">
            {ledger?.totalIn ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-orange-50 px-2 py-2">
          <p className="text-orange-700">Out</p>
          <p className="font-ledger mt-0.5 text-sm font-semibold text-orange-800">
            {ledger?.totalOut ?? "—"}
          </p>
        </div>
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
              {variantLabel(row.color, row.size) || "Default"} · {row.stock}
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-(--hairline) bg-[#f8fbfa] px-4 py-8 text-center text-sm text-slate-500">
          No stock history yet.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-(--hairline)">
          {rows.map((row) => {
            const change = row.inbound || -row.outbound;
            const note = row.supplier
              ? `${row.supplier}${row.note ? ` · ${row.note}` : ""}`
              : row.note;

            return (
              <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {TYPE_LABELS[row.type] ?? row.type}
                    {row.color || row.size
                      ? ` · ${[row.color, row.size].filter(Boolean).join(" / ")}`
                      : ""}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs text-slate-500"
                    title={note ? `${new Date(row.created_at).toLocaleString()} · ${note}` : undefined}
                  >
                    {new Date(row.created_at).toLocaleString()}
                    {note ? ` · ${note}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`font-ledger text-sm font-semibold ${
                      change > 0 ? "text-teal-700" : "text-orange-700"
                    }`}
                  >
                    {change > 0 ? `+${change}` : change}
                  </p>
                  <p className="font-ledger mt-0.5 text-xs text-slate-500">
                    Bal {row.balance}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export default ProductLedgerModal;
