/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { RegulatoryOverlayManager } from "@/components/sanitario/RegulatoryOverlayManager";

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

describe("RegulatoryOverlayManager", () => {
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica recorte analitico por impacto via query string", () => {
    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        {
          fazenda_id: "farm-1",
          uf: "SP",
          aptidao: "all",
          sistema: "all",
          zona_raiva_risco: "medio",
          pressao_carrapato: "medio",
          pressao_helmintos: "medio",
          modo_calendario: "minimo_legal",
          payload: {
            activated_template_slugs: ["feed-ban-ruminantes", "sp-atualizacao-rebanho"],
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
                  checked_at: "2026-04-11T10:00:00.000Z",
                  responsible: "Equipe",
                  notes: null,
                  source_evento_id: "event-1",
                  answers: {},
                },
                "sp-atualizacao-maio": {
                  template_slug: "sp-atualizacao-rebanho",
                  template_name: "Atualizacao de rebanho",
                  item_code: "sp-atualizacao-maio",
                  item_label: "Atualizacao documental",
                  subarea: "atualizacao_rebanho",
                  compliance_kind: "checklist",
                  status: "pendente",
                  checked_at: "2026-04-11T10:00:00.000Z",
                  responsible: "Equipe",
                  notes: null,
                  source_evento_id: "event-2",
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
        [
          {
            id: "template-feed-ban",
            slug: "feed-ban-ruminantes",
            nome: "Feed-ban",
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
          {
            id: "template-doc",
            slug: "sp-atualizacao-rebanho",
            nome: "Atualizacao de rebanho",
            versao: 1,
            escopo: "estadual",
            uf: "SP",
            aptidao: "all",
            sistema: "all",
            status_legal: "obrigatorio",
            base_legal_json: {},
            payload: {},
            created_at: "2026-04-11T10:00:00.000Z",
            updated_at: "2026-04-11T10:00:00.000Z",
          },
        ],
        [
          {
            id: "item-feed-ban",
            template_id: "template-feed-ban",
            area: "nutricao",
            codigo: "feed-ban",
            categoria_animal: null,
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
            created_at: "2026-04-11T10:00:00.000Z",
            updated_at: "2026-04-11T10:00:00.000Z",
          },
          {
            id: "item-doc",
            template_id: "template-doc",
            area: "notificacao",
            codigo: "sp-atualizacao-maio",
            categoria_animal: null,
            gatilho_tipo: "calendario",
            gatilho_json: {},
            frequencia_json: {},
            requires_vet: false,
            requires_gta: true,
            carencia_regra_json: {},
            gera_agenda: false,
            payload: {
              label: "Atualizacao documental",
              subarea: "atualizacao_rebanho",
            },
            created_at: "2026-04-11T10:00:00.000Z",
            updated_at: "2026-04-11T10:00:00.000Z",
          },
        ],
      ];
      let callCount = 0;
      return () => responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());

    render(
      <MemoryRouter
        initialEntries={["/protocolos-sanitarios?overlayImpact=nutrition"]}
      >
        <RegulatoryOverlayManager activeFarmId="farm-1" canManage={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Impacto: Impacta nutricao")).toBeInTheDocument();
    expect(screen.getByText("Feed-ban de ruminantes")).toBeInTheDocument();
    expect(screen.queryByText("Atualizacao documental")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpar recorte/i })).toBeInTheDocument();
  });

  it("renderiza complementos da fazenda na mesma camada do overlay", () => {
    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        {
          fazenda_id: "farm-1",
          uf: "SP",
          aptidao: "all",
          sistema: "all",
          zona_raiva_risco: "medio",
          pressao_carrapato: "medio",
          pressao_helmintos: "medio",
          modo_calendario: "minimo_legal",
          payload: {
            activated_template_slugs: [],
            custom_overlay_definitions: [
              {
                id: "overlay-farm-1",
                label: "Checklist pre-lote maternidade",
                description: "Revisar cama e segregacao antes da entrada.",
                subarea: "quarentena",
                status_legal: "boa_pratica",
                animal_centric: true,
                active: true,
                created_at: "2026-04-11T10:00:00.000Z",
                updated_at: "2026-04-11T10:00:00.000Z",
              },
            ],
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
        [],
        [],
      ];
      let callCount = 0;
      return () => responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());

    render(
      <MemoryRouter initialEntries={["/protocolos-sanitarios"]}>
        <RegulatoryOverlayManager activeFarmId="farm-1" canManage={true} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Complementos operacionais e overlays"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Checklist pre-lote maternidade"),
    ).toBeInTheDocument();
    expect(screen.getByText("Complemento operacional da fazenda")).toBeInTheDocument();
    expect(screen.queryByText("1 oficial(is) | 0 fazenda")).not.toBeInTheDocument();
    expect(screen.getByText("0 oficial(is) | 1 fazenda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /novo complemento da fazenda/i }),
    ).toBeInTheDocument();
  });
});
