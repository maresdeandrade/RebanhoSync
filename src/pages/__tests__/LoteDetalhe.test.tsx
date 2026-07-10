/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import LoteDetalhe from "@/pages/LoteDetalhe";
import { useAuth } from "@/hooks/useAuth";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/hooks/useAuth");
vi.mock("@/components/manejo/AdicionarAnimaisLote", () => ({
  AdicionarAnimaisLote: () => null,
}));
vi.mock("@/components/manejo/MudarPastoLote", () => ({
  MudarPastoLote: () => null,
}));
vi.mock("@/components/manejo/TrocarTouroLote", () => ({
  TrocarTouroLote: () => null,
}));
vi.mock("@/features/occupancy/useOccupancyData", () => ({
  useOccupancyData: () => ({
    allAnimalPeriods: [],
    getLoteMetrics: () => null,
    getPastoMetrics: () => null,
    animalsMap: new Map(),
  }),
}));

const emptyCatalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [],
  items: [],
  productClassGroups: [],
};

const protocol = (familyCode: string, overrides: JsonRecord = {}): JsonRecord => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name: familyCode === "brucelose_b19" ? "Brucelose B19" : familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: { species: ["bovino", "bubalino"] },
  jurisdiction_scope: { country: "BR", legal_scope: "nacional" },
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  approval_status: "draft",
  source_refs_snapshot: [],
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
  ...overrides,
});

const item = (
  protocolId: string,
  logicalItemKey: string,
  overrides: JsonRecord = {},
): JsonRecord => ({
  id: `item-${logicalItemKey}`,
  protocol_id: protocolId,
  logical_item_key: logicalItemKey,
  version: 1,
  item_status: "draft",
  action_type: "orientacao",
  product_requirement_kind: "none",
  product_id: null,
  product_class: null,
  product_class_group_id: null,
  eligibility_rule: {},
  operational_window_rule: {},
  dose_rule: {},
  route_rule: {},
  booster_rule: {},
  species_authorization: {},
  source_refs_by_field: {},
  limitations: [],
  snapshot_template: {},
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
  ...overrides,
});

function buildB19Catalog(): SanitaryProtocolCatalogReadModelV2 {
  return {
    protocols: [
      protocol("brucelose_b19", {
        legal_status: "obrigatorio_norma",
      }),
    ].map(adaptSanitaryProtocolV2Row),
    items: [
      item("protocol-brucelose_b19", "b19_femeas_3_8_meses", {
        item_status: "obrigatorio",
        action_type: "vacinacao",
        product_requirement_kind: "product_class",
        product_class: "vacina_brucelose_b19",
        eligibility_rule: {
          species: ["bovino", "bubalino"],
          sex: "femea",
          age_min_months: 3,
          age_max_months: 8,
        },
      }),
    ].map(adaptSanitaryProtocolItemV2Row),
    productClassGroups: [],
  };
}

