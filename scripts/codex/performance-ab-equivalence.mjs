export function verifyABEquivalence(certificate) {
  const runs = certificate.post_ack_series.filter(s => !s.proof);
  if (!runs.length) throw new Error('AB_SAMPLES_MISSING');
  const first = runs[0].evidence;
  const common = e => JSON.stringify({ series: e.independent_series, baseline: e.benchmark_baseline_sha,
    git: e.git_sha, harness: e.harness_sha256, browser: e.browser, node: e.node, pnpm: e.pnpm,
    dependencies: e.dependency_versions, dataset: e.dataset, environment: e.local_backend });
  const variantHashes = {};
  const identities = new Set();
  for (const run of runs) {
    if (run.evidence.post_ack_variant !== run.variant) throw new Error('AB_VARIANT_LABEL_MISMATCH');
    if (common(run.evidence) !== common(first) || run.evidence.independent_series !== certificate.independent_series) throw new Error('AB_CONFIGURATION_MISMATCH');
    const identity = `${run.variant}:${run.run}`;
    if (identities.has(identity)) throw new Error('AB_DUPLICATE_RUN');
    identities.add(identity);
    const hashes = JSON.stringify(run.evidence.effective_product_sha256);
    if (variantHashes[run.variant] && variantHashes[run.variant] !== hashes) throw new Error('AB_VARIANT_CHANGED');
    variantHashes[run.variant] = hashes;
  }
  if (variantHashes.original && variantHashes.original === variantHashes.optimized) throw new Error('AB_VARIANTS_IDENTICAL');
  return { verified: true, series: certificate.independent_series, common_configuration: JSON.parse(common(first)),
    variant_source_hashes: Object.fromEntries(Object.entries(variantHashes).map(([key, value]) => [key, JSON.parse(value)])),
    runs: runs.length, order: runs.map(s => `${s.variant}:${s.run}`) };
}
