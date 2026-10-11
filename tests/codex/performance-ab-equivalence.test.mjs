import { test } from 'vitest';
import assert from 'node:assert/strict';
import { verifyABEquivalence } from '../../scripts/codex/performance-ab-equivalence.mjs';
const fixture = () => ({independent_series:'E2-independent',post_ack_series:['original','optimized'].map(variant => ({variant,run:1,evidence:{post_ack_variant:variant,independent_series:'E2-independent',harness_sha256:'same-harness',dataset:{gestures:100,farms:2},effective_product_sha256:{pull:variant}}}))});
test('A/B rejects mixed instrumentation and duplicate samples', () => {
  const valid=fixture(); assert.equal(verifyABEquivalence(valid).runs,2);
  const mixed=fixture(); mixed.post_ack_series[1].evidence.harness_sha256='other'; assert.throws(()=>verifyABEquivalence(mixed),/CONFIGURATION_MISMATCH/);
  const duplicate=fixture(); duplicate.post_ack_series.push(duplicate.post_ack_series[0]); assert.throws(()=>verifyABEquivalence(duplicate),/DUPLICATE_RUN/);
});
test('A/B rejects variant drift and identical control/treatment', () => {
  const identical=fixture(); identical.post_ack_series[1].evidence.effective_product_sha256={pull:'original'}; assert.throws(()=>verifyABEquivalence(identical),/VARIANTS_IDENTICAL/);
  const drift=fixture(); drift.post_ack_series.push({...drift.post_ack_series[0],run:2,evidence:{...drift.post_ack_series[0].evidence,effective_product_sha256:{pull:'changed'}}}); assert.throws(()=>verifyABEquivalence(drift),/VARIANT_CHANGED/);
});
