import { Link, useNavigate } from "react-router-dom";
import { saveSession, getApiError } from "../auth";
import { loginAccount } from "../api";
import AuthCard from "../components/AuthCard";
import AuthLoginFields from "../components/AuthLoginFields";
import { useToast } from "../hooks/useToast";
import { useFieldErrors } from "../hooks/useFieldErrors";
import { collectFieldErrors, requiredMessage, usernameMessage } from "../utils/formValidate";
import { useState } from "react";

function Login() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { errors, clearError, clearAll, report } = useFieldErrors();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !report(
        collectFieldErrors([
          ["username", usernameMessage(username)],
          ["password", requiredMessage(password, "Please enter your password")],
        ]),
        showToast
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const response = await loginAccount({ username, password });
      clearAll();
      saveSession(response.user, response.token);

      if (response.user.role === "super_admin") {
        navigate("/super", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (loginError: unknown) {
      report({ password: getApiError(loginError, "Unable to connect to server") }, showToast);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Login to your account"
      footer={
        <>
          Store logins are created by the platform admin.{" "}
          <Link to="/account/login" className="font-semibold text-teal-700">
            Customer login
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleLogin}>
        <AuthLoginFields
          identifier={username}
          password={password}
          identifierError={errors.username}
          passwordError={errors.password}
          loading={loading}
          identifierLabel="Username"
          identifierPlaceholder="Enter your username"
          identifierType="text"
          onIdentifier={(value) => {
            setUsername(value);
            clearError("username");
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

export default Login;
