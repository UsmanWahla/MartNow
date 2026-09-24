import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { getApiError, saveSession } from "../../auth";
import { loginSuperAccount } from "../../api";
import AuthCard from "../../components/AuthCard";
import AuthLoginFields from "../../components/AuthLoginFields";
import { useToast } from "../../hooks/useToast";
import { useFieldErrors } from "../../hooks/useFieldErrors";
import { collectFieldErrors, emailMessage, requiredMessage } from "../../utils/formValidate";

function SuperLogin() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { errors, clearError, clearAll, report } = useFieldErrors();

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    if (
      !report(
        collectFieldErrors([
          ["email", emailMessage(email)],
          ["password", requiredMessage(password, "Please enter your password")],
        ]),
        showToast
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const response = await loginSuperAccount({ email, password });
      clearAll();
      saveSession(response.user, response.token);
      navigate("/super", { replace: true });
    } catch (loginError: unknown) {
      report({ password: getApiError(loginError, "Unable to login") }, showToast);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Platform admin" subtitle="Manage stores and marketplace analytics">
      <form className="flex flex-col gap-4" onSubmit={handleLogin}>
        <AuthLoginFields
          identifier={email}
          password={password}
          identifierError={errors.email}
          passwordError={errors.password}
          loading={loading}
          onIdentifier={(value) => {
            setEmail(value);
            clearError("email");
          }}
          onPassword={(value) => {
            setPassword(value);
            clearError("password");
          }}
        />
      </form>
    </AuthCard>
  );
}

export default SuperLogin;
