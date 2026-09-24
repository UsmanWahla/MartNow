import { useCallback, useState } from "react";
import {
  reportFieldErrors,
  type FieldErrors,
} from "../utils/formValidate";

export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearError = useCallback((key: string) => {
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const report = useCallback(
    (next: FieldErrors, showToast: (message: string) => void) =>
      reportFieldErrors(next, setErrors, showToast),
    []
  );

  return { errors, setErrors, clearError, clearAll, report };
}
