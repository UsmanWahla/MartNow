import { useState } from "react";
import PagePanel from "../../components/PagePanel";
import AddButton from "../../components/AddButton";
import Field from "../../components/Field";
import PasswordInput from "../../components/PasswordInput";
import TableToolbar from "../../components/TableToolbar";
import Modal from "../../components/Modal";
import ModalActions from "../../components/ModalActions";
import ModalFormSection from "../../components/ModalFormSection";
import ConfirmModal from "../../components/ConfirmModal";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import RowMenu from "../../components/RowMenu";
import Select from "../../components/Select";
import NoteCell from "../../components/NoteCell";
import Money from "../../components/Money";
import { categoryForStoreType, storeCategoryOptions } from "../../storeTypes";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useServerList } from "../../hooks/useServerList";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import { getApiError } from "../../auth";
import {
  createPlatformStore,
  fetchPlatformStores,
  productImageUrl,
  deletePlatformStore,
  removePlatformStore,
  savePlatformStore,
} from "../../api";
import { upsertById, type PlatformStore } from "../../types";
import {
  collectFieldErrors,
  usernameMessage,
  fieldInputClass,
  passwordStrengthMessage,
  requiredMessage,
} from "../../utils/formValidate";

const emptyForm = {
  name: "",
  store_category: "",
  custom_store_type: "",
  address: "",
  latitude: "",
  longitude: "",
  contact_name: "",
  contact_phone: "",
  username: "",
  password: "",
  shop_slug: "",
  delivery_enabled: true,
  commission_percent: "0",
};

