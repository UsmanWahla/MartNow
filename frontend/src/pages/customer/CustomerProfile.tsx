import { useEffect, useState } from "react";
import Field from "../../components/shared/Field";
import ShopButton from "../../components/shop/ShopButton";
import { fetchCustomerProfile, saveCustomerProfile } from "../../api";
import { getApiError, saveUser } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import type { CustomerProfile as CustomerProfileType } from "../../types";
import { collectFieldErrors, requiredMessage } from "../../utils/formValidate";

const emptyProfile: CustomerProfileType = { name: "", email: "", phone: "" };

function CustomerProfile() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { errors, clearError, report } = useFieldErrors();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setProfile(await fetchCustomerProfile());
      } catch (error) {
        showToast(getApiError(error, "Unable to load profile"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const valid = report(
      collectFieldErrors([
        ["name", requiredMessage(profile.name, "Please enter your full name")],
        ["phone", requiredMessage(profile.phone, "Please enter your phone number")],
      ]),
      showToast
    );

    if (!valid) return;

    await run(async () => {
      try {
        const result = await saveCustomerProfile({ name: profile.name, phone: profile.phone });
        setProfile(result.profile);
        saveUser(result.user);
        showToast(result.message, "success");
      } catch (error) {
        showToast(getApiError(error, "Unable to save profile"));
      }
    });
  }

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your main details are shared across every store.</p>
      </div>

      <form className="surface-card rounded-2xl p-5 sm:p-7" onSubmit={handleSubmit}>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Full name"
                value={profile.name}
                error={errors.name}
                onChange={(name) => {
                  setProfile((current) => ({ ...current, name }));
                  clearError("name");
                }}
              />
            </div>
            <Field label="Email" type="email" value={profile.email} disabled onChange={() => undefined} />
            <Field
              label="Phone"
              value={profile.phone}
              error={errors.phone}
              placeholder="e.g. 0300 1234567"
              onChange={(phone) => {
                setProfile((current) => ({ ...current, phone }));
                clearError("phone");
              }}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
          <ShopButton type="submit" loading={busy} disabled={loading}>
            {busy ? "Saving..." : "Save profile"}
          </ShopButton>
        </div>
      </form>
    </section>
  );
}

export default CustomerProfile;
