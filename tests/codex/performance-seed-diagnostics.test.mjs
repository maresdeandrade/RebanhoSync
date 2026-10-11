import test from 'node:test';
import assert from 'node:assert/strict';
import { safeSeedError } from '../../scripts/codex/performance-seed-diagnostics.mjs';
test('seed errors retain type/code and strip credentials, URLs, JSON and literals', () => {
  const secret = 'fixture-private-secret';
  const error = { name: 'TypeError', code: 'FETCH_FAILED', message: `Failed to fetch https://localhost/auth?password=${secret} Bearer eyJabc.def.ghi user@example.test ${secret} {"payload":"private"}`, stack: `TypeError: ${secret}\n at seed (http://localhost/seed.ts:12:3)` };
  const result = safeSeedError(error, [secret]);
  assert.equal(result.type, 'TypeError'); assert.equal(result.code, 'FETCH_FAILED'); assert.equal(result.category, 'TRANSPORT_OR_MODULE_IMPORT');
  for (const forbidden of [secret, 'eyJabc', 'user@example', 'password=', '"private"', 'http://']) assert.ok(!JSON.stringify(result).includes(forbidden));
});
test('quota and lifecycle classifications are diagnostic only', () => {
  assert.equal(safeSeedError({name:'QuotaExceededError',code:22,message:'Quota exceeded'}).category,'INDEXEDDB_QUOTA');
  assert.equal(safeSeedError({name:'Error',message:'Target page, context or browser has been closed'}).category,'BROWSER_LIFECYCLE');
  assert.equal(safeSeedError({name:'AbortError',message:'Transaction aborted'}).category,'INDEXEDDB_OR_TRANSACTION');
  assert.equal(safeSeedError({name:'Error',message:'unknown'}).category,'UNCLASSIFIED');
});
