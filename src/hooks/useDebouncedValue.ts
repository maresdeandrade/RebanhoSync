import { useState, useEffect } from 'react';

/**
 * Custom hook that returns a debounced value.
 * Useful for search inputs and other scenarios where you want to delay
 * expensive operations until user stops typing.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 * 
 * @example
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebouncedValue(search, 300);
 * 
 * // Use debouncedSearch in queries instead of search
 * const results = useLiveQuery(() => {
 *   if (!debouncedSearch) return [];
 *   return db.items.where('name').startsWithIgnoreCase(debouncedSearch).toArray();
 * }, [debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
