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

  const setField = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues({ ...initialRef.current });
  }, []);

  const getValues = useCallback((): T => ({ ...values }), [values]);

  return {
    values,
    setField,
    reset,
    getValues,
  };
}
