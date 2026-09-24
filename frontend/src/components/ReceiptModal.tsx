import Money from "./Money";
import { type Sale } from "../types";

interface ReceiptModalProps {
  sale: Sale;
  shopName: string;
  onClose: () => void;
}

function ReceiptModal({ sale, shopName, onClose }: ReceiptModalProps) {
  const items = sale.items?.length
    ? sale.items
    : [
        {
          product: sale.product,
          quantity: sale.quantity,
          total_amount: sale.total_amount,
          color: "",
          size: "",
        },
      ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:static print:bg-white print:p-0">
      <div className="receipt-paper w-full max-w-md rounded-xl bg-white p-6 shadow-xl print:max-w-none print:shadow-none">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold text-teal-900">{shopName || "Inventory"}</h2>
          <p className="text-sm text-slate-500">Sale #{sale.id}</p>
          <p className="text-sm text-slate-500">
            {new Date(sale.created_at).toLocaleString()}
          </p>
        </div>
        {sale.customer ? (
          <p className="mb-3 text-sm">Customer: {sale.customer}</p>
        ) : null}
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="py-1">
                  {item.product}
                  {item.color || item.size
                    ? ` · ${[item.color, item.size].filter(Boolean).join(" / ")}`
                    : ""}
                </td>
                <td className="py-1">{item.quantity}</td>
                <td className="py-1 text-right">
                  <Money value={item.total_amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right font-semibold">
          Total <Money value={sale.total_amount} />
        </p>
        <p className="text-right text-sm">
          Paid <Money value={sale.paid_amount ?? sale.total_amount} />
        </p>
        {Number(sale.due_amount) > 0 ? (
          <p className="text-right text-sm text-orange-700">
            Udhaar <Money value={sale.due_amount || 0} />
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2 print:hidden">
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;
