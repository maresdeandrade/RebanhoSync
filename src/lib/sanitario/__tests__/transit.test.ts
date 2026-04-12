import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  buildTransitChecklistPayload,
  hasOfficialTransitChecklistEnabled,
  validateTransitChecklist,
} from "@/lib/sanitario/transit";

describe("transit sanitary checklist helpers", () => {
  it("detects the official transit overlay from farm sanitary config payload", () => {
    expect(
      hasOfficialTransitChecklistEnabled({
        fazenda_id: "farm-1",
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zona_raiva_risco: "baixo",
        pressao_carrapato: "baixo",
        pressao_helmintos: "baixo",
        modo_calendario: "minimo_legal",
        payload: {
          activated_template_slugs: ["transito-gta-precheck"],
        },
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-04-09T00:00:00.000Z",
        server_received_at: "2026-04-09T00:00:00.000Z",
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
        deleted_at: null,
      }),
    ).toBe(true);
  });

  it("blocks interstate reproduction transit without valid PNCEBT documents", () => {
    const issues = validateTransitChecklist(
      {
        ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
        enabled: true,
        purpose: "reproducao",
        isInterstate: true,
        destinationUf: "GO",
        gtaChecked: true,
        gtaNumber: "GTA-123",
        reproductionDocsChecked: true,
        brucellosisExamDate: "2026-01-01",
        tuberculosisExamDate: "2026-01-15",
      },
      "2026-04-09",
    );

    expect(issues).toContain(
      "Atestado negativo de brucelose expirado para reproducao interestadual (validade de 60 dias).",
    );
    expect(issues).toContain(
      "Atestado negativo de tuberculose expirado para reproducao interestadual (validade de 60 dias).",
    );
  });

  it("builds structured payload for compliant external transit", () => {
    expect(
      buildTransitChecklistPayload(
        {
          ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
          enabled: true,
          purpose: "venda",
          gtaChecked: true,
          gtaNumber: "GTA-321",
          notes: "Saida para frigorifico",
        },
        {
          officialPackEnabled: true,
        },
      ),
    ).toEqual({
      transito_sanitario: {
        enabled: true,
        purpose: "venda",
        is_interstate: false,
        destination_uf: null,
        gta_required: true,
        gta_checked: true,
        gta_number: "GTA-321",
        reproduction_docs_checked: false,
        brucellosis_exam_date: null,
        tuberculosis_exam_date: null,
        notes: "Saida para frigorifico",
        source: "pack_oficial_transito",
      },
    });
  });
});