describe("LoteDetalhe page", () => {
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedUseAuth = vi.mocked(useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      farmLifecycleConfig: { weightFreshnessDays: 90 },
      session: { user: { id: "user-1" } },
      loading: false,
      activeFarmId: "farm-1",
      role: "owner",
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("antecipa restricao regulatoria de movimentacao no lote", () => {
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_lotes.get")) {
        return {
          id: "lote-1",
          fazenda_id: "farm-1",
          nome: "Lote de entrada",
          status: "ativo",
          pasto_id: "pasto-1",
          touro_id: null,
          observacoes: null,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-lote",
          client_tx_id: null,
          client_recorded_at: "2026-04-11T10:00:00.000Z",
          server_received_at: "2026-04-11T10:00:00.000Z",
          created_at: "2026-04-11T10:00:00.000Z",
          updated_at: "2026-04-11T10:00:00.000Z",
          deleted_at: null,
        } as unknown as Lote;
      }
      if (source.includes("db.state_pastos.get")) {
        return {
          id: "pasto-1",
          fazenda_id: "farm-1",
          nome: "Piquete 3",
          area_ha: 12,
          capacidade_ua: 20,
          tipo_pasto: "cultivado",
          infraestrutura: {},
          observacoes: null,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-pasto",
          client_tx_id: null,
          client_recorded_at: "2026-04-11T10:00:00.000Z",
          server_received_at: "2026-04-11T10:00:00.000Z",
          created_at: "2026-04-11T10:00:00.000Z",
          updated_at: "2026-04-11T10:00:00.000Z",
          deleted_at: null,
        } as unknown as Pasto;
      }
      if (source.includes("db.state_animais.get")) {
        return undefined; // touro
      }
      if (source.includes("db.state_animais.where") && source.includes("lote_id")) {
        return []; // animais array
      }
      if (source.includes("readLocalSanitaryProtocolCatalogV2")) {
        return emptyCatalog;
      }
      if (source.includes("getLotSanitaryExecutedHistoryV2")) return [];
      if (source.includes("loadRegulatorySurfaceSource")) {
        return {
          config: {
            fazenda_id: "farm-1",
            uf: "SP",
            aptidao: "all",
            sistema: "all",
            zona_raiva_risco: "medio",
            pressao_carrapato: "medio",
            pressao_helmintos: "medio",
            modo_calendario: "minimo_legal",
            payload: {
              activated_template_slugs: ["quarentena-entrada"],
              overlay_runtime: {
                items: {
                  "quarentena-entrada": {
                    template_slug: "quarentena-entrada",
                    template_name: "Quarentena de entrada",
                    item_code: "quarentena-entrada",
                    item_label: "Quarentena de entrada",
                    subarea: "quarentena",
                    compliance_kind: "checklist",
                    status: "ajuste_necessario",
                    checked_at: "2026-04-11T10:00:00.000Z",
                    responsible: "Equipe",
                    notes: null,
                    source_evento_id: "event-1",
                    answers: {},
                  },
                },
              },
            },
            client_id: "client-1",
            client_op_id: "op-config",
            client_tx_id: null,
            client_recorded_at: "2026-04-11T10:00:00.000Z",
            server_received_at: "2026-04-11T10:00:00.000Z",
            created_at: "2026-04-11T10:00:00.000Z",
            updated_at: "2026-04-11T10:00:00.000Z",
            deleted_at: null,
          },
          templates: [
            {
              id: "template-quarentena",
              slug: "quarentena-entrada",
              nome: "Quarentena de entrada",
              versao: 1,
              escopo: "federal",
              uf: null,
              aptidao: "all",
              sistema: "all",
              status_legal: "obrigatorio",
              base_legal_json: {},
              payload: {},
              created_at: "2026-04-11T10:00:00.000Z",
              updated_at: "2026-04-11T10:00:00.000Z",
            },
          ],
          items: [
            {
              id: "item-quarentena",
              template_id: "template-quarentena",
              area: "biosseguranca",
              codigo: "quarentena-entrada",
              categoria_animal: null,
              gatilho_tipo: "entrada",
              gatilho_json: {},
              frequencia_json: {},
              requires_vet: false,
              requires_gta: false,
              carencia_regra_json: {},
              gera_agenda: false,
              payload: {
                label: "Quarentena de entrada",
                subarea: "quarentena",
              },
              created_at: "2026-04-11T10:00:00.000Z",
              updated_at: "2026-04-11T10:00:00.000Z",
            },
          ],
        } as unknown as { config: Record<string, unknown>; templates: Record<string, unknown>[]; items: Record<string, unknown>[] };
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/lotes/lote-1"]}>
        <Routes>
          <Route path="/lotes/:id" element={<LoteDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Conformidade impacta este lote"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Estado atual do lote vindo de state_\*; movimentacoes, manejos e operacoes abaixo sao fatos historicos executados/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Movimentação restrita")).toBeInTheDocument();
    const addButtons = screen.getAllByRole("button", {
      name: /adicionar animais/i,
    });
    expect(addButtons[0]).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /abrir conformidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manejar este lote/i }),
    ).toHaveAttribute("href", "/registrar?loteId=lote-1");
    expect(
      screen.getByRole("heading", { name: "Sanidade" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(
      screen.getByText("Dados insuficientes para avaliar o lote."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Catálogo sanitário local ainda não sincronizado"),
    ).toBeInTheDocument();
  });

  it("renderiza pre-checagem sanitaria v2 do lote com catalogo local e animais", () => {
    const lote: Lote = {
      id: "lote-1",
      fazenda_id: "farm-1",
      nome: "Lote recria",
      status: "ativo",
      pasto_id: null,
      touro_id: null,
      observacoes: null,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-lote",
      client_tx_id: null,
      client_recorded_at: "2026-04-11T10:00:00.000Z",
      server_received_at: "2026-04-11T10:00:00.000Z",
      created_at: "2026-04-11T10:00:00.000Z",
      updated_at: "2026-04-11T10:00:00.000Z",
      deleted_at: null,
    };
    const animal: Animal = {
      id: "animal-1",
      fazenda_id: "farm-1",
      identificacao: "BR-001",
      sexo: "F",
      status: "ativo",
      lote_id: "lote-1",
      data_nascimento: "2026-01-01",
      data_entrada: null,
      data_saida: null,
      pai_id: null,
      mae_id: null,
      nome: null,
      rfid: null,
      especie: "bovino",
      origem: "nascimento",
      raca: null,
      papel_macho: null,
      habilitado_monta: false,
      observacoes: null,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-animal",
      client_tx_id: null,
      client_recorded_at: "2026-04-11T10:00:00.000Z",
      server_received_at: "2026-04-11T10:00:00.000Z",
      created_at: "2026-04-11T10:00:00.000Z",
      updated_at: "2026-04-11T10:00:00.000Z",
      deleted_at: null,
    };

    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_lotes.get")) return lote;
      if (source.includes("db.state_pastos.get")) return undefined;
      if (source.includes("db.state_animais.get")) return undefined;
      if (source.includes("db.state_animais.where") && source.includes("lote_id")) {
        return [animal];
      }
      if (source.includes("readLocalSanitaryProtocolCatalogV2")) {
        return buildB19Catalog();
      }
      if (source.includes("getLotSanitaryExecutedHistoryV2")) return [];
      if (source.includes("loadRegulatorySurfaceSource")) return null;
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/lotes/lote-1"]}>
        <Routes>
          <Route path="/lotes/:id" element={<LoteDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sanidade" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Brucelose B19")).toBeInTheDocument();
    expect(screen.getAllByText("B19 — fêmeas de 3 a 8 meses")).toHaveLength(1);
    expect(
      screen.getByText("Há fêmeas do lote dentro da janela B19 de 3 a 8 meses."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Animal /)).not.toBeInTheDocument();
    expect(screen.getAllByText("Em janela").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /criar agenda/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^registrar$/i }))
      .not.toBeInTheDocument();
  });
});
