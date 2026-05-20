import { describe, expect, it } from "vitest";

import type { CatalogoProtocoloOficialItem } from "@/lib/offline/types";
import {
  summarizeOfficialPackSelectionPresentation,
  summarizeOfficialPackTemplatePresentation,
} from "@/lib/sanitario/catalog/officialPackPresentation";

const BASE_ITEM: CatalogoProtocoloOficialItem = {
  id: "item-1",
  template_id: "template-1",
  area: "vacinacao",
  codigo: "vacina",
  categoria_animal: null,
  gatilho_tipo: "calendario",
  gatilho_json: {},
  frequencia_json: {},
  requires_vet: false,
  requires_gta: false,
  carencia_regra_json: {},
  gera_agenda: true,
  payload: {},
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

function item(
  overrides: Partial<CatalogoProtocoloOficialItem>,
): CatalogoProtocoloOficialItem {
  return {
    ...BASE_ITEM,
    ...overrides,
    payload: {
      ...BASE_ITEM.payload,
      ...overrides.payload,
    },
  };
}

describe("official pack presentation", () => {
  it("separates agenda items from non-agenda operational classes", () => {
    const result = summarizeOfficialPackTemplatePresentation({
      materializableItems: [item({ id: "agenda", gera_agenda: true })],
      skippedItems: [
        item({
          id: "notifiable",
          area: "notificacao",
          codigo: "doencas_notificaveis",
          gera_agenda: false,
        }),
        item({
          id: "biosecurity",
          area: "biosseguranca",
          codigo: "biosseguranca_checklist",
          gera_agenda: false,
        }),
      ],
    });

    expect(result.agendaOperationalCount).toBe(1);
    expect(result.nonAgendaCounts).toEqual([
      { key: "compliance_check", label: "Compliance/checklist", count: 1 },
      { key: "notifiable_suspicion", label: "Suspeita notificavel", count: 1 },
    ]);
  });

  it("aggregates non-agenda classes across selected templates", () => {
    const result = summarizeOfficialPackSelectionPresentation([
      {
        materializableItems: [item({ id: "agenda-1" })],
        skippedItems: [
          item({
            id: "gta",
            area: "biosseguranca",
            requires_gta: true,
            gera_agenda: false,
          }),
        ],
      },
      {
        materializableItems: [item({ id: "agenda-2" })],
        skippedItems: [
          item({
            id: "notifiable",
            area: "notificacao",
            gera_agenda: false,
          }),
        ],
      },
    ]);

    expect(result.agendaOperationalCount).toBe(2);
    expect(result.nonAgendaCounts).toEqual([
      { key: "compliance_check", label: "Compliance/checklist", count: 1 },
      { key: "notifiable_suspicion", label: "Suspeita notificavel", count: 1 },
    ]);
  });
});
