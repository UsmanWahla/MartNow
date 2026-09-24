import { useState } from "react";
import PagePanel from "../components/PagePanel";
import AddButton from "../components/AddButton";
import PersonForm from "../components/PersonForm";
import TableToolbar from "../components/TableToolbar";
import Modal from "../components/Modal";
import ModalActions from "../components/ModalActions";
import ConfirmModal from "../components/ConfirmModal";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import RowMenu from "../components/RowMenu";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import { useServerList } from "../hooks/useServerList";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError } from "../auth";
import {
  createSupplier,
  fetchSuppliers,
  removeSupplier,
  saveSupplier,
} from "../api";
import { upsertById, type Supplier } from "../types";
import { collectFieldErrors, requiredMessage } from "../utils/formValidate";

const emptyForm = { name: "", phone: "" };

function Suppliers() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: suppliers,
    setRows: setSuppliers,
    total,
    loading,
  } = useServerList<Supplier>(
    (q, nextPage) => fetchSuppliers({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load suppliers"))
  );

  function closeModals() {
    setShowAdd(false);
    setEditing(null);
    setForm(emptyForm);
    clearAll();
  }

  function openEdit(supplier: Supplier) {
    clearAll();
    setEditing(supplier);
    setForm({ name: supplier.name, phone: supplier.phone || "" });
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([["name", requiredMessage(form.name, "Please enter the supplier name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await createSupplier(form);
        setSuppliers((current) => upsertById(current, response.supplier));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add supplier"));
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
        collectFieldErrors([["name", requiredMessage(form.name, "Please enter the supplier name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveSupplier(editing.id, form);
        setSuppliers((current) => upsertById(current, response.supplier));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update supplier"));
      }
    });
  }

  const columns: DataTableColumn<Supplier>[] = [
    { key: "name", header: "Name", sortable: true, sortValue: (row) => row.name },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
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
          rows={suppliers}
          columns={columns}
          rowKey={(row) => row.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search ? "No suppliers yet." : "No matching suppliers."
          }
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add Supplier" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleAdd}>
            {personForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit Supplier" onClose={busy ? () => undefined : closeModals}>
          <form className="flex flex-col gap-3" onSubmit={handleEdit}>
            {personForm}
            <ModalActions loading={busy} onCancel={closeModals} />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete Supplier"
          message={`Delete ${pendingDelete.name}?`}
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await removeSupplier(pendingDelete.id);
                setSuppliers((current) =>
                  current.filter((row) => row.id !== pendingDelete.id)
                );
                setPendingDelete(null);
                showToast(response.message, "success");
              } catch (loadError) {
                showToast(getApiError(loadError, "Unable to delete supplier"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default Suppliers;
