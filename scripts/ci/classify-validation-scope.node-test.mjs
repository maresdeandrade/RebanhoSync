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
    expected: ["DOCS", "DOCS_ONLY", false, false, false],
  },
  {
    name: "T2 app-only PR",
    pr: ["src/components/Card.tsx"],
    delta: ["src/components/Card.tsx"],
    expected: ["APP", "APP", true, false, false],
  },
  {
    name: "T3 runtime offline change -> FULL",
    pr: ["src/lib/offline/pull.ts"],
    delta: ["src/lib/offline/pull.ts"],
    expected: ["FULL", "FULL", true, true, true],
  },
  {
    name: "T4 supabase migration -> FULL",
    pr: ["supabase/migrations/20260921000000_change.sql"],
    delta: ["supabase/migrations/20260921000000_change.sql"],
    expected: ["FULL", "FULL", true, true, true],
  },
  {
    name: "T5 PR FULL + novo delta apenas test-only",
    pr: ["src/lib/offline/pull.ts", "src/lib/offline/__tests__/pull.test.ts"],
    delta: ["src/lib/offline/__tests__/pull.test.ts"],
    expected: ["FULL", "TEST_ONLY", true, false, true],
  },
  {
    name: "T6 PR FULL + novo delta runtime -> FULL",
    pr: ["src/lib/offline/pull.ts"],
    delta: ["src/lib/offline/pull.ts"],
    expected: ["FULL", "FULL", true, true, true],
  },
  {
    name: "T7 delta indeterminado -> fail-safe",
    pr: ["src/lib/offline/pull.ts"],
    delta: [],
    deltaKnown: false,
    expected: ["FULL", "UNKNOWN", true, true, true],
  },
  {
    name: "T8 workflow file changed -> FULL",
    pr: [".github/workflows/antigravity-validate.yml"],
    delta: [".github/workflows/antigravity-validate.yml"],
    expected: ["FULL", "FULL", true, true, true],
  },
  {
    name: "T9 package/lockfile changed -> FULL",
    pr: ["package.json", "pnpm-lock.yaml"],
    delta: ["pnpm-lock.yaml"],
    expected: ["FULL", "FULL", true, true, true],
  },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const prScope = classifyPrScope(scenario.pr);
    const deltaScope = classifyDeltaScope(scenario.delta, scenario.deltaKnown ?? true);
    const execution = deriveExecution({ prScope, deltaScope });
    assert.deepEqual(
      [
        prScope,
        deltaScope,
        execution.needsApp,
        execution.needsSupabase,
        execution.fullFinalRequired,
      ],
      scenario.expected,
    );
  });
}

test("UNKNOWN on an APP PR falls back to APP validation", () => {
  assert.deepEqual(
    deriveExecution({ prScope: "APP", deltaScope: "UNKNOWN" }),
    {
      needsApp: true,
      needsSupabase: false,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: false,
    },
  );
});

test("final gate is always FULL", () => {
  assert.deepEqual(
    deriveExecution({ prScope: "DOCS", deltaScope: "DOCS_ONLY", finalGate: true }),
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
