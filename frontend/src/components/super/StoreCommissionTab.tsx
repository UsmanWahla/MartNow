import { useCallback, useState, type FormEvent } from "react";
import { getApiError } from "../../auth";
import {
  fetchPlatformCommissionLedger,
  recordPlatformCommissionSettlement,
} from "../../api";
import useBusy from "../../hooks/useBusy";
import { useServerList } from "../../hooks/useServerList";
import { useToast } from "../../hooks/useToast";
import {
  formatCardMoney,
  formatOrderNumber,
  type PlatformCommissionLedgerEntry,
  type PlatformCommissionLedgerSummary,
  type PlatformStore,
} from "../../types";
import AddButton from "../AddButton";
import DataTable, { type DataTableColumn } from "../DataTable";
import Field from "../Field";
import { IconLedger, IconPay, IconProfit } from "../icons";
import Modal from "../Modal";
import ModalActions from "../ModalActions";
import Money from "../Money";
import PagePanel from "../PagePanel";
import StatCard from "../StatCard";
import TableToolbar from "../TableToolbar";
import { formatPlatformOrderTime } from "./platformOrderColumns";

function entryLabel(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  if (entryType === "received") {
    return "Received";
  }

  return entryType === "reversal" ? "Reversed" : "Commission due";
}

function entryTone(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  if (entryType === "received") {
    return "bg-emerald-50 text-emerald-800";
  }

  return entryType === "reversal" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800";
}

interface StoreCommissionTabProps {
  store: PlatformStore;
  summary: PlatformCommissionLedgerSummary | null;
  onSummaryReload: () => Promise<void>;
}

function StoreCommissionTab({ store, summary, onSummaryReload }: StoreCommissionTabProps) {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlement, setSettlement] = useState({ amount: "", note: "" });
  const {
    search,
    setSearch,
    page,
    setPage,
    rows,
    total,
    loading,
    reload,
  } = useServerList<PlatformCommissionLedgerEntry>(
    useCallback(
      (q, nextPage) =>
        fetchPlatformCommissionLedger({ q, page: nextPage, store_id: store.id }),
      [store.id]
    ),
    (error) => showToast(getApiError(error, "Unable to load store commission ledger")),
    String(store.id)
  );

  function closeSettlement() {
    setShowSettlement(false);
    setSettlement({ amount: "", note: "" });
  }

  function handleSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void run(async () => {
      try {
        const response = await recordPlatformCommissionSettlement({
          store_id: store.id,
          amount: Number(settlement.amount),
          note: settlement.note,
        });
        await Promise.all([reload(), onSummaryReload()]);
        closeSettlement();
        showToast(response.message, "success");
      } catch (saveError) {
        showToast(getApiError(saveError, "Unable to record commission payment"));
      }
    });
  }

  const columns: DataTableColumn<PlatformCommissionLedgerEntry>[] = [
    {
      key: "created_at",
      header: "Time",
      sortable: true,
      sortValue: (entry) => entry.created_at,
      render: (entry) => formatPlatformOrderTime(entry.created_at),
    },
    {
      key: "entry_type",
      header: "Entry",
      sortable: true,
      sortValue: (entry) => entry.entry_type,
      render: (entry) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entryTone(entry.entry_type)}`}>
          {entryLabel(entry.entry_type)}
        </span>
      ),
    },
    {
      key: "order",
      header: "Order ID",
      sortable: true,
      sortValue: (entry) => entry.sale_id ?? 0,
      render: (entry) => formatOrderNumber(entry.sale_id),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (entry) => Number(entry.amount),
      render: (entry) => <Money value={entry.amount} className="font-semibold text-slate-800" />,
    },
    {
      key: "note",
      header: "Note",
      render: (entry) => <span className="text-slate-600">{entry.note || "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total due"
          value={summary ? formatCardMoney(summary.due) : "—"}
          numeric={summary ? Number(summary.due) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-amber-700"
          border="border-slate-200 border-l-amber-600"
        />
        <StatCard
          label="Received"
          value={summary ? formatCardMoney(summary.received) : "—"}
          numeric={summary ? Number(summary.received) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconPay className="h-5 w-5" />}
          iconWrap="bg-emerald-700"
          border="border-slate-200 border-l-emerald-600"
        />
        <StatCard
          label="Outstanding"
          value={summary ? formatCardMoney(summary.outstanding) : "—"}
          numeric={summary ? Number(summary.outstanding) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconLedger className="h-5 w-5" />}
          iconWrap="bg-teal-700"
          border="border-slate-200 border-l-teal-600"
        />
        <StatCard
          label="Reversed"
          value={summary ? formatCardMoney(summary.reversed) : "—"}
          numeric={summary ? Number(summary.reversed) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-red-700"
          border="border-slate-200 border-l-red-600"
        />
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
        Commission becomes due when an online order is delivered and its payment is collected.
        Received payments reduce the outstanding balance. Current rate: {Number(store.commission_percent)}%.
      </div>

      <PagePanel>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <AddButton label="Record payment" onClick={() => setShowSettlement(true)} />
          <div className="flex flex-wrap items-center gap-3">
            <TableToolbar search={search} onSearch={setSearch} count={total} />
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(entry) => entry.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={total === 0 && !search ? "No commission entries for this store yet." : "No matching entries."}
        />
      </PagePanel>

      {showSettlement ? (
        <Modal title={`Record payment · ${store.name}`} onClose={busy ? () => undefined : closeSettlement}>
          <form className="flex flex-col gap-3" onSubmit={handleSettlement}>
            <Field
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={settlement.amount}
              onChange={(amount) => setSettlement((current) => ({ ...current, amount }))}
            />
            <Field
              label="Note (optional)"
              placeholder="Payment reference or note"
              value={settlement.note}
              onChange={(note) => setSettlement((current) => ({ ...current, note }))}
            />
            <ModalActions saveLabel="Record payment" loading={busy} onCancel={closeSettlement} />
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export default StoreCommissionTab;
