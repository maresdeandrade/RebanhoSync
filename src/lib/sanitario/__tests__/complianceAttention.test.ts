import type { CatalogoProtocoloOficial, CatalogoProtocoloOficialItem } from "@/lib/offline/types";
import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance/compliance";
import { summarizeRegulatoryComplianceAttention } from "@/lib/sanitario/compliance/complianceAttention";

function createEntry(overrides: Partial<RegulatoryOverlayEntry> = {}): RegulatoryOverlayEntry {
  const template: CatalogoProtocoloOficial = {
    id: "template-1",
    slug: "feed-ban-ruminantes",
    nome: "Conformidade alimentar de ruminantes",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {
      animal_centric: false,
      execution_mode: "checklist",
    },
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
  };

  const item: CatalogoProtocoloOficialItem = {
    id: "item-1",
    template_id: template.id,
    area: "nutricao",
    codigo: "feed-ban",
    categoria_animal: "all",
    gatilho_tipo: "uso_produto",
    gatilho_json: {},
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: {
      label: "Feed-ban de ruminantes",
      subarea: "feed_ban",
    },
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
  };

  return {
    template,
    item,
    label: "Feed-ban de ruminantes",
    subarea: "feed_ban",
    complianceKind: "feed_ban",
    status: "pendente",
    runtime: null,
    animalCentric: false,
    ...overrides,
  };
}

describe("regulatory compliance attention", () => {
  it("elevates feed-ban pendente as restriction with danger badge", () => {
    const summary = summarizeRegulatoryComplianceAttention({
      entries: [createEntry()],
    });

    expect(summary.feedBanOpenCount).toBe(1);
    expect(summary.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "feed-ban",
          tone: "danger",
          count: 1,
        }),
      ]),
    );
    expect(summary.groupBadge).toEqual({
      label: "Restricao de conformidade",
      tone: "danger",
    });
  });

  it("marks obligatory checklists as critical even when only pending", () => {
    const summary = summarizeRegulatoryComplianceAttention({
      entries: [
        createEntry({
          template: {
            ...createEntry().template,
            slug: "sp-atualizacao-rebanho",
            nome: "Sao Paulo - atualizacao de rebanho",
          },
          item: {
            ...createEntry().item,
            codigo: "sp-atualizacao-maio",
            area: "biosseguranca",
            payload: {
              label: "Atualizacao de rebanho - etapa 1",
              subarea: "atualizacao_rebanho",
            },
          },
          label: "Atualizacao de rebanho - etapa 1",
          subarea: "atualizacao_rebanho",
          complianceKind: "checklist",
        }),
      ],
    });

    expect(summary.feedBanOpenCount).toBe(0);
    expect(summary.criticalChecklistCount).toBe(1);
    expect(summary.groupBadge).toEqual({
      label: "Checklist critico pendente",
      tone: "warning",
    });
    expect(summary.topItems[0]).toMatchObject({
      kindLabel: "Checklist",
      tone: "warning",
    });
  });

  it("returns no open alert state when all entries are conforme", () => {
    const summary = summarizeRegulatoryComplianceAttention({
      entries: [
        createEntry({
          status: "conforme",
          runtime: {
            templateSlug: "feed-ban-ruminantes",
            templateName: "Conformidade alimentar de ruminantes",
            itemCode: "feed-ban",
            itemLabel: "Feed-ban de ruminantes",
            subarea: "feed_ban",
            complianceKind: "feed_ban",
            status: "conforme",
            checkedAt: "2026-04-10T12:00:00.000Z",
            responsible: "Equipe",
            notes: null,
            sourceEventId: "event-1",
            answers: {},
          },
        }),
      ],
    });

    expect(summary.openCount).toBe(0);
    expect(summary.badges).toHaveLength(0);
    expect(summary.topItems).toHaveLength(0);
    expect(summary.groupBadge).toBeNull();
  });
});
