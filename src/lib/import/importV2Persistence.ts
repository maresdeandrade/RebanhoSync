import { createGesture, getCreateGestureDiagnostic } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import {
  deterministicImportUuid,
  type ImportLineStatus,
  type ImportPersistItemResult,
  type ImportPersistResult,
  type ImportV2Preview,
} from "./importV2";

export type CreateImportGesture = (
  fazendaId: string,
  operations: OperationInput[],
  options?: { clientTxId?: string; clientOpIds?: readonly string[] },
) => Promise<string>;

function toPersistedStatus(
  status: ImportLineStatus,
): ImportPersistItemResult["status"] {
  if (status === "valid") return "skipped";
  return status as ImportPersistItemResult["status"];
}

export async function persistImportV2Preview(
  preview: ImportV2Preview,
  options: { createGestureFn?: CreateImportGesture } = {},
): Promise<ImportPersistResult> {
  const createGestureFn = options.createGestureFn ?? createGesture;
  const items = preview.lineResults.map((line) => ({
    lineNumber: line.lineNumber,
    status: toPersistedStatus(line.status),
    ...(line.issues[0] ? { message: line.issues[0].message } : {}),
  }));
  const chunks: ImportPersistResult["chunks"] = [];

  for (const chunk of preview.chunks) {
    try {
      await createGestureFn(preview.fazendaId, chunk.operations, {
        clientTxId: deterministicImportUuid(
          `${preview.fazendaId}|${preview.importId}|${chunk.chunkId}|tx`,
        ),
        clientOpIds: chunk.lineNumbers.map((lineNumber) =>
          deterministicImportUuid(
            `${preview.fazendaId}|${preview.importId}|${chunk.chunkId}|line|${lineNumber}`,
          ),
        ),
      });
      chunks.push({
        chunkId: chunk.chunkId,
        status: "imported",
        lineNumbers: chunk.lineNumbers,
      });
      for (const lineNumber of chunk.lineNumbers) {
        const item = items.find(
          (candidate) => candidate.lineNumber === lineNumber,
        );
        if (item) item.status = "imported";
      }
    } catch (error) {
      const errorRecord =
        error && typeof error === "object"
          ? (error as Record<string, unknown>)
          : null;
      const message =
        typeof errorRecord?.message === "string"
          ? errorRecord.message
          : "Falha de persistência.";
      const diagnostic = getCreateGestureDiagnostic(error);
      const cause =
        error && typeof error === "object" && "cause" in error
          ? (error as { cause?: unknown }).cause
          : undefined;
      const causeRecord =
        cause && typeof cause === "object"
          ? (cause as Record<string, unknown>)
          : null;
      const technicalError: NonNullable<
        ImportPersistResult["chunks"][number]["technicalError"]
      > = {
        code: "CREATE_GESTURE_FAILED",
        name:
          typeof errorRecord?.name === "string"
            ? errorRecord.name
            : typeof error,
        message,
        ...(typeof errorRecord?.stack === "string"
          ? { stack: errorRecord.stack }
          : {}),
        ...(typeof causeRecord?.message === "string"
          ? {
              cause: {
                name:
                  typeof causeRecord.name === "string"
                    ? causeRecord.name
                    : typeof cause,
                message: causeRecord.message,
              },
            }
          : {}),
        chunkId: chunk.chunkId,
        lineNumbers: chunk.lineNumbers,
        ...(diagnostic
          ? {
              createGesture: {
                stage: diagnostic.stage,
                ...(diagnostic.clientTxId
                  ? { clientTxId: diagnostic.clientTxId }
                  : {}),
                operationCount: diagnostic.operationCount,
                ...(diagnostic.operationIndex === undefined
                  ? {}
                  : { operationIndex: diagnostic.operationIndex }),
                ...(diagnostic.table ? { table: diagnostic.table } : {}),
                ...(diagnostic.action ? { action: diagnostic.action } : {}),
                ...(diagnostic.error.dexie
                  ? { dexie: diagnostic.error.dexie }
                  : {}),
              },
            }
          : {}),
      };
      console.error("[import-v2] createGesture failed", technicalError);
      chunks.push({
        chunkId: chunk.chunkId,
        status: "retryable",
        lineNumbers: chunk.lineNumbers,
        technicalError,
      });
      for (const lineNumber of chunk.lineNumbers) {
        const item = items.find(
          (candidate) => candidate.lineNumber === lineNumber,
        );
        if (item) {
          item.status = "retryable";
          item.message = message;
        }
      }
    }
  }

  const imported = items.filter((item) => item.status === "imported").length;
  const retryable = items.filter((item) => item.status === "retryable").length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  return {
    importId: preview.importId,
    chunks,
    items,
    summary: {
      ...preview.summary,
      valid: imported,
      imported,
      retryable,
      skipped,
    },
  };
}
