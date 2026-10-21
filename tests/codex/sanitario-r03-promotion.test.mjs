import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeCanonicalData } from "../../scripts/codex/sanitario-v2-contract.mjs";

const root = "docs/review/evidence/";
const candidateBytes = readFileSync(root + "SANITARIO_V2_R03_CANDIDATE_20261019.json");
const candidate = JSON.parse(candidateBytes);
const promoted = JSON.parse(readFileSync(root + "SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json"));
const packet = JSON.parse(readFileSync(root + "SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json"));
const historicalBytes = readFileSync(new URL("./fixtures/sanitario-v2-before-r03.json", import.meta.url));

describe("R03 authorization boundary", () => {
  it("binds the promoted data to the exact human-authorized candidate", () => {
    const digest = createHash("sha256").update(candidateBytes).digest("hex");
    expect(digest).toBe("2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6");
    expect(promoted.payload).toEqual(candidate.payload);
    expect(promoted.rejections).toEqual(candidate.rejections);
    expect(promoted.import_authorization).toMatchObject({ id: "R03", project_ref: "zqloazqzhwauamcejmuz",
      source_candidate_sha256: digest, catalog_approval_authorized: false, operational_automation_authorized: false });
    expect(promoted.import_gate.import_real_authorized).toBe(true);
    expect(promoted.execute_import).toBe(false);
  });
  it("preserves the six restricted records and their versions from the historical source", () => {
    expect(createHash("sha256").update(historicalBytes).digest("hex")).toBe(packet.source_canonical_sha256);
    const original = JSON.parse(JSON.stringify(normalizeCanonicalData(JSON.parse(historicalBytes))));
    expect(packet.retained_restricted_records).toHaveLength(6);
    for (const record of packet.retained_restricted_records) {
      expect(promoted.payload.protocol_item_rows.find((row) => row.id === record.id))
        .toEqual(original.protocol_item_rows.find((row) => row.id === record.id));
    }
  });
  it("imports drafts without granting catalog approval or operational authority", () => {
    expect(promoted.payload.protocol_item_rows).toHaveLength(20);
    expect(promoted.payload.protocol_item_rows.every((row) => row.status === "draft" && !row.allows_agenda_auto)).toBe(true);
    expect(promoted.payload.protocol_rows.every((row) => row.approval_status !== "approved" &&
      row.metadata.agenda_allowed === false && row.metadata.approved_for_catalog === false)).toBe(true);
    expect(packet.approvals_granted).toBe(0);
    expect(promoted.publication_readiness).toMatchObject({ globally_submission_ready_items: 7,
      commercial_items_with_specific_evidence_gaps: 7, farm_evaluation_forms_prepared: 6, operational_authorizations: 0 });
  });
});
