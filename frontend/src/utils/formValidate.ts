/** Client-side checks; keep username/password rules in sync with backend/utils/validation.js */
export type FieldErrors = Record<string, string>;

export function requiredMessage(
  value: string | number | null | undefined,
  message = "Please fill this field"
) {
  if (value === null || value === undefined) {
    return message;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? "" : message;
  }

  return String(value).trim() ? "" : message;
}

export function usernameMessage(value: string) {
  const username = value.trim().toLowerCase();

  if (!username) {
    return "Please enter a username";
  }

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return "Use 3–32 characters: letters, numbers, . _ -";
  }

  return "";
}

export function emailMessage(value: string, message = "Enter a valid email") {
  const email = value.trim();

  if (!email) {
    return "Please enter your email";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return message;
  }

  return "";
}

export function passwordStrengthMessage(value: string) {
  if (!value.trim()) {
    return "Please enter a password";
  }

  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Use 8+ characters with a letter and a number";
  }

  return "";
}

export function collectFieldErrors(
  entries: Array<[string, string]>
): FieldErrors {
  const errors: FieldErrors = {};

  for (const [key, message] of entries) {
    if (message) {
      errors[key] = message;
    }
  }

  return errors;
}

export function firstFieldError(errors: FieldErrors) {
  return Object.values(errors).find(Boolean) || "";
}

/** Sets field errors and toasts only the first issue. Returns true when valid. */
export function reportFieldErrors(
  errors: FieldErrors,
  setErrors: (next: FieldErrors) => void,
  showToast: (message: string) => void
) {
  setErrors(errors);
  const first = firstFieldError(errors);

  if (!first) {
    return true;
  }

  showToast(first);
  return false;
}

export function fieldInputClass(error?: string, base = "field-input") {
  return error ? `${base} field-input--error` : base;
}
