import Field from "./Field";
import PasswordInput from "./PasswordInput";
import SubmitButton from "./SubmitButton";

interface AuthLoginFieldsProps {
  identifier: string;
  password: string;
  identifierError?: string;
  passwordError?: string;
  loading: boolean;
  onIdentifier: (value: string) => void;
  onPassword: (value: string) => void;
  idleLabel?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  identifierType?: "email" | "text";
}

function AuthLoginFields({
  identifier,
  password,
  identifierError,
  passwordError,
  loading,
  onIdentifier,
  onPassword,
  idleLabel = "Login",
  identifierLabel = "Email",
  identifierPlaceholder = "Enter your email",
  identifierType = "email",
}: AuthLoginFieldsProps) {
  return (
    <>
      <Field
        label={identifierLabel}
        type={identifierType}
        placeholder={identifierPlaceholder}
        value={identifier}
        error={identifierError}
        onChange={onIdentifier}
        disabled={loading}
      />
      <PasswordInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        error={passwordError}
        onChange={onPassword}
        disabled={loading}
      />
      <SubmitButton loading={loading} idleLabel={idleLabel} loadingLabel="Logging in..." />
    </>
  );
}

export default AuthLoginFields;
