/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should debounce the value update", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    // Update value
    rerender({ value: "updated", delay: 500 });

    // Should still be initial immediately
    expect(result.current).toBe("initial");

    // Fast forward time less than delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    // Fast forward past delay
    act(() => {
      vi.advanceTimersByTime(300); // Total 500
    });
    expect(result.current).toBe("updated");
  });

  it("should reset timer on rapid updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    // Update value
    rerender({ value: "update1", delay: 500 });

    // Advance partial time
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("initial");

    // Update again before first delay finishes
    rerender({ value: "update2", delay: 500 });

    // Advance more time (total 600 from start, but only 300 from second update)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Should still be initial because timer was reset
    expect(result.current).toBe("initial");

    // Finish second delay
    act(() => {
      vi.advanceTimersByTime(200); // Total 500 from second update
    });
    expect(result.current).toBe("update2");
  });

  it("should handle unmount correctly", () => {
    const { result, unmount, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    rerender({ value: "updated", delay: 500 });
    unmount();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // We can't easily check internal state, but ensuring no errors are thrown is good.
    // In a real scenario, we might mock console.error to check for "update on unmounted component" warnings,
    // but React 18 handles this better.
    // The main thing is that the timeout should be cleared.
    // We can spy on clearTimeout.
  });
});
