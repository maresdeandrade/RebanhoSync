import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSIT_CHECKLIST_DRAFT } from "@/lib/sanitario/transit";
import {
  buildRegistrarFinanceiroPayloadBase,
  resolveRegistrarTransitChecklistPayload,
} from "@/pages/Registrar/helpers/payload";

describe("payload helpers", () => {
  it("não monta payload de trânsito quando checklist não está ativo no fluxo", () => {
    const payload = resolveRegistrarTransitChecklistPayload({
      showsTransitChecklist: false,
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      officialTransitChecklistEnabled: false,
    });

    expect(payload).toEqual({});
  });

  it("monta payload de trânsito quando checklist está ativo", () => {
    const payload = resolveRegistrarTransitChecklistPayload({
      showsTransitChecklist: true,
      transitChecklist: {
        ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
        enabled: true,
        gtaChecked: true,
        gtaNumber: "GTA-123",
      },
      officialTransitChecklistEnabled: true,
    });

    expect(payload).toMatchObject({
      transito_sanitario: {
        enabled: true,
        gta_checked: true,
        gta_number: "GTA-123",
        source: "pack_oficial_transito",
      },
    });
  });

  it("prioriza kind de sociedade", () => {
    expect(
      buildRegistrarFinanceiroPayloadBase({
        natureza: "sociedade_entrada",
        hasAnimalId: false,
        createdAnimalIds: [],
      }),
    ).toEqual({
      kind: "sociedade_entrada",
      origem: "registrar_manejo",
    });
  });

  it("retorna compra_lote_com_animais quando compra gerou IDs", () => {
    expect(
      buildRegistrarFinanceiroPayloadBase({
        natureza: "compra",
        hasAnimalId: false,
        createdAnimalIds: ["a1", "a2"],
      }),
    ).toEqual({
      kind: "compra_lote_com_animais",
      origem: "registrar_manejo",
      animal_ids: ["a1", "a2"],
      animais_cadastrados: 2,
    });
  });

  it("retorna compra_animal quando existe animal vinculado", () => {
    expect(
      buildRegistrarFinanceiroPayloadBase({
        natureza: "compra",
        hasAnimalId: true,
        createdAnimalIds: [],
      }),
    ).toEqual({
      kind: "compra_animal",
      origem: "registrar_manejo",
    });
  });
});
