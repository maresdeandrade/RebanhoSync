export const BASELINE_SHA = "3b3bc96db331c2917167cf8370024332f505d9f7";

export function parseOptions(args) {
  const options = { workload: "indexeddb", animals: 100, events: 1000, gestures: 100, farms: 2, runs: 3, mode: "cold", purpose: "proof" };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    if (!args[i]?.startsWith("--") || !(key in options) || args[i + 1] === undefined) throw new Error("INVALID_OPTIONS");
    options[key] = typeof options[key] === "number" ? Number(args[i + 1]) : args[i + 1];
  }
  if (!["indexeddb", "queue", "pull", "reconnect"].includes(options.workload) || !["cold", "warm"].includes(options.mode)) throw new Error("INVALID_WORKLOAD_OR_MODE");
  if (!["proof", "benchmark"].includes(options.purpose)) throw new Error("INVALID_PURPOSE");
  for (const key of ["animals", "events", "gestures", "farms", "runs"]) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new Error("INVALID_COUNT");
  }
  if (options.farms < 2 || options.animals < options.farms || options.gestures < options.farms) throw new Error("ISOLATION_REQUIRES_TWO_POPULATED_FARMS");
  if (options.animals > 50000 || options.events > 500000 || options.gestures > 10000 || options.runs > 1000 || options.farms > 20) throw new Error("OUTSIDE_P0_ENVELOPE");
  return options;
}

export function assertMigrationBaseline(actual, expected, purpose) {
  const match = JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
  if (purpose === "benchmark" && !match) throw new Error("LOCAL_MIGRATION_BASELINE_NOT_ALIGNED");
  return match;
}

export function summarize(values) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error("INVALID_SAMPLES");
  const sorted = [...values].sort((a, b) => a - b);
  const median = list => (list[Math.floor((list.length - 1) / 2)] + list[Math.ceil((list.length - 1) / 2)]) / 2;
  const center = median(sorted);
  const deviations = sorted.map(value => Math.abs(value - center)).sort((a, b) => a - b);
  return {
    sample_count: values.length, median_ms: center, min_ms: sorted[0], max_ms: sorted.at(-1),
    range_ms: sorted.at(-1) - sorted[0], median_absolute_deviation_ms: median(deviations),
    // At least ten expected tail observations; full runs, never rows, are samples.
    p95_ms: sorted.length >= 200 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
    p99_ms: sorted.length >= 1000 ? sorted[Math.ceil(sorted.length * 0.99) - 1] : null,
  };
}

export function assertLocalUrl(value, protocols) {
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("LOCAL_TARGET_REQUIRED");
  return url;
}
