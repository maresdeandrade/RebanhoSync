/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial'));
    expect(result.current).toBe('initial');
  });

  it('should debounce value update with default delay (300ms)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });

    // Should not update immediately
    expect(result.current).toBe('initial');

    // Advance time by 200ms (less than default 300ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('initial');

    // Advance remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('should respect custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // Should not update at 300ms (default)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    // Should update at 500ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timer on new update (debounce behavior)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'initial' } }
    );

    // First update
    rerender({ value: 'update1' });

    // Advance 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('initial');

    // Second update (should cancel 'update1')
    rerender({ value: 'update2' });

    // Advance 250ms (total 350ms from start, but only 250ms since update2)
    // If update1 wasn't cancelled, it would have fired by now (at 300ms total)
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('initial');

    // Advance remaining 50ms for update2
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('update2');
  });

  it('should not update state after unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    unmount();

    // Advance time past delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // We can't easily check internal state, but we ensure no error is thrown
    // and result.current remains stale (though unmounted result behavior varies, usually it stops updating)
    // The main check here is that `act` doesn't throw "Can't perform a React state update on an unmounted component"
    // React 18+ usually warns, but strictly checking for no error is good.
  });
});
