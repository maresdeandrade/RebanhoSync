import {
  buildAgendaTechnicalSnapshotV2,
  type AgendaSnapshotBuildInputV2,
  type BuildSnapshotResult,
  type SnapshotBuildIssue,
} from "./sanitarySnapshotBuildersV2";
import type { AgendaTechnicalSnapshot, SanitaryProductSnapshotV2 } from "./sanitarySnapshotsV2";

export interface AgendaV2SnapshotPayload {
  protocol_item_snapshot: AgendaTechnicalSnapshot;
  produto_snapshot: SanitaryProductSnapshotV2 | null;
  metadata_snapshot: {
    schemaVersion: "sanitario-agenda-v2-snapshot-payload";
    referenceContext: AgendaSnapshotBuildInputV2["referenceContext"];
    sourceRefIds: string[];
    fieldSourceStatus: AgendaTechnicalSnapshot["fieldSourceStatus"];
  };
  limitations: string[];
  issues: SnapshotBuildIssue[];
}

export function createSanitaryAgendaV2SnapshotPayload(
  input: AgendaSnapshotBuildInputV2,
): BuildSnapshotResult<AgendaV2SnapshotPayload> {
  const result = buildAgendaTechnicalSnapshotV2(input);

  if (!result.ok || !result.snapshot) {
    return {
      ok: false,
      issues: result.issues,
    };
  }

  return {
    ok: true,
    snapshot: {
      protocol_item_snapshot: result.snapshot,
      produto_snapshot: result.snapshot.plannedProductSnapshot ?? null,
      metadata_snapshot: {
        schemaVersion: "sanitario-agenda-v2-snapshot-payload",
        referenceContext: input.referenceContext,
        sourceRefIds: result.snapshot.sourceRefs
          .map((source) => source.id)
          .filter((id): id is string => Boolean(id)),
        fieldSourceStatus: result.snapshot.fieldSourceStatus,
      },
      limitations: result.snapshot.limitations,
      issues: result.issues,
    },
    issues: result.issues,
  };
}