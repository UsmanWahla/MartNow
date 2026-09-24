import { useEffect, useState, type ReactNode } from "react";
import Avatar from "../components/Avatar";
import PasswordInput from "../components/PasswordInput";
import Field from "../components/Field";
import Select from "../components/Select";
import SaveButton from "../components/SaveButton";
import AddButton from "../components/AddButton";
import Modal from "../components/Modal";
import ModalActions from "../components/ModalActions";
import ConfirmModal from "../components/ConfirmModal";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import RowMenu from "../components/RowMenu";
import {
  IconSettings,
  IconShop,
  IconUdhaar,
  IconUsers,
} from "../components/icons";
import { useToast } from "../hooks/useToast";
import useBusy from "../hooks/useBusy";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { getApiError, getUser, saveUser } from "../auth";
import {
  createStaff,
  fetchSettings,
  fetchStaff,
  removeStaff,
  saveProfile,
  saveSettings,
} from "../api";
import { canManageStaff, getRole } from "../roles";
import type { StaffMember } from "../types";
import {
  collectFieldErrors,
  emailMessage,
  passwordStrengthMessage,
  requiredMessage,
} from "../utils/formValidate";

const emptyStaff = {
  name: "",
  email: "",
  password: "",
  role: "cashier" as "manager" | "cashier",
};

type SettingsTab = "profile" | "shop" | "staff";