function SuperStores() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PlatformStore | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<PlatformStore | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlatformStore | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [logo, setLogo] = useState<File | null>(null);
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const {
    search,
    setSearch,
    page,
    setPage,
    rows: stores,
    setRows: setStores,
    total,
    loading,
    reload,
  } = useServerList<PlatformStore>(
    (q, nextPage) => fetchPlatformStores({ q, page: nextPage }),
    (error) => showToast(getApiError(error, "Unable to load stores"))
  );

  function closeModals() {
    setShowAdd(false);
    setEditing(null);
    setForm(emptyForm);
    setLogo(null);
    clearAll();
  }

  function openAdd() {
    clearAll();
    setEditing(null);
    setForm(emptyForm);
    setLogo(null);
    setShowAdd(true);
  }

  function openEdit(store: PlatformStore) {
    clearAll();
    setShowAdd(false);
    setEditing(store);
    setForm({
      name: store.name,
      store_category: categoryForStoreType(store.store_type),
      custom_store_type: categoryForStoreType(store.store_type) === "other" && store.store_type !== "Other"
        ? store.store_type
        : "",
      address: store.address || "",
      latitude: store.latitude == null ? "" : String(store.latitude),
      longitude: store.longitude == null ? "" : String(store.longitude),
      contact_name: store.contact_name,
      contact_phone: store.contact_phone,
      username: store.username,
      password: "",
      shop_slug: store.shop_slug,
      delivery_enabled: store.delivery_enabled,
      commission_percent: String(store.commission_percent ?? 0),
    });
    setLogo(null);
  }

  function payload() {
    return {
      ...form,
      store_type:
        form.store_category === "other"
          ? form.custom_store_type.trim()
          : storeCategoryOptions.find((option) => option.value === form.store_category)?.label || "",
      commission_percent: Number(form.commission_percent) || 0,
      logo,
    };
  }

  function validateStoreForm() {
    return collectFieldErrors([
      ["name", requiredMessage(form.name, "Please enter the store name")],
      ["store_category", requiredMessage(form.store_category, "Please select the store type")],
      [
        "custom_store_type",
        form.store_category === "other"
          ? requiredMessage(form.custom_store_type, "Please enter the store type")
          : "",
      ],
      ["address", requiredMessage(form.address, "Please enter the address")],
      ["contact_name", requiredMessage(form.contact_name, "Please enter the contact name")],
      ["username", usernameMessage(form.username)],
      [
        "password",
        editing
          ? form.password.trim()
            ? passwordStrengthMessage(form.password)
            : ""
          : passwordStrengthMessage(form.password),
      ],
    ]);
  }

  function patchForm(patch: Partial<typeof emptyForm>, key?: string) {
    setForm((current) => ({ ...current, ...patch }));
    if (key) {
      clearError(key);
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    if (!report(validateStoreForm(), showToast)) {
      return;
    }

    await run(async () => {
      try {
        const response = await createPlatformStore(payload());
        setStores((current) => upsertById(current, response.store));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add store"));
      }
    });
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    if (!report(validateStoreForm(), showToast)) {
      return;
    }

    await run(async () => {
      try {
        const response = await savePlatformStore(editing.id, payload());
        setStores((current) => upsertById(current, response.store));
        closeModals();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update store"));
      }
    });
  }

  const storeForm = (
    <form
      key={editing ? `edit-store-${editing.id}` : "add-store"}
      className="flex flex-col gap-5"
      autoComplete="off"
      onSubmit={editing ? handleEdit : handleAdd}
    >
      <ModalFormSection title="Store details" description="Basic information shown across the platform.">
        <Field
          label="Store name"
          placeholder="e.g. Ali Trader"
          value={form.name}
          error={errors.name}
          onChange={(name) => patchForm({ name }, "name")}
        />
      <div>
        <Select
          label="Store type"
          value={form.store_category}
          error={errors.store_category}
          onChange={(store_category) => {
            patchForm(
              {
                store_category,
                custom_store_type: store_category === "other" ? form.custom_store_type : "",
              },
              "store_category"
            );

            if (store_category !== "other") {
              clearError("custom_store_type");
            }
          }}
        >
          <option value="">Select store type</option>
          {storeCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
        {form.store_category === "other" ? (
          <Field
            label="Custom store type"
            placeholder="e.g. Bakery"
            value={form.custom_store_type}
            error={errors.custom_store_type}
            onChange={(custom_store_type) => patchForm({ custom_store_type }, "custom_store_type")}
          />
        ) : null}
      </ModalFormSection>
      <ModalFormSection title="Location" description="This helps customers and deliveries find the store.">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
        <textarea
          className={`${fieldInputClass(errors.address)} min-h-20 resize-y`}
          placeholder="e.g. G-13, Islamabad"
          value={form.address}
          aria-invalid={Boolean(errors.address)}
          onChange={(event) => patchForm({ address: event.target.value }, "address")}
        />
        {errors.address ? <p className="field-error-text">{errors.address}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Latitude"
          placeholder="-90 to 90"
          value={form.latitude}
          onChange={(latitude) => patchForm({ latitude })}
        />
        <Field
          label="Longitude"
          placeholder="-180 to 180"
          value={form.longitude}
          onChange={(longitude) => patchForm({ longitude })}
        />
      </div>
      </ModalFormSection>
      <ModalFormSection title="Store admin access" description="Credentials for the person who manages this store.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Contact name"
          placeholder="e.g. Ali"
          value={form.contact_name}
          error={errors.contact_name}
          onChange={(contact_name) => patchForm({ contact_name }, "contact_name")}
        />
        <Field
          label="Contact phone"
          placeholder="e.g. 0300 0000000"
          value={form.contact_phone}
          onChange={(contact_phone) => patchForm({ contact_phone })}
        />
      </div>
      <div>
        <Field
          label="Store login username"
          placeholder="e.g. arshad"
          name="platform_store_owner_username"
          autoComplete="off"
          preventAutofill
          value={form.username}
          error={errors.username}
          onChange={(username) => patchForm({ username: username.toLowerCase() }, "username")}
        />
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          Store admin logs in at <span className="font-medium">/login</span> with this username.
          Old stores use the part before @ from their old email. Shop slug is a separate URL.
        </p>
      </div>
      <PasswordInput
        label="Store owner password"
        name="platform_store_owner_password"
        autoComplete="new-password"
        preventAutofill
        placeholder={editing ? "New password (optional)" : "Password"}
        value={form.password}
        error={errors.password}
        onChange={(password) => patchForm({ password }, "password")}
      />
      <div>
        <Field
          label="Shop URL slug"
          placeholder="e.g. bakeman-g13"
          value={form.shop_slug}
          onChange={(shop_slug) => patchForm({ shop_slug })}
        />
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          Public shop URL only. Not used for store admin login.
        </p>
      </div>
      </ModalFormSection>
      <ModalFormSection title="Delivery and commission" description="Choose who delivers orders and set the platform fee.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Delivery handling"
          value={form.delivery_enabled ? "1" : "0"}
          onChange={(value) => patchForm({ delivery_enabled: value === "1" })}
        >
          <option value="1">Yes — store delivers</option>
          <option value="0">No — platform delivers</option>
        </Select>
        <Field
          label="Commission rate"
          type="number"
          placeholder="e.g. 2"
          min="0"
          step="0.01"
          value={form.commission_percent}
          onChange={(commission_percent) => patchForm({ commission_percent })}
        />
      </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Store logo</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
            onChange={(event) => setLogo(event.target.files?.[0] || null)}
          />
        </div>
      </ModalFormSection>
      <ModalActions loading={busy} onCancel={closeModals} />
    </form>
  );

  const columns: DataTableColumn<PlatformStore>[] = [
    {
      key: "name",
      header: "Store",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          {row.logo_path ? (
            <img
              src={productImageUrl(row.logo_path)}
              alt=""
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-xs font-semibold text-teal-800">
              {row.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{row.name}</p>
            <p className="truncate text-xs text-slate-500">{row.shop_slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (row) => row.store_type,
      render: (row) => (
        <span className="w-fit rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
          {row.store_type}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.contact_name}</p>
          <p className="truncate text-xs text-slate-500">@{row.username}</p>
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (row) => <NoteCell note={row.address} />,
    },
    {
      key: "commission",
      header: "Fee",
      sortable: true,
      sortValue: (row) => Number(row.commission_percent),
      render: (row) => `${Number(row.commission_percent)}%`,
    },
    {
      key: "revenue",
      header: "Sales",
      sortable: true,
      sortValue: (row) => Number(row.revenue),
      render: (row) => <Money value={row.revenue || 0} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.status === "active" ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <RowMenu
          onEdit={() => openEdit(row)}
          onDelete={() =>
            row.status === "active" ? setPendingDeactivate(row) : setPendingDelete(row)
          }
        />
      ),
    },
  ];

  return (
    <div>
      <PagePanel>
        <div className="mb-3 flex flex-col items-end gap-2">
          <AddButton label="Add store" onClick={openAdd} />
          <div className="flex flex-wrap items-center gap-3">
            <TableToolbar search={search} onSearch={setSearch} count={total} />
          </div>
        </div>
        <DataTable
          rows={stores}
          columns={columns}
          rowKey={(row) => row.id}
          filterKey={search}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage={total === 0 && !search ? "No stores yet." : "No matching stores."}
        />
      </PagePanel>

      {showAdd ? (
        <Modal title="Add store" wide onClose={busy ? () => undefined : closeModals}>
          {storeForm}
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit store" wide onClose={busy ? () => undefined : closeModals}>
          {storeForm}
        </Modal>
      ) : null}

      {pendingDeactivate ? (
        <ConfirmModal
          title="Deactivate store"
          message="Hide this store from the marketplace? Inventory stays with the store admin."
          confirmLabel="Deactivate"
          loading={busy}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await removePlatformStore(pendingDeactivate.id);
                await reload();
                setPendingDeactivate(null);
                showToast(response.message, "success");
              } catch (loadError) {
                showToast(getApiError(loadError, "Unable to deactivate store"));
              }
            });
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete store"
          message={`Delete ${pendingDelete.name} from the database? It will no longer appear here. This cannot be undone.`}
          confirmLabel="Delete"
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void run(async () => {
              try {
                const response = await deletePlatformStore(pendingDelete.id);
                await reload();
                setPendingDelete(null);
                showToast(response.message, "success");
              } catch (loadError) {
                showToast(getApiError(loadError, "Unable to delete store"));
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default SuperStores;
