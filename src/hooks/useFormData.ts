import { useState, useCallback } from 'react';

/**
 * Generic hook for simple form state management
 * Useful for modals and forms that don't need react-hook-form complexity
 */
export function useFormData<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const reset = useCallback((newData?: T) => {
    setFormData(newData ?? initialData);
    setIsDirty(false);
  }, [initialData]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;

      let parsedValue: any = value;

      if (type === 'number') {
        parsedValue = value === '' ? '' : Number(value);
      } else if (type === 'checkbox') {
        parsedValue = (e.target as HTMLInputElement).checked;
      }

      updateField(name as keyof T, parsedValue);
    },
    [updateField]
  );

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    reset,
    handleChange,
    isDirty,
  };
}

/**
 * Hook for form validation with simple rules
 */
export function useFormValidation<T extends Record<string, any>>(
  formData: T,
  rules: Partial<Record<keyof T, (value: any) => string | null>>
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const [field, rule] of Object.entries(rules)) {
      if (rule) {
        const error = rule(formData[field as keyof T]);
        if (error) {
          newErrors[field as keyof T] = error;
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, rules]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  return {
    errors,
    validate,
    clearErrors,
    setFieldError,
    hasErrors: Object.keys(errors).length > 0,
  };
}

export default useFormData;
