import { describe, expect, it } from "vitest";

import type {
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
} from "@/lib/offline/types";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
} from "@/lib/sanitario/compliance/regulatoryReadModel";

const now = "2026-04-10T10:00:00.000Z";

function createTemplate(
  overrides: Partial<CatalogoProtocoloOficial> = {},
): CatalogoProtocoloOficial {
  return {
    id: "template-base",
    slug: "template-base",
    nome: "Template base",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createItem(
  overrides: Partial<CatalogoProtocoloOficialItem> = {},
): CatalogoProtocoloOficialItem {
  return {
    id: "item-base",
    template_id: "template-base",
    area: "biosseguranca",
    codigo: "item-base",
    categoria_animal: null,
    gatilho_tipo: "risco",
    gatilho_json: {},
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: {
      label: "Item base",
    },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createConfig(): FazendaSanidadeConfig {
  return {
    fazenda_id: "farm-1",
    uf: "SP",
    aptidao: "all",
    sistema: "all",
    zona_raiva_risco: "medio",
    pressao_carrapato: "medio",
    pressao_helmintos: "medio",
    modo_calendario: "minimo_legal",
    payload: {
      activated_template_slugs: [
        "feed-ban-ruminantes",
        "quarentena-entrada",
        "sp-atualizacao-rebanho",
      ],
      overlay_runtime: {
        items: {
          "feed-ban": {
            template_slug: "feed-ban-ruminantes",
            template_name: "Feed-ban",
            item_code: "feed-ban",
            item_label: "Feed-ban de ruminantes",
            subarea: "feed_ban",
            compliance_kind: "feed_ban",
            status: "pendente",
            checked_at: now,
            responsible: "Equipe",
            notes: null,
            source_evento_id: "event-1",
            answers: {},
          },
          "quarentena-entrada": {
            template_slug: "quarentena-entrada",
            template_name: "Quarentena de entrada",
            item_code: "quarentena-entrada",
            item_label: "Quarentena de entrada",
            subarea: "quarentena",
            compliance_kind: "checklist",
            status: "ajuste_necessario",
            checked_at: now,
            responsible: "Equipe",
            notes: null,
            source_evento_id: "event-2",
            answers: {},
          },
          "sp-atualizacao-maio": {
            template_slug: "sp-atualizacao-rebanho",
            template_name: "Atualizacao de rebanho",
            item_code: "sp-atualizacao-maio",
            item_label: "Atualizacao de rebanho - etapa 1",
            subarea: "atualizacao_rebanho",
            compliance_kind: "checklist",
            status: "pendente",
            checked_at: now,
            responsible: "Equipe",
            notes: null,
            source_evento_id: "event-3",
            answers: {},
          },
        },
      },
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

describe("buildRegulatoryOperationalReadModel", () => {
  it("returns the empty model when there is no active source", () => {
    expect(buildRegulatoryOperationalReadModel(null)).toEqual(
      EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
    );
  });

  it("keeps nutrition and movement semantics aligned from the same source", () => {
    const config = createConfig();
    const templates = [
      createTemplate({
        id: "template-feed-ban",
        slug: "feed-ban-ruminantes",
        nome: "Feed-ban",
      }),
      createTemplate({
        id: "template-quarentena",
        slug: "quarentena-entrada",
        nome: "Quarentena de entrada",
      }),
      createTemplate({
        id: "template-doc",
        slug: "sp-atualizacao-rebanho",
        nome: "Atualizacao de rebanho",
      }),
    ];
    const items = [
      createItem({
        id: "item-feed-ban",
        template_id: "template-feed-ban",
        area: "nutricao",
        codigo: "feed-ban",
        gatilho_tipo: "uso_produto",
        payload: {
          label: "Feed-ban de ruminantes",
          subarea: "feed_ban",
        },
      }),
      createItem({
        id: "item-quarentena",
        template_id: "template-quarentena",
        codigo: "quarentena-entrada",
        payload: {
          label: "Quarentena de entrada",
          subarea: "quarentena",
        },
      }),
      createItem({
        id: "item-doc",
        template_id: "template-doc",
        codigo: "sp-atualizacao-maio",
        payload: {
          label: "Atualizacao de rebanho - etapa 1",
          subarea: "atualizacao_rebanho",
        },
      }),
    ];

    const summary = buildRegulatoryOperationalReadModel({
      config,
      templates,
      items,
    });

    expect(summary.attention.openCount).toBe(3);
    expect(summary.attention.blockingCount).toBe(2);
    expect(summary.flows.nutrition.blockerCount).toBe(1);
    expect(summary.flows.nutrition.firstBlockerMessage).toContain(
      "conformidade alimentar",
    );
    expect(summary.flows.movementInternal.blockerCount).toBe(1);
    expect(summary.flows.movementExternal.blockerCount).toBe(2);
    expect(summary.flows.sale.blockerCount).toBe(2);
    expect(summary.analytics.subareas).toEqual([
      expect.objectContaining({
        key: "feed_ban",
        openCount: 1,
        blockerCount: 1,
        warningCount: 0,
      }),
      expect.objectContaining({
        key: "quarentena",
        openCount: 1,
        blockerCount: 1,
        warningCount: 0,
      }),
      expect.objectContaining({
        key: "documental",
        openCount: 1,
        blockerCount: 1,
        warningCount: 0,
      }),
    ]);
    expect(summary.analytics.impacts).toEqual([
      expect.objectContaining({
        key: "nutrition",
        blockerCount: 1,
        totalCount: 1,
      }),
      expect.objectContaining({
        key: "movementInternal",
        blockerCount: 1,
        totalCount: 1,
      }),
      expect.objectContaining({
        key: "sale",
        blockerCount: 2,
        totalCount: 2,
      }),
    ]);
    expect(summary.hasBlockingIssues).toBe(true);
  });

  it("keeps biosseguranca and notifiable templates contextual when no runtime exists", () => {
    const config = {
      ...createConfig(),
      payload: {
        activated_template_slugs: [
          "biosseguranca-operacional",
          "in50-doencas-notificaveis",
        ],
        overlay_runtime: {
          items: {},
        },
      },
    } satisfies FazendaSanidadeConfig;
    const templates = [
      createTemplate({
        id: "template-biosseguranca",
        slug: "biosseguranca-operacional",
        nome: "Biosseguranca operacional - boas praticas",
        status_legal: "boa_pratica",
      }),
      createTemplate({
        id: "template-notificaveis",
        slug: "in50-doencas-notificaveis",
        nome: "IN MAPA 50/2013 - doencas notificaveis",
      }),
    ];
    const items = [
      createItem({
        id: "item-biosseguranca",
        template_id: "template-biosseguranca",
        area: "biosseguranca",
        codigo: "biosseguranca-checklist",
        payload: {
          label: "Biosseguranca operacional - checklist",
        },
      }),
      createItem({
        id: "item-notificaveis",
        template_id: "template-notificaveis",
        area: "notificacao",
        codigo: "doencas-notificaveis-alerta",
        gatilho_tipo: "risco",
        payload: {
          label: "Doencas notificaveis - registrar suspeita e orientar notificacao",
          family_code: "doencas_notificaveis",
          requires_official_notification: true,
        },
      }),
    ];

    const summary = buildRegulatoryOperationalReadModel({
      config,
      templates,
      items,
    });

    expect(summary.entries).toHaveLength(2);
    expect(summary.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item: expect.objectContaining({ codigo: "biosseguranca-checklist" }),
          actionability: "contextual",
        }),
        expect.objectContaining({
          item: expect.objectContaining({ codigo: "doencas-notificaveis-alerta" }),
          actionability: "contextual",
        }),
      ]),
    );
    expect(summary.attention.openCount).toBe(0);
    expect(summary.attention.pendingCount).toBe(0);
    expect(summary.attention.badges).toHaveLength(0);
    expect(summary.flows.nutrition.totalCount).toBe(0);
    expect(summary.flows.movementInternal.totalCount).toBe(0);
    expect(summary.flows.movementExternal.totalCount).toBe(0);
    expect(summary.analytics.subareas).toHaveLength(0);
    expect(summary.hasOpenIssues).toBe(false);
    expect(summary.hasBlockingIssues).toBe(false);
  });

  it("keeps runtime pending entries actionable", () => {
    const config = {
      ...createConfig(),
      payload: {
        activated_template_slugs: ["biosseguranca-operacional"],
        overlay_runtime: {
          items: {
            "biosseguranca-checklist": {
              template_slug: "biosseguranca-operacional",
              template_name: "Biosseguranca operacional",
              item_code: "biosseguranca-checklist",
              item_label: "Biosseguranca operacional - checklist",
              subarea: "quarentena",
              compliance_kind: "checklist",
              status: "pendente",
              checked_at: now,
              responsible: "Equipe",
              notes: null,
              source_evento_id: "event-bio-1",
              answers: {},
            },
          },
        },
      },
    } satisfies FazendaSanidadeConfig;

    const summary = buildRegulatoryOperationalReadModel({
      config,
      templates: [
        createTemplate({
          id: "template-biosseguranca",
          slug: "biosseguranca-operacional",
          nome: "Biosseguranca operacional - boas praticas",
        }),
      ],
      items: [
        createItem({
          id: "item-biosseguranca",
          template_id: "template-biosseguranca",
          area: "biosseguranca",
          codigo: "biosseguranca-checklist",
          payload: {
            label: "Biosseguranca operacional - checklist",
            subarea: "quarentena",
          },
        }),
      ],
    });

    expect(summary.entries[0]).toMatchObject({
      actionability: "actionable",
      status: "pendente",
    });
    expect(summary.attention.openCount).toBe(1);
    expect(summary.flows.movementInternal.warningCount).toBe(1);
  });
});
