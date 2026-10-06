import { useState } from "react";
import PasswordInput from "../../components/shared/PasswordInput";
import ShopButton from "../../components/shop/ShopButton";
import { saveCustomerPassword } from "../../api";
import { getApiError } from "../../auth";
import { useToast } from "../../hooks/useToast";
import useBusy from "../../hooks/useBusy";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import {
  collectFieldErrors,
  passwordStrengthMessage,
  requiredMessage,
} from "../../utils/formValidate";

function CustomerSecurity() {
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const { errors, clearError, report } = useFieldErrors();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const valid = report(
      collectFieldErrors([
        ["currentPassword", requiredMessage(currentPassword, "Please enter your current password")],
        ["newPassword", passwordStrengthMessage(newPassword)],
        [
          "confirmPassword",
          !confirmPassword
            ? "Please confirm your new password"
            : confirmPassword !== newPassword
              ? "Passwords do not match"
              : "",
        ],
      ]),
      showToast
    );

    if (!valid) return;

    await run(async () => {
      try {
        const result = await saveCustomerPassword({ currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showToast(result.message, "success");
      } catch (error) {
        report({ currentPassword: getApiError(error, "Unable to update password") }, showToast);
      }
    });
  }

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Password & security</h1>
        <p className="mt-1 text-sm text-slate-500">Use a strong password you do not use elsewhere.</p>
      </div>

      <form className="surface-card rounded-2xl p-5 sm:p-7" onSubmit={handleSubmit}>
        <div className="grid max-w-lg gap-4">
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
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            error={errors.confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              clearError("confirmPassword");
            }}
          />
        </div>
        <div className="mt-6 flex justify-end border-t border-(--hairline) pt-4">
          <ShopButton type="submit" loading={busy}>
            {busy ? "Updating..." : "Update password"}
          </ShopButton>
        </div>
      </form>
    </section>
  );
}

export default CustomerSecurity;
