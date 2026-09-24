import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Field from "../../components/Field";
import PasswordInput from "../../components/PasswordInput";
import Money from "../../components/Money";
import ShopButton from "../../components/shop/ShopButton";
import {
  fetchShopOrders,
  fetchShopProfile,
  saveShopPassword,
  saveShopProfile,
} from "../../api";
import { getApiError, getUser, isShopperSession, saveUser, shopLoginPath } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import type { ShopOrder } from "../../types";
import { onlineOrderStatusLabel } from "../../types";
import {
  collectFieldErrors,
  fieldInputClass,
  passwordStrengthMessage,
  requiredMessage,
} from "../../utils/formValidate";

function ShopProfile() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { errors, clearError, report } = useFieldErrors();

  useEffect(() => {
    if (!isShopperSession()) {
      navigate(shopLoginPath(slug, `/shop/${slug}/account`), { replace: true });
      return;
    }

    async function load() {
      try {
        const [nextProfile, nextOrders] = await Promise.all([
          fetchShopProfile(slug),
          fetchShopOrders(slug),
        ]);
        setProfile(nextProfile);
        setOrders(nextOrders.rows);
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to load account"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug, navigate, showToast]);

  async function handleProfile(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([["name", requiredMessage(profile.name, "Please enter your full name")]]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveShopProfile(slug, {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          city: profile.city,
        });
        if (response.user) {
          saveUser({ ...getUser()!, ...response.user });
        }
        if (response.profile) {
          setProfile(response.profile);
        }
        showToast(response.message, "success");
      } catch (loadError) {
        showToast(getApiError(loadError, "Unable to save profile"));
      }
    });
  }

  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([
          [
            "currentPassword",
            requiredMessage(currentPassword, "Please enter your current password"),
          ],
          ["newPassword", passwordStrengthMessage(newPassword)],
        ]),
        showToast
      )
    ) {
      return;
    }

    await run(async () => {
      try {
        const response = await saveShopPassword(slug, {
          currentPassword,
          newPassword,
        });
        setCurrentPassword("");
        setNewPassword("");
        showToast(response.message, "success");
      } catch (loadError) {
        report(
          { currentPassword: getApiError(loadError, "Unable to update password") },
          showToast
        );
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading account...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your details are reused at checkout. Email cannot be changed here.
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-white p-1 surface-card">
        <button
          type="button"
          className={`shop-nav flex-1 justify-center ${
            tab === "profile" ? "bg-teal-50 text-teal-800" : "text-slate-600"
          }`}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          className={`shop-nav flex-1 justify-center ${
            tab === "password" ? "bg-teal-50 text-teal-800" : "text-slate-600"
          }`}
          onClick={() => setTab("password")}
        >
          Password
        </button>
      </div>

      {tab === "profile" ? (
        <form className="surface-card rounded-2xl p-6 sm:p-7" onSubmit={handleProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Full name"
                value={profile.name}
                error={errors.name}
                onChange={(name) => {
                  setProfile({ ...profile, name });
                  clearError("name");
                }}
              />
            </div>
            <Field label="Email" value={profile.email} onChange={() => undefined} disabled />
            <Field
              label="Phone"
              value={profile.phone}
              onChange={(phone) => setProfile({ ...profile, phone })}
            />
            <div className="sm:col-span-2">
              <label className="mb-1 block font-semibold">Address</label>
              <textarea
                className={`${fieldInputClass(errors.address)} min-h-24`}
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
              />
            </div>
            <Field
              label="City"
              value={profile.city}
              onChange={(city) => setProfile({ ...profile, city })}
            />
          </div>
          <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
            <ShopButton type="submit" loading={busy}>
              {busy ? "Saving..." : "Save profile"}
            </ShopButton>
          </div>
        </form>
      ) : (
        <form className="surface-card rounded-2xl p-6 sm:p-7" onSubmit={handlePassword}>
          <div className="grid max-w-md gap-4">
            <PasswordInput
              label="Current password"
              value={currentPassword}
              error={errors.currentPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                clearError("currentPassword");
              }}
            />
            <PasswordInput
              label="New password"
              value={newPassword}
              error={errors.newPassword}
              onChange={(value) => {
                setNewPassword(value);
                clearError("newPassword");
              }}
            />
          </div>
          <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
            <ShopButton type="submit" loading={busy}>
              {busy ? "Saving..." : "Update password"}
            </ShopButton>
          </div>
        </form>
      )}

      <section className="surface-card rounded-2xl p-6 sm:p-7">
        <h2 className="font-semibold text-slate-900">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/shop/${slug}/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-teal-800"
                >
                  <span className="font-semibold">#{order.id}</span>
                  <span className="capitalize text-slate-500">
                    {onlineOrderStatusLabel(order)}
                  </span>
                  <Money value={order.total_amount} className="font-semibold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ShopProfile;
