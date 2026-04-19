// Helps React testing environments treat async UI updates as act-aware by default.
// This reduces noisy false-positive act warnings from third-party UI internals.
if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
}