function RoleBadge({ role }: { role: string }) {
  const tone =
    role === "owner"
      ? "bg-teal-50 text-teal-800"
      : role === "manager"
        ? "bg-sky-50 text-sky-800"
        : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}
    >
      {role}
    </span>
  );
}

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-600">{label}</p>
      {children}
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Settings() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [user, setUser] = useState(getUser());
  const role = getRole(user);
  const showStaffTab = canManageStaff(role);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState(user?.name ?? "");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(showStaffTab);
  const [staffForm, setStaffForm] = useState(emptyStaff);
  const [shopName, setShopName] = useState(user?.shop_name ?? "");
  const [shopSlug, setShopSlug] = useState(user?.shop_slug ?? "");
  const [lowStock, setLowStock] = useState(String(user?.low_stock_threshold ?? 3));
  const [showStaff, setShowStaff] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StaffMember | null>(null);
  const { errors, clearError, clearAll, report } = useFieldErrors();

  useEffect(() => {
    async function load() {
      try {
        const settings = await fetchSettings();
        setShopName(settings.shop_name);
        setShopSlug(settings.shop_slug || "");
        setLowStock(String(settings.low_stock_threshold));

        if (canManageStaff(role)) {
          setStaff(await fetchStaff());
        }
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load settings"));
      } finally {
        setStaffLoading(false);
      }
    }

    void load();
  }, [role, showToast]);

  async function handleName(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([["name", requiredMessage(name, "Please enter your name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveProfile({ name });
        saveUser(response.user);
        setUser(response.user);
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to update name"));
      }
    });
  }

  async function handleShop(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([
          ["shopName", requiredMessage(shopName, "Please enter the shop name")],
          [
            "lowStock",
            !lowStock.trim() || Number(lowStock) < 1
              ? "Please enter a valid low stock amount"
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
        const response = await saveSettings({
          shop_name: shopName,
          shop_slug: shopSlug,
          low_stock_threshold: Number(lowStock),
        });
        if (response.user) {
          saveUser({ ...getUser()!, ...response.user });
          setUser({ ...getUser()!, ...response.user });
        }
        if (response.settings?.shop_slug) {
          setShopSlug(response.settings.shop_slug);
        }
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to save shop settings"));
      }
    });
  }

  async function handleAddStaff(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([
          ["staffName", requiredMessage(staffForm.name, "Please enter the staff name")],
          ["staffEmail", emailMessage(staffForm.email)],
          ["staffPassword", passwordStrengthMessage(staffForm.password)],
        ]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await createStaff(staffForm);
        setStaff((current) => [response.user, ...current]);
        setStaffForm(emptyStaff);
        setShowStaff(false);
        clearAll();
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to add staff"));
      }
    });
  }

  async function handleDeleteStaff(member: StaffMember) {
    await run(async () => {
      try {
        const response = await removeStaff(member.id);
        setStaff((current) => current.filter((row) => row.id !== member.id));
        setPendingDelete(null);
        showToast(response.message, "success");
      } catch (loadError) {
        const message = getApiError(loadError, "Unable to remove staff");

        if (/not found/i.test(message)) {
          setStaff((current) => current.filter((row) => row.id !== member.id));
          setPendingDelete(null);

          try {
            setStaff(await fetchStaff());
          } catch {
            /* keep local filter */
          }

          showToast("Staff already removed", "success");
          return;
        }

        showToast(message);
      }
    });
  }

  const staffColumns: DataTableColumn<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (member) => member.name,
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortValue: (member) => member.email,
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (member) => member.role,
      render: (member) => <RoleBadge role={member.role} />,
    },
    {
      key: "action",
      header: "Action",
      render: (member) => (
        <RowMenu onDelete={() => setPendingDelete(member)} />
      ),
    },
  ];

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <IconUdhaar className="h-4 w-4" /> },
    { id: "shop", label: "Shop", icon: <IconShop className="h-4 w-4" /> },
    ...(showStaffTab
      ? [{ id: "staff" as const, label: "Staff", icon: <IconUsers className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="anim-fade-up surface-card overflow-hidden rounded-2xl">
        <div className="h-24 bg-[linear-gradient(135deg,#0b1f1c_0%,#134e4a_55%,#0f766e_100%)]" />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-6">
          <div className="-mt-8 rounded-full ring-4 ring-white">
            <Avatar user={user} size="lg" />
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {user?.name || "Account"}
              </h2>
              <RoleBadge role={role} />
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {user?.username ? `@${user.username}` : user?.email ?? "—"}
            </p>
            {shopName ? (
              <p className="mt-1 truncate text-xs font-medium text-teal-800">{shopName}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav className="anim-fade-up surface-card flex gap-1 overflow-x-auto rounded-2xl p-1.5 lg:h-fit lg:flex-col lg:overflow-visible lg:p-2">
          {tabs.map((item) => {
            const active = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-teal-50 font-semibold text-teal-800"
                    : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
                {item.id === "staff" && staff.length > 0 ? (
                  <span className="ml-auto rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500">
                    {staff.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <section className="anim-fade-up surface-card rounded-2xl p-5 sm:p-6">
          {tab === "profile" ? (
            <form className="max-w-lg" onSubmit={handleName}>
              <div className="mb-6 flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                  <IconSettings className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Profile</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    This name appears in the header and on staff records.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <SettingField label="Display name">
                  <Field
                    value={name}
                    error={errors.name}
                    onChange={(value) => {
                      setName(value);
                      clearError("name");
                    }}
                    placeholder="Your name"
                  />
                </SettingField>
                <SettingField
                  label={user?.username ? "Username" : "Email"}
                  hint={
                    user?.username
                      ? "Username is used to sign in and cannot be changed here."
                      : "Email is used to sign in and cannot be changed here."
                  }
                >
                  <Field
                    value={user?.username ? user.username : user?.email ?? ""}
                    onChange={() => undefined}
                    disabled
                  />
                </SettingField>
              </div>
              <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
                <SaveButton loading={busy} />
              </div>
            </form>
          ) : null}

          {tab === "shop" ? (
            <form className="max-w-lg" onSubmit={handleShop}>
              <div className="mb-6 flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                  <IconShop className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Shop</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    These details show in the sidebar and on receipts.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <SettingField label="Shop name">
                  <Field
                    value={shopName}
                    error={errors.shopName}
                    onChange={(value) => {
                      setShopName(value);
                      clearError("shopName");
                    }}
                    placeholder="Shop name"
                  />
                </SettingField>
                <SettingField
                  label="Online shop URL"
                  hint="Customers open this link to browse, log in, and place COD orders."
                >
                  <div className="flex gap-2">
                    <Field
                      value={shopSlug}
                      onChange={setShopSlug}
                      placeholder="ali-mart"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                      onClick={() => {
                        const url = `${window.location.origin}/shop/${shopSlug}`;
                        void navigator.clipboard.writeText(url);
                        showToast("Shop URL copied", "success");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  {shopSlug ? (
                    <p className="mt-1.5 truncate text-xs text-slate-500">
                      {window.location.origin}/shop/{shopSlug}
                    </p>
                  ) : null}
                </SettingField>
                <SettingField
                  label="Low stock alert"
                  hint="Products at or below this quantity are flagged on the dashboard."
                >
                  <Field
                    type="number"
                    min="1"
                    value={lowStock}
                    error={errors.lowStock}
                    onChange={(value) => {
                      setLowStock(value);
                      clearError("lowStock");
                    }}
                  />
                </SettingField>
              </div>
              <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
                <SaveButton loading={busy} />
              </div>
            </form>
          ) : null}

          {tab === "staff" && showStaffTab ? (
            <div>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <IconUsers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Staff</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Add managers and cashiers for this shop.
                    </p>
                  </div>
                </div>
                <AddButton
                  onClick={() => {
                    clearAll();
                    setStaffForm(emptyStaff);
                    setShowStaff(true);
                  }}
                />
              </div>
              <DataTable
                rows={staff}
                columns={staffColumns}
                rowKey={(member) => member.id}
                loading={staffLoading}
                emptyMessage="No staff yet. Add a manager or cashier for this shop."
              />
            </div>
          ) : null}
        </section>
      </div>

      {showStaff ? (
        <Modal
          title="Add Staff"
          onClose={
            busy
              ? () => undefined
              : () => {
                  setShowStaff(false);
                  clearAll();
                }
          }
        >
          <form className="flex flex-col gap-3" onSubmit={handleAddStaff}>
            <Field
              placeholder="Name"
              value={staffForm.name}
              error={errors.staffName}
              onChange={(nameValue) => {
                setStaffForm({ ...staffForm, name: nameValue });
                clearError("staffName");
              }}
            />
            <Field
              type="email"
              placeholder="Email"
              value={staffForm.email}
              error={errors.staffEmail}
              onChange={(email) => {
                setStaffForm({ ...staffForm, email });
                clearError("staffEmail");
              }}
            />
            <PasswordInput
              placeholder="Password (8+ chars, letter and number)"
              value={staffForm.password}
              error={errors.staffPassword}
              onChange={(password) => {
                setStaffForm({ ...staffForm, password });
                clearError("staffPassword");
              }}
            />
            <Select
              value={staffForm.role}
              onChange={(nextRole) =>
                setStaffForm({
                  ...staffForm,
                  role: nextRole as "manager" | "cashier",
                })
              }
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </Select>
            <ModalActions
              loading={busy}
              onCancel={() => {
                setShowStaff(false);
                clearAll();
              }}
            />
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title="Remove Staff"
          message={`Remove ${pendingDelete.name}?`}
          loading={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDeleteStaff(pendingDelete)}
        />
      ) : null}
    </div>
  );
}

export default Settings;
