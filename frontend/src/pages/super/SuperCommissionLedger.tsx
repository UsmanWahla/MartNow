import { useCallback, useEffect, useState, type FormEvent } from "react";
import AddButton from "../../components/shared/AddButton";
import DataTable, { type DataTableColumn } from "../../components/shared/DataTable";
import Field from "../../components/shared/Field";
import Modal from "../../components/shared/Modal";
import ModalActions from "../../components/shared/ModalActions";
import Money from "../../components/shared/Money";
import PagePanel from "../../components/shared/PagePanel";
import Select from "../../components/shared/Select";
import StatCard from "../../components/shared/StatCard";
import TableToolbar from "../../components/shared/TableToolbar";
import { IconLedger, IconPay, IconProfit } from "../../components/shared/icons";
import { getApiError } from "../../auth";
import {
  fetchPlatformCommissionLedger,
  fetchPlatformCommissionLedgerSummary,
  fetchPlatformStores,
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
import { formatPlatformOrderTime } from "../../components/super/platformOrderColumns";

const emptySettlement = { storeId: "", amount: "", note: "" };

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

function SuperCommissionLedger() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [summary, setSummary] = useState<PlatformCommissionLedgerSummary | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlement, setSettlement] = useState(emptySettlement);
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
        fetchPlatformCommissionLedger({
          q,
          page: nextPage,
          store_id: storeId ? Number(storeId) : undefined,
        }),
      [storeId]
    ),
    (error) => showToast(getApiError(error, "Unable to load commission ledger")),
    storeId
  );

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchPlatformCommissionLedgerSummary());
    } catch (loadError) {
      showToast(getApiError(loadError, "Unable to load commission summary"));
    }
  }, [showToast]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [storeData, summaryData] = await Promise.all([
          fetchPlatformStores({ all: true }),
          fetchPlatformCommissionLedgerSummary(),
        ]);
        setStores(storeData.rows);
        setSummary(summaryData);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load commission ledger"));
      }
    }

    void loadInitialData();
  }, [showToast]);

  function openSettlement() {
    setSettlement({ ...emptySettlement, storeId });
    setShowSettlement(true);
  }

  function closeSettlement() {
    setShowSettlement(false);
    setSettlement(emptySettlement);
  }

  function handleStoreFilter(value: string) {
    setStoreId(value);
    setPage(1);
  }

  function handleSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void run(async () => {
      try {
        const response = await recordPlatformCommissionSettlement({
          store_id: Number(settlement.storeId),
          amount: Number(settlement.amount),
          note: settlement.note,
        });
        await Promise.all([reload(), loadSummary()]);
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
      key: "store",
      header: "Store",
      sortable: true,
      sortValue: (entry) => entry.store_name,
      render: (entry) => <p className="truncate font-medium text-slate-800">{entry.store_name}</p>,
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
      render: (entry) => (
        <Money
          value={entry.amount}
          className={entry.entry_type === "reversal" ? "text-red-700" : "font-semibold text-slate-800"}
        />
      ),
    },
    {
      key: "note",
      header: "Note",
      render: (entry) => <span className="text-slate-600">{entry.note || "—"}</span>,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Commission"
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

      <PagePanel>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-12rem sm:max-w-xs">
            <p className="mb-1.5 text-sm font-medium text-slate-600">Store</p>
            <Select value={storeId} onChange={handleStoreFilter}>
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AddButton label="Record payment" onClick={openSettlement} />
            <div className="flex flex-wrap items-center gap-3">
              <TableToolbar search={search} onSearch={setSearch} count={total} />
            </div>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(entry) => entry.id}
          filterKey={`${search}|${storeId}`}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={total === 0 && !search && !storeId ? "No commission entries yet." : "No matching commission entries."}
        />
      </PagePanel>

      {showSettlement ? (
        <Modal title="Record commission payment" onClose={busy ? () => undefined : closeSettlement}>
          <form className="flex flex-col gap-3" onSubmit={handleSettlement}>
            <div>
              <label className="mb-1 block font-semibold">Store</label>
              <Select
                value={settlement.storeId}
                onChange={(value) => setSettlement((current) => ({ ...current, storeId: value }))}
              >
                <option value="">Choose store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </div>
            <Field
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={settlement.amount}
              onChange={(value) => setSettlement((current) => ({ ...current, amount: value }))}
            />
            <Field
              label="Note (optional)"
              placeholder="Payment reference or note"
              value={settlement.note}
              onChange={(value) => setSettlement((current) => ({ ...current, note: value }))}
            />
            <ModalActions saveLabel="Record payment" loading={busy} onCancel={closeSettlement} />
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

export default SuperCommissionLedger;
