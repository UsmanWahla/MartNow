import { useState } from "react";
import PagePanel from "../components/PagePanel";
import AddButton from "../components/AddButton";
import Field from "../components/Field";
import TableToolbar from "../components/TableToolbar";
import Modal from "../components/Modal";
import ModalActions from "../components/ModalActions";
import ConfirmModal from "../components/ConfirmModal";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import RowMenu from "../components/RowMenu";
import { createExpense, fetchExpenses, removeExpense, saveExpense } from "../api";
import { upsertById, type Expense } from "../types";
import Money from "../components/Money";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import { useServerList } from "../hooks/useServerList";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError } from "../auth";
import { collectFieldErrors } from "../utils/formValidate";

function Expenses() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ amount: "", note: "" });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: expenses,
    setRows: setExpenses,
    total,
    loading,
  } = useServerList<Expense>(
    (q, nextPage) => fetchExpenses({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load expenses"))
  );

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([
          [
            "amount",
            !form.amount.trim() || Number(form.amount) <= 0
              ? "Please enter a valid amount"
              : "",
          ],
        ]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await createExpense({
          amount: Number(form.amount),
          note: form.note,
        });
        setExpenses((current) => upsertById(current, response.expense));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add expense"));
      }
    });
  }

  function closeModals() {
    setShowAdd(false);
    setEditing(null);
    setForm({ amount: "", note: "" });
    clearAll();
  }

  function openEdit(expense: Expense) {
    clearAll();
    setEditing(expense);
    setForm({
      amount: String(expense.amount),
      note: expense.note || "",
    });
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    if (
      !report(
        collectFieldErrors([
          [
            "amount",
            !form.amount.trim() || Number(form.amount) <= 0
              ? "Please enter a valid amount"
              : "",
          ],
        ]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveExpense(editing.id, {
          amount: Number(form.amount),
          note: form.note,
        });
        setExpenses((current) => upsertById(current, response.expense));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update expense"));
      }
    });
  }

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (row) => Number(row.amount),
      render: (row) => <Money value={row.amount} />,
    },
    { key: "note", header: "Note", render: (row) => row.note || "—" },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <RowMenu
          onEdit={() => openEdit(row)}
          onDelete={() => setPendingDelete(row)}
        />
      ),
    },
  ];

  return (
    <div>
      <PagePanel
        title={
          <TableToolbar search={search} onSearch={setSearch} count={total} />
        }
        actions={
          <AddButton
            onClick={() => {
              setForm({ amount: "", note: "" });
              setShowAdd(true);
            }}
          />
        }
      >
        <DataTable
          rows={expenses}
          columns={columns}
          rowKey={(row) => row.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search ? "No expenses yet." : "No matching expenses."
          }
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add Expense" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleAdd}>
            <Field
              type="number"
              placeholder="Amount"
              min="0.01"
              step="0.01"
              value={form.amount}
              error={errors.amount}
              onChange={(amount) => {
                setForm({ ...form, amount });
                clearError("amount");
              }}
            />
            <Field
              placeholder="Note (rent, bills, ...)"
              value={form.note}
              onChange={(note) => setForm({ ...form, note })}
            />
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit Expense" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleEdit}>
            <Field
              type="number"
              placeholder="Amount"
              min="0.01"
              step="0.01"
              value={form.amount}
              error={errors.amount}
              onChange={(amount) => {
                setForm({ ...form, amount });
                clearError("amount");
              }}
            />
            <Field
              placeholder="Note (rent, bills, ...)"
              value={form.note}
              onChange={(note) => setForm({ ...form, note })}
            />
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete Expense"
          message="Delete this expense?"
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await removeExpense(pendingDelete.id);
                setExpenses((current) =>
                  current.filter((row) => row.id !== pendingDelete.id)
                );
                setPendingDelete(null);
                showToast(response.message, "success");
              } catch (loadError) {
                showToast(getApiError(loadError, "Unable to delete expense"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default Expenses;
