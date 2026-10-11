import assert from "node:assert/strict";
import { test } from "vitest";
import { parseOptions, summarize, assertLocalUrl, assertMigrationBaseline } from "../../scripts/codex/performance-contract.mjs";

test("rejects nonlocal targets, malformed workloads and unsafe sizes", () => {
  assert.throws(() => assertLocalUrl("https://example.com", ["http:"]), /LOCAL_TARGET/);
  assert.throws(() => assertLocalUrl("http://127.0.0.1.example.com", ["http:"]), /LOCAL_TARGET/);
  assert.throws(() => parseOptions(["--runs", "NaN"]), /INVALID_COUNT/);
  assert.throws(() => parseOptions(["--farms", "1"]), /ISOLATION/);
  assert.throws(() => parseOptions(["--events", "500001"]), /OUTSIDE_P0/);
  assert.throws(() => parseOptions(["--unknown", "1"]), /INVALID_OPTIONS/);
  assert.equal(assertLocalUrl("http://127.0.0.1:54321", ["http:"]).hostname, "127.0.0.1");
});

test("backend history mismatch blocks benchmarks but remains explicit in harness proofs", () => {
  assert.equal(assertMigrationBaseline(["2", "1"], ["1", "2"], "benchmark"), true);
  assert.equal(assertMigrationBaseline(["1"], ["1", "2"], "proof"), false);
  assert.throws(() => assertMigrationBaseline(["1"], ["1", "2"], "benchmark"), /NOT_ALIGNED/);
  assert.throws(() => assertMigrationBaseline(["1", "2", "3"], ["1", "2"], "benchmark"), /NOT_ALIGNED/);
});

test("small complete runs retain dispersion and suppress unsupported percentiles", () => {
  assert.deepEqual(summarize([1, 2, 4]), { sample_count: 3, median_ms: 2, min_ms: 1, max_ms: 4, range_ms: 3, median_absolute_deviation_ms: 1, p95_ms: null, p99_ms: null });
  assert.equal(summarize([1, 3]).median_ms, 2);
  assert.throws(() => summarize([NaN]), /INVALID_SAMPLES/);
  assert.throws(() => summarize([-1]), /INVALID_SAMPLES/);
  assert.throws(() => summarize([]), /INVALID_SAMPLES/);
  assert.equal(summarize(Array.from({ length: 200 }, (_, i) => i)).p95_ms, 189);
  assert.equal(summarize(Array.from({ length: 999 }, (_, i) => i)).p99_ms, null);
  assert.equal(summarize(Array.from({ length: 1000 }, (_, i) => i)).p99_ms, 989);
});
