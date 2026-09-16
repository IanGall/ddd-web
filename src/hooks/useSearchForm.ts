import { useState, useCallback, useRef } from 'react';

export function useSearchForm<T extends Record<string, unknown>>(
  initialValues: T,
): {
  values: T;
  setField: <K extends keyof T>(name: K, value: T[K]) => void;
  reset: () => void;
  getValues: () => T;
} {
  const initialRef = useRef<T>({ ...initialValues });
  const [values, setValues] = useState<T>(() => ({ ...initialValues }));
  const valuesRef = useRef<T>(values);
  valuesRef.current = values;

  const setField = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      valuesRef.current = next;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = { ...initialRef.current };
    valuesRef.current = next;
    setValues(next);
  }, []);

  const getValues = useCallback((): T => {
    return { ...valuesRef.current };
  }, []);

  return {
    values,
    setField,
    reset,
    getValues,
  };
}
