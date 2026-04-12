import type { CatalogoProtocoloOficial, CatalogoProtocoloOficialItem } from "@/lib/offline/types";
import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance";
import { resolveComplianceFlowGuards } from "@/lib/sanitario/complianceGuards";

function createEntry(overrides: Partial<RegulatoryOverlayEntry> = {}): RegulatoryOverlayEntry {
  const template: CatalogoProtocoloOficial = {
    id: "template-1",
    slug: "template-1",
    nome: "Template",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
  };

  const item: CatalogoProtocoloOficialItem = {
    id: "item-1",
    template_id: template.id,
    area: "biosseguranca",
    codigo: "item-1",
    categoria_animal: "all",
    gatilho_tipo: "calendario",
    gatilho_json: {},
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: {},
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
  };

  return {
    template,
    item,
    label: "Item de conformidade",
    subarea: null,
    complianceKind: "checklist",
    status: "pendente",
    runtime: null,
    animalCentric: false,
    ...overrides,
  };
}

describe("compliance guards", () => {
  it("blocks nutrition when feed-ban is still open", () => {
    const result = resolveComplianceFlowGuards({
      entries: [
        createEntry({
          item: {
            ...createEntry().item,
            codigo: "feed-ban",
            area: "nutricao",
          },
          label: "Feed-ban de ruminantes",
          subarea: "feed_ban",
          complianceKind: "feed_ban",
        }),
      ],
      context: "nutrition",
    });

    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({
      key: "feed-ban",
      tone: "danger",
    });
  });

  it("blocks external movement when documentary overlay is pending", () => {
    const result = resolveComplianceFlowGuards({
      entries: [
        createEntry({
          label: "Atualizacao de rebanho - etapa 1",
          subarea: "atualizacao_rebanho",
          item: {
            ...createEntry().item,
            codigo: "sp-atualizacao-maio",
          },
        }),
      ],
      context: "movement",
      isExternalTransit: true,
    });

    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].message).toContain(
      "antes de liberar o transito externo",
    );
  });

  it("warns internal movement on quarantine pending but blocks on adjustment", () => {
    const pending = resolveComplianceFlowGuards({
      entries: [
        createEntry({
          subarea: "quarentena",
          label: "Quarentena/separacao de entrada",
        }),
      ],
      context: "movement",
      isExternalTransit: false,
    });

    expect(pending.blockers).toHaveLength(0);
    expect(pending.warnings).toHaveLength(1);

    const adjusted = resolveComplianceFlowGuards({
      entries: [
        createEntry({
          subarea: "quarentena",
          label: "Quarentena/separacao de entrada",
          status: "ajuste_necessario",
        }),
      ],
      context: "movement",
      isExternalTransit: false,
    });

    expect(adjusted.blockers).toHaveLength(1);
    expect(adjusted.blockers[0].key).toBe("quarentena");
  });
});
