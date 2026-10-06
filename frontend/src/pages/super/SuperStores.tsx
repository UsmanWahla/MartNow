import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PagePanel from "../../components/shared/PagePanel";
import AddButton from "../../components/shared/AddButton";
import Field from "../../components/shared/Field";
import PasswordInput from "../../components/shared/PasswordInput";
import TableToolbar from "../../components/shared/TableToolbar";
import Modal from "../../components/shared/Modal";
import ModalActions from "../../components/shared/ModalActions";
import ModalFormSection from "../../components/shared/ModalFormSection";
import ConfirmModal from "../../components/shared/ConfirmModal";
import DataTable, { type DataTableColumn } from "../../components/shared/DataTable";
import RowMenu from "../../components/shared/RowMenu";
import Select from "../../components/shared/Select";
import NoteCell from "../../components/shared/NoteCell";
import Money from "../../components/shared/Money";
import StoreLocationPicker from "../../components/shared/StoreLocationPicker";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useServerList } from "../../hooks/useServerList";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import { getApiError } from "../../auth";
import {
  createPlatformStore,
  fetchPlatformStores,
  fetchStoreTypes,
  productImageUrl,
  deletePlatformStore,
  removePlatformStoreLogo,
  removePlatformStore,
  savePlatformStore,
} from "../../api";
import { upsertById, type PlatformStore, type StoreType } from "../../types";
import {
  collectFieldErrors,
  usernameMessage,
  passwordStrengthMessage,
  requiredMessage,
} from "../../utils/formValidate";

const emptyForm = {
  name: "",
  store_type_id: "",
  store_description: "",
  business_hours: "",
  delivery_note: "",
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PlatformStore | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<PlatformStore | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlatformStore | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [storeTypes, setStoreTypes] = useState<StoreType[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false);
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

  useEffect(() => {
    async function loadStoreTypes() {
      try {
        setStoreTypes(await fetchStoreTypes());
      } catch (error) {
        showToast(getApiError(error, "Unable to load store types"));
      }
    }

    void loadStoreTypes();
  }, [showToast]);

  function closeModals() {
    setShowAdd(false);
    setEditing(null);
    setForm(emptyForm);
    setLogo(null);
    setPendingLogoRemoval(false);
    clearAll();
  }

  function openAdd() {
    clearAll();
    setEditing(null);
    setForm(emptyForm);
    setLogo(null);
    setPendingLogoRemoval(false);
    setShowAdd(true);
  }

  function openEdit(store: PlatformStore) {
    clearAll();
    setShowAdd(false);
    setEditing(store);
    setForm({
      name: store.name,
      store_type_id: String(store.store_type_id),
      store_description: store.store_description || "",
      business_hours: store.business_hours || "",
      delivery_note: store.delivery_note || "",
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
    setPendingLogoRemoval(false);
  }

  function payload() {
    return {
      ...form,
      store_type_id: Number(form.store_type_id),
      commission_percent: Number(form.commission_percent) || 0,
      logo,
    };
  }

  function validateStoreForm() {
    return collectFieldErrors([
      ["name", requiredMessage(form.name, "Please enter the store name")],
      ["store_type_id", requiredMessage(form.store_type_id, "Please select the store type")],
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

  async function handleRemoveLogo() {
    if (!editing) {
      return;
    }

    await run(async () => {
      try {
        const response = await removePlatformStoreLogo(editing.id);
        setStores((current) => upsertById(current, response.store));
        setEditing(response.store);
        setLogo(null);
        setPendingLogoRemoval(false);
        showToast("Store logo removed", "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to remove store logo"));
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
          value={form.store_type_id}
          error={errors.store_type_id}
          onChange={(store_type_id) => patchForm({ store_type_id }, "store_type_id")}
        >
          <option value="">Select store type</option>
          {storeTypes.map((storeType) => (
            <option key={storeType.id} value={storeType.id}>
              {storeType.name}
            </option>
          ))}
        </Select>
      </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Store description</label>
          <textarea
            className="field-input min-h-20 resize-y"
            value={form.store_description}
            maxLength={500}
            placeholder="A short introduction customers will see on the storefront"
            onChange={(event) => patchForm({ store_description: event.target.value })}
          />
        </div>
      </ModalFormSection>
      <ModalFormSection title="Location" description="This helps customers and deliveries find the store.">
        <StoreLocationPicker
          value={{ address: form.address, latitude: form.latitude, longitude: form.longitude }}
          error={errors.address}
          onChange={({ address, latitude, longitude }) =>
            patchForm({ address, latitude, longitude }, "address")
          }
        />
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
        <Field
          label="Business hours"
          placeholder="e.g. Mon–Sat, 10 AM–9 PM"
          value={form.business_hours}
          onChange={(business_hours) => patchForm({ business_hours })}
        />
        <Field
          label="Delivery note"
          placeholder="e.g. Same-day delivery in G-13"
          value={form.delivery_note}
          onChange={(delivery_note) => patchForm({ delivery_note })}
        />
        <div>
        <Field
          label="Store login username"
          placeholder="e.g. ali"
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
          {editing?.logo_path ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src={productImageUrl(editing.logo_path)}
                  alt="Current store logo"
                  className="h-10 w-10 rounded-lg bg-white object-contain p-0.5"
                />
                <span className="truncate text-xs font-medium text-slate-600">Current logo</span>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                onClick={() => {
                  setPendingLogoRemoval(true);
                }}
              >
                Remove logo
              </button>
            </div>
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
            onChange={(event) => {
              setLogo(event.target.files?.[0] || null);
            }}
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
        <span
          className="inline-block max-w-[7.5rem] truncate rounded-full bg-sky-50 px-2 py-0.5 align-bottom text-xs font-semibold text-sky-800"
          title={row.store_type}
        >
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
          extras={[{ label: "View details", onClick: () => navigate(`/super/stores/${row.id}`) }]}
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
          onRowClick={(store) => navigate(`/super/stores/${store.id}`)}
          rowAriaLabel={(store) => `View ${store.name} details`}
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

      {pendingLogoRemoval && editing ? (
        <ConfirmModal
          title="Remove store logo"
          message="Remove this store logo now? The store will use its default fallback until a new logo is uploaded."
          confirmLabel="Remove logo"
          loading={busy}
          onCancel={() => setPendingLogoRemoval(false)}
          onConfirm={() => void handleRemoveLogo()}
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
