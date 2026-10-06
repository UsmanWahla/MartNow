import { useState } from "react";
import PagePanel from "../../components/shared/PagePanel";
import AddButton from "../../components/shared/AddButton";
import ConfirmModal from "../../components/shared/ConfirmModal";
import DataTable, { type DataTableColumn } from "../../components/shared/DataTable";
import Field from "../../components/shared/Field";
import Modal from "../../components/shared/Modal";
import ModalActions from "../../components/shared/ModalActions";
import RowMenu from "../../components/shared/RowMenu";
import Select from "../../components/shared/Select";
import TableToolbar from "../../components/shared/TableToolbar";
import { getApiError } from "../../auth";
import {
  createStoreType,
  fetchManagedStoreTypes,
  saveStoreType,
  setStoreTypeStatus,
} from "../../api";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import { useServerList } from "../../hooks/useServerList";
import { useToast } from "../../hooks/useToast";
import type { ManagedStoreType } from "../../types";
import { collectFieldErrors, requiredMessage } from "../../utils/formValidate";

type StatusFilter = "all" | "active" | "inactive";

function storeTypeNameMessage(value: string) {
  const required = requiredMessage(value, "Please enter the store type name");

  if (required) {
    return required;
  }

  const name = value.trim();

  if (name.length < 2 || name.length > 100) {
    return "Store type name must be between 2 and 100 characters";
  }

  if (name.toLowerCase() === "other") {
    return "Use a specific store type name instead of Other";
  }

  return "";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SuperStoreTypes() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ManagedStoreType | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    storeType: ManagedStoreType;
    isActive: boolean;
  } | null>(null);
  const [name, setName] = useState("");
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: storeTypes,
    total,
    loading,
    reload,
  } = useServerList<ManagedStoreType>(
    (q, nextPage) => fetchManagedStoreTypes({ q, page: nextPage, status }),
    (error) => showToast(getApiError(error, "Unable to load store types")),
    status
  );

  function closeForm() {
    setShowAdd(false);
    setEditing(null);
    setName("");
    clearAll();
  }

  function openAdd() {
    clearAll();
    setEditing(null);
    setName("");
    setShowAdd(true);
  }

  function openEdit(storeType: ManagedStoreType) {
    clearAll();
    setShowAdd(false);
    setEditing(storeType);
    setName(storeType.name);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([["name", storeTypeNameMessage(name)]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = editing
          ? await saveStoreType(editing.id, { name: name.trim() })
          : await createStoreType({ name: name.trim() });
        closeForm();
        await reload();
        showToast(response.message, "success");
      } catch (error) {
        showToast(getApiError(error, editing ? "Unable to update store type" : "Unable to add store type"));
      }
    });
  }

  const columns: DataTableColumn<ManagedStoreType>[] = [
    {
      key: "name",
      header: "Store type",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{row.name}</p>
          <p className="truncate text-xs text-slate-500">{row.code}</p>
        </div>
      ),
    },
    {
      key: "stores",
      header: "Stores using",
      sortable: true,
      sortValue: (row) => row.store_count,
      render: (row) => (
        <span className="font-medium text-slate-700">
          {row.store_count} {row.store_count === 1 ? "store" : "stores"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => (row.is_active ? 1 : 0),
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.is_active ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <RowMenu
          extras={[
            {
              label: row.is_active ? "Deactivate" : "Activate",
              onClick: () => setPendingStatus({ storeType: row, isActive: !row.is_active }),
            },
          ]}
          onEdit={() => openEdit(row)}
        />
      ),
    },
  ];

  const typeForm = (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field
        label="Store type name"
        placeholder="e.g. Medical Laboratory"
        value={name}
        error={errors.name}
        onChange={(value) => {
          setName(value.slice(0, 100));
          clearError("name");
        }}
      />
      <p className="text-xs leading-5 text-slate-500">
        The internal code is generated automatically. Active types become available in store forms.
      </p>
      <ModalActions loading={busy} onCancel={closeForm} />
    </form>
  );

  return (
    <div>
      <PagePanel>
        <div className="mb-3 flex flex-col items-end gap-2">
          <AddButton label="Add store type" onClick={openAdd} />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <TableToolbar search={search} onSearch={setSearch} count={total} />
            <Select
              className="field-input min-w-36"
              value={status}
              onChange={(value) => {
                setStatus(value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
        <DataTable
          rows={storeTypes}
          columns={columns}
          rowKey={(row) => row.id}
          filterKey={`${search}:${status}`}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={
            total === 0 && !search && status === "all"
              ? "No store types yet."
              : "No matching store types."
          }
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add store type" onClose={busy ? () => undefined : closeForm}>
          {typeForm}
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit store type" onClose={busy ? () => undefined : closeForm}>
          {typeForm}
        </Modal>
      ) : null}

      {pendingStatus ? (
        <ConfirmModal
          title={pendingStatus.isActive ? "Activate store type" : "Deactivate store type"}
          message={
            pendingStatus.isActive
              ? `Make ${pendingStatus.storeType.name} available in store forms?`
              : `Deactivate ${pendingStatus.storeType.name}? A type assigned to stores cannot be deactivated.`
          }
          confirmLabel={pendingStatus.isActive ? "Activate" : "Deactivate"}
          loading={busy}
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await setStoreTypeStatus(
                  pendingStatus.storeType.id,
                  pendingStatus.isActive
                );
                setPendingStatus(null);
                await reload();
                showToast(response.message, "success");
              } catch (error) {
                setPendingStatus(null);
                showToast(getApiError(error, "Unable to change store type status"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default SuperStoreTypes;
