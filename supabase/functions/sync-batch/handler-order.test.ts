import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readHandler() {
  return readFileSync(
    join(process.cwd(), "supabase", "functions", "sync-batch", "index.ts"),
    "utf8",
  );
}

describe("sync-batch handler initialization order", () => {
  it("dispatches recognized movement before generic validation and writes, with unconditional continue", () => {
    const handler = readHandler();
    const loop = handler.slice(handler.indexOf("for (const rawOp of ops)"));
    const start = loop.indexOf("if (isMovementV1Operation(rawOp))");
    const next = loop.indexOf("if (isCommercialOperationV2(rawOp))");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(next).toBeGreaterThan(start);
    expect(loop.slice(start, next)).toContain(
      "await executeMovementV1(supabase, rawOp",
    );
    expect(loop.slice(start, next)).toContain("continue;");
    expect(loop.indexOf("const op = rawOp as Operation;")).toBeGreaterThan(
      next,
    );
    expect(
      handler.slice(
        handler.indexOf("const legacyOps"),
        handler.indexOf("if (featureFlags.strictAntiTeleport)"),
      ),
    ).toContain("!isMovementV1Operation(op)");
  });
  it("inicializa op e record antes do tratamento de finance_categories", () => {
    const handler = readHandler();
    const loopStart = handler.indexOf("for (const rawOp of ops)");
    const loop = handler.slice(loopStart);
    const sanitarioDispatch = loop.indexOf(
      "if (isSanitarioSyncV2Operation(rawOp))",
    );
    const opInitialization = loop.indexOf("const op = rawOp as Operation;");
    const recordInitialization = loop.indexOf(
      "const record = normalizeTableMutationRecord(",
    );
    const financeCategoryHandling = loop.indexOf(
      'if (op.table === "finance_categories" && op.action === "INSERT")',
    );
    const genericValidation = loop.indexOf(
      "const sanitaryMovementIssue = validateSanitarioInventoryMovementRecord(",
    );

    expect(loopStart).toBeGreaterThanOrEqual(0);
    expect(sanitarioDispatch).toBeGreaterThanOrEqual(0);
    expect(opInitialization).toBeGreaterThan(sanitarioDispatch);
    expect(recordInitialization).toBeGreaterThan(opInitialization);
    expect(financeCategoryHandling).toBeGreaterThan(recordInitialization);
    expect(genericValidation).toBeGreaterThan(financeCategoryHandling);
  });
});
