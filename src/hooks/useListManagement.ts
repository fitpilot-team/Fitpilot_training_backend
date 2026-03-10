import { useState, useCallback, useMemo } from 'react';

/**
 * Generic hook for managing CRUD operations on lists
 * Reduces repetitive list state management in pages
 */
export function useListManagement<T extends { id: string }>(initialItems: T[] = []) {
  const [items, setItems] = useState<T[]>(initialItems);

  const add = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const addMany = useCallback((newItems: T[]) => {
    setItems((prev) => [...newItems, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const removeMany = useCallback((ids: string[]) => {
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
  }, []);

  const update = useCallback((id: string, changes: Partial<T>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }, []);

  const replace = useCallback((id: string, newItem: T) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? newItem : item))
    );
  }, []);

  const find = useCallback(
    (id: string): T | undefined => items.find((item) => item.id === id),
    [items]
  );

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setItems((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  return {
    items,
    setItems,
    add,
    addMany,
    remove,
    removeMany,
    update,
    replace,
    find,
    clear,
    reorder,
    count: items.length,
    isEmpty: items.length === 0,
  };
}

/**
 * Hook for filtering and searching lists
 */
export function useFilteredList<T, F extends Record<string, any>>(
  items: T[],
  filterFn: (item: T, filters: F) => boolean,
  initialFilters: F
) {
  const [filters, setFilters] = useState<F>(initialFilters);

  const filtered = useMemo(
    () => items.filter((item) => filterFn(item, filters)),
    [items, filters, filterFn]
  );

  const updateFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initial = initialFilters[key as keyof F];
      return value !== initial && value !== '' && value !== null;
    });
  }, [filters, initialFilters]);

  return {
    filtered,
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    totalCount: items.length,
    filteredCount: filtered.length,
  };
}

export default useListManagement;
