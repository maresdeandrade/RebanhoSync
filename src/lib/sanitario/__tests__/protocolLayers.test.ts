import { describe, expect, it } from "vitest";

import type { ProtocoloSanitario } from "@/lib/offline/types";
import {
  buildSanitaryFamilyCoverageIndex,
  findSanitaryFamilyConflict,
  hasOfficialFamilyCoverage,
} from "@/lib/sanitario/protocolLayers";

const buildProtocol = (
  id: string,
  payload: Record<string, unknown>,
): ProtocoloSanitario => ({
  id,
  fazenda_id: "farm-1",
  nome: id,
  descricao: null,
  ativo: true,
  payload,
  client_id: "client-1",
  client_op_id: `${id}-op`,
  client_tx_id: null,
  client_recorded_at: "2026-04-12T12:00:00.000Z",
  server_received_at: "2026-04-12T12:00:00.000Z",
  created_at: "2026-04-12T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
  deleted_at: null,
});

describe("sanitary protocol layering", () => {
  it("flags official-family duplication before a standard/custom protocol is created", () => {
    const protocols = [
      buildProtocol("official-brucelose", {
        origem: "catalogo_oficial",
        family_code: "brucelose",
      }),
    ];

    const conflict = findSanitaryFamilyConflict({
      protocols,
      candidateFamilyCode: "brucelose",
      candidateLayer: "custom",
    });

    expect(conflict).toMatchObject({
      familyCode: "brucelose",
      reason: "official_family_already_active",
      existingLayer: "official",
    });
  });

  it("keeps family coverage indexed by layer so the UI can signal active trunks", () => {
    const protocols = [
      buildProtocol("official-raiva", {
        origem: "catalogo_oficial",
        family_code: "raiva_herbivoros",
      }),
      buildProtocol("custom-secagem", {
        origem: "customizado_fazenda",
        family_code: "secagem_local",
      }),
    ];

    const coverage = buildSanitaryFamilyCoverageIndex(protocols);

    expect(hasOfficialFamilyCoverage(coverage, "raiva_herbivoros")).toBe(true);
    expect(hasOfficialFamilyCoverage(coverage, "secagem_local")).toBe(false);
    expect(Array.from(coverage.get("secagem_local")?.layers ?? [])).toEqual([
      "custom",
    ]);
  });
});
