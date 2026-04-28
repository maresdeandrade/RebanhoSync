import type {
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
} from "@/lib/offline/types";
import {
  buildActiveRegulatoryOverlayEntries,
  buildRegulatoryOverlayConfigPayload,
  buildRegulatoryOverlayEventPayload,
  readRegulatoryOverlayRuntimeRecord,
} from "@/lib/sanitario/compliance/compliance";

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
    execution_mode: "checklist",
    animal_centric: false,
  },
  created_at: "2026-04-10T00:00:00.000Z",
  updated_at: "2026-04-10T00:00:00.000Z",
};

const feedBanItem: CatalogoProtocoloOficialItem = {
  id: "item-1",
  template_id: "template-1",
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

const config: FazendaSanidadeConfig = {
  fazenda_id: "farm-1",
  uf: "SP",
  aptidao: "all",
  sistema: "all",
  zona_raiva_risco: "baixo",
  pressao_carrapato: "baixo",
  pressao_helmintos: "baixo",
  modo_calendario: "completo",
  payload: {
    activated_template_slugs: ["feed-ban-ruminantes"],
  },
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: "tx-1",
  client_recorded_at: "2026-04-10T00:00:00.000Z",
  server_received_at: "2026-04-10T00:00:00.000Z",
  created_at: "2026-04-10T00:00:00.000Z",
  updated_at: "2026-04-10T00:00:00.000Z",
  deleted_at: null,
};

describe("regulatory overlay compliance helpers", () => {
  it("builds active procedural entries from the official pack selection", () => {
    const entries = buildActiveRegulatoryOverlayEntries({
      config,
      templates: [template],
      items: [feedBanItem],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      label: "Feed-ban de ruminantes",
      complianceKind: "feed_ban",
      status: "pendente",
    });
  });

  it("writes overlay runtime state back into fazenda_sanidade_config payload", () => {
    const [entry] = buildActiveRegulatoryOverlayEntries({
      config,
      templates: [template],
      items: [feedBanItem],
    });

    const nextPayload = buildRegulatoryOverlayConfigPayload(
      config.payload,
      entry,
      {
        status: "conforme",
        occurredAt: "2026-04-10T12:00:00.000Z",
        responsible: "Equipe de nutricao",
        notes: "Rotulo revisado sem ingrediente proibido.",
        answers: {
          product_name: "Suplemento mineral",
          reviewed_label: true,
          prohibited_detected: false,
        },
      },
      "event-1",
    );

    expect(readRegulatoryOverlayRuntimeRecord(nextPayload, "feed-ban")).toMatchObject({
      status: "conforme",
      responsible: "Equipe de nutricao",
      sourceEventId: "event-1",
    });
  });

  it("builds append-only event payload for the compliance event", () => {
    const [entry] = buildActiveRegulatoryOverlayEntries({
      config,
      templates: [template],
      items: [feedBanItem],
    });

    const payload = buildRegulatoryOverlayEventPayload(entry, {
      status: "ajuste_necessario",
      occurredAt: "2026-04-10T12:00:00.000Z",
      responsible: "Equipe de nutricao",
      notes: "Formula com insumo proibido detectado.",
      answers: {
        product_name: "Racao teste",
        prohibited_detected: true,
      },
    });

    expect(payload).toMatchObject({
      kind: "overlay_regulatorio",
      compliance_kind: "feed_ban",
      official_template_slug: "feed-ban-ruminantes",
      official_item_code: "feed-ban",
      status: "ajuste_necessario",
    });
  });

  it("surfaces custom farm overlays in the same operational layer", () => {
    const entries = buildActiveRegulatoryOverlayEntries({
      config: {
        ...config,
        payload: {
          ...config.payload,
          custom_overlay_definitions: [
            {
              id: "overlay-farm-1",
              label: "Checklist pre-lote maternidade",
              description: "Revisar cama, agua e segregacao antes da entrada.",
              subarea: "quarentena",
              status_legal: "boa_pratica",
              animal_centric: true,
              active: true,
              created_at: "2026-04-10T00:00:00.000Z",
              updated_at: "2026-04-10T00:00:00.000Z",
            },
          ],
        },
      },
      templates: [template],
      items: [feedBanItem],
    });

    const customEntry = entries.find(
      (entry) => entry.customOverlayId === "overlay-farm-1",
    );

    expect(customEntry).toMatchObject({
      label: "Checklist pre-lote maternidade",
      complianceKind: "checklist",
      sourceScope: "fazenda",
      editable: true,
      animalCentric: true,
      subarea: "quarentena",
      status: "pendente",
    });
    expect(customEntry?.template.nome).toBe("Complemento operacional da fazenda");
  });

  it("builds append-only payload for a custom farm overlay event", () => {
    const [entry] = buildActiveRegulatoryOverlayEntries({
      config: {
        ...config,
        payload: {
          ...config.payload,
          activated_template_slugs: [],
          custom_overlay_definitions: [
            {
              id: "overlay-farm-1",
              label: "Checklist pre-lote maternidade",
              description: "Revisar cama, agua e segregacao antes da entrada.",
              subarea: "quarentena",
              status_legal: "recomendado",
              animal_centric: false,
              active: true,
              created_at: "2026-04-10T00:00:00.000Z",
              updated_at: "2026-04-10T00:00:00.000Z",
            },
          ],
        },
      },
      templates: [template],
      items: [feedBanItem],
    });

    const payload = buildRegulatoryOverlayEventPayload(entry, {
      status: "conforme",
      occurredAt: "2026-04-10T12:00:00.000Z",
      responsible: "Equipe sanitaria",
      notes: "Checklist local concluido.",
      answers: {
        rotina_executada: true,
        pendencias_tratadas: true,
      },
    });

    expect(payload).toMatchObject({
      kind: "overlay_regulatorio",
      source_scope: "fazenda",
      custom_overlay_id: "overlay-farm-1",
      custom_overlay_label: "Checklist pre-lote maternidade",
      custom_status_legal: "recomendado",
      status: "conforme",
    });
  });
});
