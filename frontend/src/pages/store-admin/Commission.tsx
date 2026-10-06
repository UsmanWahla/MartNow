import { useCallback, useEffect, useState } from "react";
import { fetchStoreCommissionLedger, fetchStoreCommissionSummary } from "../../api";
import { getApiError } from "../../auth";
import DataTable, { type DataTableColumn } from "../../components/shared/DataTable";
import { IconLedger, IconPay, IconProfit } from "../../components/shared/icons";
import Money from "../../components/shared/Money";
import PagePanel from "../../components/shared/PagePanel";
import StatCard from "../../components/shared/StatCard";
import TableToolbar from "../../components/shared/TableToolbar";
import { formatPlatformOrderTime } from "../../components/super/platformOrderColumns";
import { useServerList } from "../../hooks/useServerList";
import { useToast } from "../../hooks/useToast";
import { formatQuantity } from "../../numberFormat";
import {
  formatCardMoney,
  formatOrderNumber,
  type PlatformCommissionLedgerEntry,
  type StoreCommissionSummary,
} from "../../types";

function entryLabel(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  if (entryType === "received") {
    return "Payment recorded";
  }

  return entryType === "reversal" ? "Charge reversed" : "Commission charged";
}

function entryTone(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  if (entryType === "received") {
    return "bg-emerald-50 text-emerald-800";
  }

  return entryType === "reversal" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800";
}

function amountPrefix(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  return entryType === "due" ? "+" : "\u2212";
}

function amountTone(entryType: PlatformCommissionLedgerEntry["entry_type"]) {
  if (entryType === "due") {
    return "text-amber-800";
  }

  return entryType === "reversal" ? "text-red-700" : "text-emerald-700";
}

function Commission() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<StoreCommissionSummary | null>(null);
  const {
    search,
    setSearch,
    page,
    setPage,
    rows,
    total,
    loading,
  } = useServerList<PlatformCommissionLedgerEntry>(
    useCallback(
      (q, nextPage) => fetchStoreCommissionLedger({ q, page: nextPage }),
      []
    ),
    (error) => showToast(getApiError(error, "Unable to load commission history"))
  );

  useEffect(() => {
    async function loadSummary() {
      try {
        setSummary(await fetchStoreCommissionSummary());
      } catch (error) {
        showToast(getApiError(error, "Unable to load commission summary"));
      }
    }

    void loadSummary();
  }, [showToast]);

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
      header: "Reference",
      sortable: true,
      sortValue: (entry) => entry.sale_id ?? 0,
      render: (entry) => entry.entry_type === "received" ? "Payment" : formatOrderNumber(entry.sale_id),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (entry) => Number(entry.amount),
      render: (entry) => (
        <span className={`inline-flex items-center font-semibold ${amountTone(entry.entry_type)}`}>
          {amountPrefix(entry.entry_type)}
          <Money value={entry.amount} />
        </span>
      ),
    },
    {
      key: "note",
      header: "Note",
      render: (entry) => <span className="text-slate-600">{entry.note || "\u2014"}</span>,
    },
  ];

  const commissionRate = summary ? Number(summary.commission_percent) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current rate"
          value={summary ? `${formatQuantity(summary.commission_percent)}%` : "\u2014"}
          numeric={commissionRate}
          formatNumeric={(value) => `${formatQuantity(value)}%`}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-sky-700"
          border="border-slate-200 border-l-sky-600"
        />
        <StatCard
          label="Total charged"
          value={summary ? formatCardMoney(summary.due) : "\u2014"}
          numeric={summary ? Number(summary.due) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconProfit className="h-5 w-5" />}
          iconWrap="bg-amber-700"
          border="border-slate-200 border-l-amber-600"
        />
        <StatCard
          label="Paid"
          value={summary ? formatCardMoney(summary.received) : "\u2014"}
          numeric={summary ? Number(summary.received) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconPay className="h-5 w-5" />}
          iconWrap="bg-emerald-700"
          border="border-slate-200 border-l-emerald-600"
        />
        <StatCard
          label="Outstanding"
          value={summary ? formatCardMoney(summary.outstanding) : "\u2014"}
          numeric={summary ? Number(summary.outstanding) : undefined}
          formatNumeric={formatCardMoney}
          icon={<IconLedger className="h-5 w-5" />}
          iconWrap="bg-teal-700"
          border="border-slate-200 border-l-teal-600"
        />
      </div>

      <PagePanel>
        <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
          <TableToolbar search={search} onSearch={setSearch} count={total} />
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
          emptyMessage={total === 0 && !search ? "No commission entries yet." : "No matching commission entries."}
        />
      </PagePanel>
    </div>
  );
}

export default Commission;
