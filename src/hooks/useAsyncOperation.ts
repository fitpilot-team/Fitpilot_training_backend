import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface AsyncOperationState<T> {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
}

interface AsyncOperationOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
}

/**
 * Generic hook for async operations with loading/error state management
 * Reduces boilerplate in CRUD operations across all pages
 */
export function useAsyncOperation<T = unknown, E = Error>() {
  const [state, setState] = useState<AsyncOperationState<T>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      options: AsyncOperationOptions = {}
    ): Promise<T | null> => {
      const { successMessage, errorMessage, showToast = true } = options;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await operation();
        setState({ isLoading: false, error: null, data: result });

        if (showToast && successMessage) {
          toast.success(successMessage);
        }

        return result;
      } catch (err) {
        const error = err as E;
        setState({ isLoading: false, error: error as Error, data: null });

        if (showToast) {
          const message = errorMessage || (error as any)?.message || 'An error occurred';
          toast.error(message);
        }

        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, data: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Simplified hook for operations that only need loading state
 */
export function useLoadingState(initialLoading = false) {
  const [isLoading, setIsLoading] = useState(initialLoading);

  const withLoading = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      try {
        return await operation();
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { isLoading, setIsLoading, withLoading };
}

export default useAsyncOperation;
