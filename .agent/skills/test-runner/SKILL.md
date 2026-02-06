---
name: test-runner
description: Use when running tests, setting up test framework, or asking "run tests", "test", "vitest", "e2e", "how do I test".
---

# Test Runner - GestaoAgro

## Mission

Guide developers in running tests for the GestaoAgro project. Currently, the project **does not have a test framework** configured. This skill provides instructions for both running existing tests (once added) and setting up the test infrastructure.

## When to Use

- User asks: "run tests", "how do I test", "test this", "vitest", "e2e"
- Before submitting a PR (test validation)
- After making code changes (regression check)
- Setting up test framework for the first time

## Current State

⚠️ **NO TEST FRAMEWORK DETECTED** in `package.json`

Recommended setup:

- **Unit/Integration**: Vitest (fast, Vite-native)
- **E2E**: Playwright (browser automation)
- **Component**: React Testing Library

## Inputs

- Project dependencies installed (`pnpm install`)
- Code changes to test (if running existing tests)

## Procedure

### If Tests Already Exist

#### Run All Tests

```bash
pnpm test
```

**Expected**: Runs all unit + integration tests via Vitest

#### Run in Watch Mode

```bash
pnpm test:watch
```

**Expected**: Re-runs tests on file changes (useful during development)

#### Run E2E Tests

```bash
pnpm test:e2e
```

**Expected**: Launches Playwright, runs browser tests

#### Run Specific Test File

```bash
pnpm test src/__tests__/syncWorker.test.ts
```

### If Tests Do NOT Exist (Setup Required)

**⚠️ TODO: Confirm with team before proceeding**

#### 0. Verify Config Exists

```bash
# Check if vitest.config.ts exists
ls vitest.config.ts

# If file NOT FOUND, proceed with setup below
# If file EXISTS, skip to step 5 (write tests)
```

**Current Status**: ❌ `vitest.config.ts` does NOT exist in project root

#### 1. Install Vitest (Unit/Integration)

```bash
pnpm add -D vitest @vitest/ui
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D jsdom
```

#### 2. Create `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

#### 3. Create `src/setupTests.ts`

```typescript
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock IndexedDB for Dexie tests
const indexedDB = require("fake-indexeddb");
global.indexedDB = indexedDB;
```

#### 4. Add Scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

#### 5. Example Test (Animal Lifecycle)

```typescript
// src/__tests__/offline/ops.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createGesture, applyOpLocal } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";

describe("createGesture", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("should create gesture with PENDING status", async () => {
    const fazenda_id = crypto.randomUUID();
    const client_tx_id = await createGesture(fazenda_id, [
      {
        table: "animais",
        action: "INSERT",
        record: { id: crypto.randomUUID(), identificacao: "123" },
      },
    ]);

    const gesture = await db.queue_gestures.get(client_tx_id);
    expect(gesture).toBeDefined();
    expect(gesture.status).toBe("PENDING");
    expect(gesture.fazenda_id).toBe(fazenda_id);
  });
});
```

## Guardrails

- ❌ Never run E2E tests in production (use staging/local only)
- ❌ Don't commit test database snapshots with PII
- ⚠️ Mock Supabase client in unit tests (avoid real DB calls)
- ⚠️ Clear Dexie DB between tests (`beforeEach(() => db.delete())`)

## Failure Modes & Troubleshooting

### Issue: `pnpm test` command not found

- **Cause**: No test script in `package.json`
- **Fix**: Add test framework (see setup procedure) or ask team

### Issue: Tests fail with "indexedDB is not defined"

- **Cause**: Missing IndexedDB mock for Dexie tests
- **Fix**: Install `fake-indexeddb` and configure in `setupTests.ts`

### Issue: Module resolution errors (`@/lib/...`)

- **Cause**: Path alias not configured in `vitest.config.ts`
- **Fix**: Add `resolve.alias` matching `tsconfig.json` paths

### Issue: React component tests fail

- **Cause**: Missing `jsdom` environment
- **Fix**: Set `environment: 'jsdom'` in vitest config

## Examples

### Run Tests (Once Configured)

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# With UI
pnpm test:ui

# Coverage report
pnpm test:coverage
```

### Test Offline Sync Logic

```typescript
// Test rollback mechanism
it("should rollback INSERT on rejection", async () => {
  const op = {
    client_op_id: crypto.randomUUID(),
    table: "animais",
    action: "INSERT",
    record: { id: "test-id", identificacao: "999" },
  };

  await applyOpLocal(op);
  expect(await db.state_animais.get("test-id")).toBeDefined();

  await rollbackOpLocal(op);
  expect(await db.state_animais.get("test-id")).toBeUndefined();
});
```

### Test Anti-Teleport Validation (E2E)

```typescript
// Playwright test
test("should reject animal movement without evento_movimentacao", async ({
  page,
}) => {
  // 1. Login and select farm
  await page.goto("/login");
  // ... login flow

  // 2. Attempt to move animal without creating event
  await api.post("/functions/v1/sync-batch", {
    ops: [
      {
        table: "animais",
        action: "UPDATE",
        record: { id, lote_id: "new-lote" },
      },
    ],
  });

  // 3. Verify rejection
  const response = await api.waitForResponse();
  expect(response.results[0].status).toBe("REJECTED");
  expect(response.results[0].reason_code).toBe("ANTI_TELEPORTE");
});
```

## Definition of Done

- [ ] Test framework configured (if setup task)
- [ ] `pnpm test` runs without errors
- [ ] All tests pass (if tests exist)
- [ ] Coverage report generated (if requested)
- [ ] No console errors/warnings during test run
- [ ] Tests added for modified code (if PR context)

## References

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Docs](https://playwright.dev/)
- [E2E_MVP.md](../../../docs/E2E_MVP.md) - Test scenarios
