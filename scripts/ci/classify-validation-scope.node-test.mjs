import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDeltaScope,
  classifyPrScope,
  deriveExecution,
  selectTestTargets,
} from "./classify-validation-scope.mjs";

const scenarios = [
  {
    name: "T1 docs-only PR",
    pr: ["docs/review/note.md"],
    delta: ["docs/review/note.md"],
    expected: {
      prScope: "DOCS",
      deltaScope: "DOCS_ONLY",
      needsApp: false,
      needsSupabase: false,
      needsBuild: false,
      runGlobalTests: false,
      fullFinalRequired: false,
    },
  },
  {
    name: "T2 app-only PR",
    pr: ["src/components/Card.tsx"],
    delta: ["src/components/Card.tsx"],
    expected: {
      prScope: "APP",
      deltaScope: "APP",
      needsApp: true,
      needsSupabase: false,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: false,
    },
  },
  {
    name: "T3 runtime offline change -> FULL",
    pr: ["src/lib/offline/pull.ts"],
    delta: ["src/lib/offline/pull.ts"],
    expected: {
      prScope: "FULL",
      deltaScope: "FULL",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T4 supabase migration -> FULL",
    pr: ["supabase/migrations/20260921000000_change.sql"],
    delta: ["supabase/migrations/20260921000000_change.sql"],
    expected: {
      prScope: "FULL",
      deltaScope: "FULL",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T5 PR FULL + novo delta apenas test-only",
    pr: ["src/lib/offline/pull.ts", "src/lib/offline/__tests__/pull.test.ts"],
    delta: ["src/lib/offline/__tests__/pull.test.ts"],
    expected: {
      prScope: "FULL",
      deltaScope: "TEST_ONLY",
      needsApp: true,
      needsSupabase: false,
      needsBuild: false,
      runGlobalTests: false,
      fullFinalRequired: true,
    },
  },
  {
    name: "T6 PR FULL + novo delta runtime -> FULL",
    pr: ["src/lib/offline/pull.ts"],
    delta: ["src/lib/offline/pull.ts"],
    expected: {
      prScope: "FULL",
      deltaScope: "FULL",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T7 delta indeterminado -> fail-safe",
    pr: ["src/lib/offline/pull.ts"],
    delta: [],
    deltaKnown: false,
    expected: {
      prScope: "FULL",
      deltaScope: "UNKNOWN",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T8 workflow file changed -> FULL",
    pr: [".github/workflows/antigravity-validate.yml"],
    delta: [".github/workflows/antigravity-validate.yml"],
    expected: {
      prScope: "FULL",
      deltaScope: "FULL",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T9 package/lockfile changed -> FULL",
    pr: ["package.json", "pnpm-lock.yaml"],
    delta: ["pnpm-lock.yaml"],
    expected: {
      prScope: "FULL",
      deltaScope: "FULL",
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  },
  {
    name: "T10 initial PR with only offline test -> TEST_ONLY",
    pr: ["src/lib/offline/__tests__/pull.test.ts"],
    delta: [],
    deltaKnown: false,
    expected: {
      prScope: "TEST_ONLY",
      deltaScope: "UNKNOWN",
      needsApp: true,
      needsSupabase: false,
      needsBuild: false,
      runGlobalTests: false,
      fullFinalRequired: false,
    },
  },
  {
    name: "T11 docs plus tests remains TEST_ONLY",
    pr: [
      "docs/review/f24.md",
      "src/lib/offline/__tests__/pull.test.ts",
    ],
    delta: [
      "docs/review/f24.md",
      "src/lib/offline/__tests__/pull.test.ts",
    ],
    expected: {
      prScope: "TEST_ONLY",
      deltaScope: "TEST_ONLY",
      needsApp: true,
      needsSupabase: false,
      needsBuild: false,
      runGlobalTests: false,
      fullFinalRequired: false,
    },
  },
  {
    name: "T12 Playwright e2e is not classified as Vitest TEST_ONLY",
    pr: ["e2e/smoke.spec.ts"],
    delta: ["e2e/smoke.spec.ts"],
    expected: {
      prScope: "APP",
      deltaScope: "APP",
      needsApp: true,
      needsSupabase: false,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: false,
    },
  },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const prScope = classifyPrScope(scenario.pr);
    const deltaScope = classifyDeltaScope(
      scenario.delta,
      scenario.deltaKnown ?? true,
    );

    const execution = deriveExecution({
      prScope,
      deltaScope,
    });

    assert.deepEqual(
      {
        prScope,
        deltaScope,
        needsApp: execution.needsApp,
        needsSupabase: execution.needsSupabase,
        needsBuild: execution.needsBuild,
        runGlobalTests: execution.runGlobalTests,
        fullFinalRequired: execution.fullFinalRequired,
      },
      scenario.expected,
    );
  });
}

test("UNKNOWN on an APP PR falls back to APP validation", () => {
  assert.deepEqual(
    deriveExecution({
      prScope: "APP",
      deltaScope: "UNKNOWN",
    }),
    {
      needsApp: true,
      needsSupabase: false,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: false,
    },
  );
});

test("UNKNOWN on a TEST_ONLY PR preserves incremental validation", () => {
  assert.deepEqual(
    deriveExecution({
      prScope: "TEST_ONLY",
      deltaScope: "UNKNOWN",
    }),
    {
      needsApp: true,
      needsSupabase: false,
      needsBuild: false,
      runGlobalTests: false,
      fullFinalRequired: false,
    },
  );
});

test("final gate is always FULL", () => {
  assert.deepEqual(
    deriveExecution({
      prScope: "TEST_ONLY",
      deltaScope: "TEST_ONLY",
      finalGate: true,
    }),
    {
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    },
  );
});

test("test selection uses changed tests and conservative directories", () => {
  assert.deepEqual(
    selectTestTargets([
      "src/lib/offline/__tests__/pull.test.ts",
      "src/lib/offline/__tests__/fixtures/pull.ts",
      "tests/integration/helpers/database.ts",
      "docs/testing.md",
    ]),
    [
      "src/lib/offline/__tests__/pull.test.ts",
      "src/lib/offline/__tests__",
      "tests/integration",
    ],
  );
});

test("Playwright files are never sent to Vitest incremental targets", () => {
  assert.deepEqual(
    selectTestTargets([
      "e2e/smoke.spec.ts",
      "e2e/helpers/session.ts",
    ]),
    [],
  );
});