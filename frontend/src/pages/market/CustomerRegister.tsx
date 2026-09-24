import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { getApiError, saveSession } from "../../auth";
import { signupCustomerAccount } from "../../api";
import PasswordInput from "../../components/PasswordInput";
import AuthCard from "../../components/AuthCard";
import Field from "../../components/Field";
import SubmitButton from "../../components/SubmitButton";
import { useToast } from "../../hooks/useToast";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import {
  collectFieldErrors,
  emailMessage,
  passwordStrengthMessage,
  requiredMessage,
} from "../../utils/formValidate";

function CustomerRegister() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { errors, clearError, clearAll, report } = useFieldErrors();

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors = collectFieldErrors([
      ["name", requiredMessage(name, "Please enter your name")],
      ["email", emailMessage(email)],
      ["password", passwordStrengthMessage(password)],
      [
        "confirmPassword",
        !confirmPassword.trim()
          ? "Please confirm your password"
          : password !== confirmPassword
            ? "Passwords do not match"
            : "",
      ],
    ]);

    if (!report(nextErrors, showToast)) {
      return;
    }

    setLoading(true);

    try {
      const response = await signupCustomerAccount({ name, email, password });
      clearAll();
      saveSession(response.user, response.token);
      const next = searchParams.get("next") || "/stores";
      navigate(next.startsWith("/") ? next : "/stores", { replace: true });
    } catch (signupError: unknown) {
      report({ email: getApiError(signupError, "Unable to create account") }, showToast);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Shop any store with one login"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={`/account/login?next=${encodeURIComponent(searchParams.get("next") || "/stores")}`}
            className="font-semibold text-teal-700"
          >
            Login
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSignup}>
        <Field
          label="Full name"
          placeholder="Enter your name"
          value={name}
          error={errors.name}
          onChange={(value) => {
            setName(value);
            clearError("name");
          }}
          disabled={loading}
        />
        <Field
          label="Email"
          type="email"
          placeholder="Enter your email"
          value={email}
          error={errors.email}
          onChange={(value) => {
            setEmail(value);
            clearError("email");
          }}
          disabled={loading}
        />
        <PasswordInput
          label="Password"
          placeholder="8+ characters, letter and number"
          value={password}
          error={errors.password}
          onChange={(value) => {
            setPassword(value);
            clearError("password");
          }}
          disabled={loading}
        />
        <PasswordInput
          label="Confirm password"
          placeholder="Re-enter password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            clearError("confirmPassword");
          }}
          disabled={loading}
        />
        <SubmitButton loading={loading} idleLabel="Create account" loadingLabel="Creating..." />
      </form>
    </AuthCard>
  );
}

export default CustomerRegister;
