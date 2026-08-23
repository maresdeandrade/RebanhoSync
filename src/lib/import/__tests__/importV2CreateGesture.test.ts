/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "@/lib/offline/db";
import { createGesture, getCreateGestureDiagnostic } from "@/lib/offline/ops";
import { previewAnimalsImportV2 } from "../importV2";
import { persistImportV2Preview } from "../importV2Persistence";

const HEADER =
  "identificacao;sexo;especie;lote;data_nascimento;data_entrada;origem;raca;nome;rfid;schema_version;template_version";

function validCsv(count: number) {
  return [
    HEADER,
    ...Array.from(
      { length: count },
      (_, index) =>
        `CG-${count}-${index + 1};F;bovino;;2024-01-10;;nascimento;nelore;Animal ${index + 1};;2;import-v2`,
    ),
  ].join("\n");
}

function preview(count: number) {
  return previewAnimalsImportV2({
    entity: "animais",
    fazendaId: "farm-create-gesture",
    importId: `import-create-gesture-${count}`,
    rawText: validCsv(count),
    existing: { animais: [], lotes: [] },
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
  });
}

async function clearStores() {
  await Promise.all([
    db.state_animais.clear(),
    db.queue_gestures.clear(),
    db.queue_ops.clear(),
  ]);
}

describe("animal import createGesture regression", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "browser:test-create-gesture",
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await clearStores();
  });

  afterEach(async () => {
    await clearStores();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persiste atomicamente uma operação válida no createGesture isolado", async () => {
    const operation = preview(1).operations[0];
    expect(operation).toBeDefined();

    const txId = await createGesture("farm-create-gesture", [operation!]);

    await expect(db.queue_gestures.get(txId)).resolves.toMatchObject({
      client_tx_id: txId,
      status: "PENDING",
    });
    await expect(
      db.queue_ops.where("client_tx_id").equals(txId).count(),
    ).resolves.toBe(1);
    await expect(
      db.state_animais
        .where("fazenda_id")
        .equals("farm-create-gesture")
        .count(),
    ).resolves.toBe(1);
  });

  it.each([1, 2, 5, 10])(
    "faz enqueue real de %i animal(is) com um gesture e uma op por linha",
    async (count) => {
      const result = await persistImportV2Preview(preview(count));

      expect(result.summary).toMatchObject({ imported: count, retryable: 0 });
      expect(await db.queue_gestures.count()).toBe(1);
      expect(await db.queue_ops.count()).toBe(count);
      expect(await db.state_animais.count()).toBe(count);
    },
  );

  it("preserva a exceção técnica e não deixa escrita parcial em falha real", async () => {
    const failedPreview = preview(2);
    const createGestureFn = async () =>
      createGesture("farm-create-gesture", failedPreview.operations, {
        clientTxId: "tx-duplicate-op-id",
        clientOpIds: ["duplicate-op-id", "duplicate-op-id"],
      });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await persistImportV2Preview(failedPreview, {
      createGestureFn,
    });

    expect(result.summary).toMatchObject({ imported: 0, retryable: 2 });
    expect(result.chunks[0]?.technicalError).toMatchObject({
      code: "CREATE_GESTURE_FAILED",
      name: "BulkError",
      chunkId: "import-create-gesture-2:chunk:1",
      lineNumbers: [2, 3],
      createGesture: {
        stage: "write-operations",
        clientTxId: "tx-duplicate-op-id",
        operationCount: 2,
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[createGesture] failed",
      expect.objectContaining({ stage: "write-operations" }),
    );
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.state_animais.count()).toBe(0);
    consoleError.mockRestore();
  });

  it("mantém o objeto original da exceção disponível para diagnóstico", async () => {
    const operations = preview(2).operations;
    let caught: unknown;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await createGesture("farm-create-gesture", operations, {
        clientTxId: "tx-original-error",
        clientOpIds: ["duplicate-op-id", "duplicate-op-id"],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ name: "BulkError" });
    expect(getCreateGestureDiagnostic(caught)).toMatchObject({
      stage: "write-operations",
      clientTxId: "tx-original-error",
      operationCount: 2,
      error: { name: "BulkError" },
    });
  });
});
