import { useState } from "react";
import PagePanel from "../components/PagePanel";
import AddButton from "../components/AddButton";
import PersonForm from "../components/PersonForm";
import Field from "../components/Field";
import TableToolbar from "../components/TableToolbar";
import Modal from "../components/Modal";
import ModalActions from "../components/ModalActions";
import ConfirmModal from "../components/ConfirmModal";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import RowMenu from "../components/RowMenu";
import Money from "../components/Money";
import { IconPay } from "../components/icons";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import { useServerList } from "../hooks/useServerList";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError, getUser } from "../auth";
import { canManagePeople, getRole } from "../roles";
import {
  createCustomer,
  fetchCustomers,
  payCustomer,
  removeCustomer,
  saveCustomer,
} from "../api";
import { upsertById, type Customer } from "../types";
import {
  collectFieldErrors,
  requiredMessage,
} from "../utils/formValidate";

const emptyForm = { name: "", phone: "" };

function Customers() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const canManage = canManagePeople(getRole(getUser()));
  const [form, setForm] = useState(emptyForm);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: customers,
    setRows: setCustomers,
    total,
    loading,
  } = useServerList<Customer>(
    (q, nextPage) => fetchCustomers({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load customers"))
  );

  function closeModals() {
    setShowAdd(false);
    setEditing(null);
    setForm(emptyForm);
    clearAll();
  }

  function openEdit(customer: Customer) {
    clearAll();
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone || "" });
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([["name", requiredMessage(form.name, "Please enter the customer name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await createCustomer(form);
        setCustomers((current) => upsertById(current, response.customer));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add customer"));
      }
    });
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    if (
      !report(
        collectFieldErrors([["name", requiredMessage(form.name, "Please enter the customer name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveCustomer(editing.id, form);
        setCustomers((current) => upsertById(current, response.customer));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update customer"));
      }
    });
  }

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();

    if (!paying) {
      return;
    }

    if (
      !report(
        collectFieldErrors([
          [
            "payAmount",
            !payAmount.trim() || Number(payAmount) <= 0
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
        const response = await payCustomer(paying.id, Number(payAmount));
        setCustomers((current) => upsertById(current, response.customer));
        setPaying(null);
        setPayAmount("");
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to record payment"));
      }
    });
  }

  const columns: DataTableColumn<Customer>[] = [
    { key: "name", header: "Name", sortable: true, sortValue: (row) => row.name },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
    { key: "email", header: "Email", render: (row) => row.email || "—" },
    {
      key: "balance",
      header: "Udhaar",
      sortable: true,
      sortValue: (row) => Number(row.balance),
      render: (row) => <Money value={row.balance} />,
    },
    {
      key: "action",
      header: "Action",
      render: (row) =>
        canManage ? (
          <RowMenu
            extras={[
              {
                label: "Pay",
                icon: <IconPay className="h-4 w-4 text-slate-500" />,
                onClick: () => setPaying(row),
              },
            ]}
            onEdit={() => openEdit(row)}
            onDelete={() => setPendingDelete(row)}
          />
        ) : null,
    },
  ];

  const personForm = (
    <PersonForm
      name={form.name}
      phone={form.phone}
      nameError={errors.name}
      onName={(name) => {
        setForm({ ...form, name });
        clearError("name");
      }}
      onPhone={(phone) => setForm({ ...form, phone })}
    />
  );

  return (
    <div>
      <PagePanel
        title={
          <TableToolbar search={search} onSearch={setSearch} count={total} />
        }
        actions={
          <AddButton
            onClick={() => {
              setForm(emptyForm);
              setShowAdd(true);
            }}
          />
        }
      >
        <DataTable
          rows={customers}
          columns={columns}
          rowKey={(row) => row.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search ? "No customers yet." : "No matching customers."
          }
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add Customer" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleAdd}>
            {personForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit Customer" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleEdit}>
            {personForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {paying ? (
        <Modal title={`Pay ${paying.name}`} onClose={busy ? () => undefined : () => setPaying(null)}>
          <form className="flex flex-col gap-3" onSubmit={handlePay}>
            <p className="text-sm text-slate-500">
              Due <Money value={paying.balance} />
            </p>
            <Field
              type="number"
              placeholder="Amount"
              min="0.01"
              step="0.01"
              value={payAmount}
              error={errors.payAmount}
              onChange={(value) => {
                setPayAmount(value);
                clearError("payAmount");
              }}
            />
            <ModalActions loading={busy} onCancel={() => setPaying(null)} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete Customer"
          message={`Delete ${pendingDelete.name}?`}
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await removeCustomer(pendingDelete.id);
                setCustomers((current) =>
                  current.filter((row) => row.id !== pendingDelete.id)
                );
                setPendingDelete(null);
                showToast(response.message, "success");
              } catch (loadError) {
                setPendingDelete(null);
                showToast(getApiError(loadError, "Unable to delete customer"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default Customers;
