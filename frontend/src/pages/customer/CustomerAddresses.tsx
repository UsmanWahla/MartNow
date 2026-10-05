import { useCallback, useEffect, useState } from "react";
import ConfirmModal from "../../components/ConfirmModal";
import Field from "../../components/Field";
import Modal from "../../components/Modal";
import ShopButton from "../../components/shop/ShopButton";
import StoreLocationPicker from "../../components/StoreLocationPicker";
import { IconMapPin, IconPencil, IconPlus, IconTrash } from "../../components/icons";
import {
  createCustomerAddress,
  fetchCustomerAddresses,
  fetchCustomerProfile,
  removeCustomerAddress,
  saveCustomerAddress,
  setDefaultCustomerAddress,
} from "../../api";
import { getApiError } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import type { CustomerAddress, CustomerProfile } from "../../types";
import { collectFieldErrors, requiredMessage } from "../../utils/formValidate";

interface AddressFormState {
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
}

const emptyProfile: CustomerProfile = { name: "", email: "", phone: "" };

async function fetchAddressBook() {
  const [addressResult, profile] = await Promise.all([
    fetchCustomerAddresses(),
    fetchCustomerProfile(),
  ]);

  return { addresses: addressResult.rows, profile };
}

function blankAddress(profile: CustomerProfile): AddressFormState {
  return {
    label: "Home",
    recipient_name: profile.name,
    phone: profile.phone,
    address: "",
    city: "",
    latitude: "",
    longitude: "",
    is_default: false,
  };
}

function addressForm(address: CustomerAddress): AddressFormState {
  return {
    label: address.label,
    recipient_name: address.recipient_name,
    phone: address.phone,
    address: address.address,
    city: address.city,
    latitude: address.latitude == null ? "" : String(address.latitude),
    longitude: address.longitude == null ? "" : String(address.longitude),
    is_default: address.is_default,
  };
}

function CustomerAddresses() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { errors, clearError, clearAll, report } = useFieldErrors();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressFormState>(() => blankAddress(emptyProfile));
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchAddressBook();
      setAddresses(result.addresses);
      setProfile(result.profile);
    } catch (error) {
      showToast(getApiError(error, "Unable to load saved addresses"));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;

    fetchAddressBook()
      .then((result) => {
        if (!active) return;
        setAddresses(result.addresses);
        setProfile(result.profile);
      })
      .catch((error) => {
        if (active) showToast(getApiError(error, "Unable to load saved addresses"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

  function openAdd() {
    setEditing(null);
    setForm({ ...blankAddress(profile), is_default: addresses.length === 0 });
    clearAll();
    setFormOpen(true);
  }

  function openEdit(address: CustomerAddress) {
    setEditing(address);
    setForm(addressForm(address));
    clearAll();
    setFormOpen(true);
  }

  function patchForm(patch: Partial<AddressFormState>, errorKey?: string) {
    setForm((current) => ({ ...current, ...patch }));
    if (errorKey) clearError(errorKey);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const valid = report(
      collectFieldErrors([
        ["label", requiredMessage(form.label, "Please enter an address label")],
        ["recipient_name", requiredMessage(form.recipient_name, "Please enter receiver name")],
        ["phone", requiredMessage(form.phone, "Please enter receiver phone")],
        ["address", requiredMessage(form.address, "Please enter the complete address")],
        ["city", requiredMessage(form.city, "Please enter the city")],
      ]),
      showToast
    );

    if (!valid) return;

    await run(async () => {
      try {
        const result = editing
          ? await saveCustomerAddress(editing.id, form)
          : await createCustomerAddress(form);
        showToast(result.message, "success");
        setFormOpen(false);
        setEditing(null);
        await load();
      } catch (error) {
        showToast(getApiError(error, "Unable to save address"));
      }
    });
  }

  async function handleDefault(address: CustomerAddress) {
    await run(async () => {
      try {
        const result = await setDefaultCustomerAddress(address.id);
        showToast(result.message, "success");
        await load();
      } catch (error) {
        showToast(getApiError(error, "Unable to update default address"));
      }
    });
  }

  async function handleDelete() {
    if (!deleting) return;

    await run(async () => {
      try {
        const result = await removeCustomerAddress(deleting.id);
        showToast(result.message, "success");
        setDeleting(null);
        await load();
      } catch (error) {
        showToast(getApiError(error, "Unable to delete address"));
      }
    });
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Saved addresses</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a saved address quickly at checkout.</p>
        </div>
        <ShopButton onClick={openAdd}>
          <IconPlus className="h-4 w-4" />
          Add address
        </ShopButton>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1].map((key) => <div key={key} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : addresses.length === 0 ? (
        <div className="surface-card rounded-2xl p-8 text-center">
          <IconMapPin className="mx-auto h-9 w-9 text-teal-700" />
          <h2 className="mt-3 font-semibold text-slate-900">No saved address yet</h2>
          <p className="mt-1 text-sm text-slate-500">Add an address manually or select it on the map.</p>
          <ShopButton className="mt-4" onClick={openAdd}>Add your first address</ShopButton>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} className="surface-card flex min-h-44 flex-col rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <IconMapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{address.label}</p>
                    <p className="truncate text-xs text-slate-500">{address.recipient_name} · {address.phone}</p>
                  </div>
                </div>
                {address.is_default ? (
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                    Default
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{address.address}</p>
              <p className="text-sm text-slate-500">{address.city}</p>

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {!address.is_default ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 disabled:opacity-50"
                    onClick={() => void handleDefault(address)}
                  >
                    Set as default
                  </button>
                ) : null}
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label={`Edit ${address.label}`}
                    onClick={() => openEdit(address)}
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${address.label}`}
                    onClick={() => setDeleting(address)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen ? (
        <Modal title={editing ? "Edit address" : "Add delivery address"} wide onClose={() => !busy && setFormOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Address label"
                value={form.label}
                error={errors.label}
                placeholder="Home, Office, Parents"
                onChange={(label) => patchForm({ label }, "label")}
              />
              <Field
                label="City"
                value={form.city}
                error={errors.city}
                onChange={(city) => patchForm({ city }, "city")}
              />
              <Field
                label="Receiver name"
                value={form.recipient_name}
                error={errors.recipient_name}
                onChange={(recipient_name) => patchForm({ recipient_name }, "recipient_name")}
              />
              <Field
                label="Receiver phone"
                value={form.phone}
                error={errors.phone}
                onChange={(phone) => patchForm({ phone }, "phone")}
              />
              <div className="sm:col-span-2">
                <StoreLocationPicker
                  label="Complete delivery address"
                  searchPlaceholder="Type an address or search a map location"
                  showAdvancedCoordinates={false}
                  mapHeightClass="h-56"
                  value={{ address: form.address, latitude: form.latitude, longitude: form.longitude }}
                  error={errors.address}
                  onChange={({ address, latitude, longitude }) =>
                    patchForm({ address, latitude, longitude }, "address")
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  disabled={Boolean(editing?.is_default)}
                  onChange={(event) => patchForm({ is_default: event.target.checked })}
                />
                Use as my default delivery address
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <ShopButton variant="ghost" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</ShopButton>
              <ShopButton type="submit" loading={busy}>{busy ? "Saving..." : "Save address"}</ShopButton>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmModal
          title="Delete saved address?"
          message={`“${deleting.label}” will be removed from your address book. Existing orders will keep their original delivery address.`}
          loading={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  );
}

export default CustomerAddresses;
