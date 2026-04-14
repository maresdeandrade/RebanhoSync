import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CatalogoDoencaNotificavel,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";

const mockState = {
  config: null as FazendaSanidadeConfig | null,
  protocols: [] as ProtocoloSanitario[],
  items: [] as ProtocoloSanitarioItem[],
};

function createWhereCollection<T extends { deleted_at: string | null }>(
  getRows: () => T[],
) {
  return {
    equals() {
      return {
        filter(predicate: (row: T) => boolean) {
          return {
            async toArray() {
              return getRows().filter(predicate);
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/offline/db", () => ({
  db: {
    state_fazenda_sanidade_config: {
      get: vi.fn(async () => mockState.config),
    },
    state_protocolos_sanitarios: {
      where: vi.fn(() => createWhereCollection(() => mockState.protocols)),
    },
    state_protocolos_sanitarios_itens: {
      where: vi.fn(() => createWhereCollection(() => mockState.items)),
    },
  },
}));

vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import {
  buildOfficialSanitaryPackOps,
  selectOfficialSanitaryPack,
} from "@/lib/sanitario/officialCatalog";

const templates: CatalogoProtocoloOficial[] = [
  {
    id: "tpl-bruc",
    slug: "brucelose-pncebt",
    nome: "Brucelose",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

const items: CatalogoProtocoloOficialItem[] = [
  {
    id: "item-bruc",
    template_id: "tpl-bruc",
    area: "vacinacao",
    codigo: "brucelose-b19",
    categoria_animal: "bezerra",
    gatilho_tipo: "idade",
    gatilho_json: { sexo_alvo: "F", age_start_days: 90, age_end_days: 240 },
    frequencia_json: { dose_num: 1 },
    requires_vet: true,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: true,
    payload: { produto: "Vacina Brucelose B19", label: "Brucelose B19" },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

const diseases: CatalogoDoencaNotificavel[] = [
  {
    codigo: "notif-generica",
    nome: "Suspeita notificavel",
    especie_alvo: "bovinos",
    tipo_notificacao: "imediata",
    sinais_alerta_json: {},
    acao_imediata_json: {},
    base_legal_json: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

describe("official sanitary catalog ops", () => {
  beforeEach(() => {
    mockState.config = null;
    mockState.protocols = [];
    mockState.items = [];
  });

  it("deactivates old official protocols that are no longer selected", async () => {
    mockState.protocols = [
      {
        id: "protocol-old",
        fazenda_id: "farm-1",
        nome: "Raiva antiga",
        descricao: "Pack antigo",
        ativo: true,
        payload: {
          official_template_id: "tpl-raiva",
          official_slug: "raiva-herbivoros-risco",
        },
        client_id: "client",
        client_op_id: "op-old",
        client_tx_id: null,
        client_recorded_at: "2026-04-09T00:00:00.000Z",
        server_received_at: "2026-04-09T00:00:00.000Z",
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
        deleted_at: null,
      },
    ];

    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
    );

    const ops = await buildOfficialSanitaryPackOps({
      fazendaId: "farm-1",
      config: {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
      selection,
    });

    expect(
      ops.some(
        (op) =>
          op.table === "protocolos_sanitarios" &&
          op.action === "UPDATE" &&
          op.record.id === "protocol-old" &&
          op.record.ativo === false,
      ),
    ).toBe(true);
  });

  it("materializes official mandatory protocols with explicit payload metadata for the declarative engine", async () => {
    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
    );

    const ops = await buildOfficialSanitaryPackOps({
      fazendaId: "farm-1",
      config: {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
      selection,
    });

    const protocolInsert = ops.find(
      (op) => op.table === "protocolos_sanitarios" && op.action === "INSERT",
    );
    const itemInsert = ops.find(
      (op) => op.table === "protocolos_sanitarios_itens" && op.action === "INSERT",
    );

    expect(protocolInsert?.record.payload).toMatchObject({
      status_legal: "obrigatorio",
      obrigatorio: true,
      family_code: "brucelose",
      regimen_version: 1,
    });
    expect(itemInsert?.record).toMatchObject({
      dedup_template: "sanitario:brucelose:{animal_id}:milestone:brucelose_b19",
      payload: {
        family_code: "brucelose",
        regimen_version: 1,
        regime_sanitario: {
          family_code: "brucelose",
          milestone_code: "brucelose_b19",
          compliance_state: "documentation_required",
        },
      },
    });
  });

  it("ALWAYS deactivates legacy MAPA seed templates even if not in current selection", async () => {
    // This tests the fix for user issue: Brucelose/Raiva duplication
    // User should not have to select them to deactivate legacy seeds
    mockState.protocols = [
      {
        id: "protocol-brucelose-legacy",
        fazenda_id: "farm-1",
        nome: "MAPA | Brucelose femeas 3-8 meses (B19/RB51)",
        descricao: "Legacy seed",
        ativo: true,
        payload: {
          template_code: "MAPA_BRUCELOSE_FEMEAS_3A8M_V2",
          seed_origin: "MAPA_SBMV",
        },
        client_id: "system:seed",
        client_op_id: "op-seed",
        client_tx_id: null,
        client_recorded_at: "2026-04-09T00:00:00.000Z",
        server_received_at: "2026-04-09T00:00:00.000Z",
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "protocol-raiva-legacy",
        fazenda_id: "farm-1",
        nome: "MAPA | Raiva herbivoros - primovacinacao (areas de risco)",
        descricao: "Legacy seed",
        ativo: true,
        payload: {
          template_code: "MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2",
          seed_origin: "MAPA_SBMV",
        },
        client_id: "system:seed",
        client_op_id: "op-seed",
        client_tx_id: null,
        client_recorded_at: "2026-04-09T00:00:00.000Z",
        server_received_at: "2026-04-09T00:00:00.000Z",
        created_at: "2026-04-09T00:00:00.000Z",
        updated_at: "2026-04-09T00:00:00.000Z",
        deleted_at: null,
      },
    ];

    // User selects ONLY vermifugacao, NOT brucelose or raiva
    // (minimal pack without MAPA mandatory items - should force activate them)
    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal", // This selects brucelose+raiva+vermif
      },
    );

    const ops = await buildOfficialSanitaryPackOps({
      fazendaId: "farm-1",
      config: {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
      selection,
    });

    // CRITICAL: Both legacy MAPA templates MUST be deactivated
    expect(
      ops.filter(
        (op) =>
          op.table === "protocolos_sanitarios" &&
          op.action === "UPDATE" &&
          op.record.ativo === false &&
          (op.record.id === "protocol-brucelose-legacy" ||
            op.record.id === "protocol-raiva-legacy")
      ).length
    ).toBe(2);

    // Verify deactivation reason is specific to legacy MAPA
    const bruceloseFix = ops.find(
      (op) =>
        op.table === "protocolos_sanitarios" &&
        op.record.id === "protocol-brucelose-legacy" &&
        op.record.ativo === false
    );
    expect(bruceloseFix?.record.payload?.official_pack_disabled_reason).toBe(
      "legacy_seed_mapa_always_replaced_by_official_catalog"
    );
  });
});

