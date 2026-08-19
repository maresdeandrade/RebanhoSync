import { createGesture } from "@/lib/offline/ops";
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

function toPersistedStatus(status: ImportLineStatus): ImportPersistItemResult["status"] {
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
        const item = items.find((candidate) => candidate.lineNumber === lineNumber);
        if (item) item.status = "imported";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha de persistência.";
      chunks.push({
        chunkId: chunk.chunkId,
        status: "retryable",
        lineNumbers: chunk.lineNumbers,
      });
      for (const lineNumber of chunk.lineNumbers) {
        const item = items.find((candidate) => candidate.lineNumber === lineNumber);
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
