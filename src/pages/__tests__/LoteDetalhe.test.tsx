/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import LoteDetalhe from "@/pages/LoteDetalhe";

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/components/manejo/AdicionarAnimaisLote", () => ({
  AdicionarAnimaisLote: () => null,
}));
vi.mock("@/components/manejo/MudarPastoLote", () => ({
  MudarPastoLote: () => null,
}));
vi.mock("@/components/manejo/TrocarTouroLote", () => ({
  TrocarTouroLote: () => null,
}));

describe("LoteDetalhe page", () => {
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("antecipa restricao regulatoria de movimentacao no lote", () => {
    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 5;
        callCount += 1;

        switch (index) {
          case 0:
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
            } as ReturnType<typeof useLiveQuery>;
          case 1:
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
            } as ReturnType<typeof useLiveQuery>;
          case 2:
            return undefined as ReturnType<typeof useLiveQuery>;
          case 3:
            return [] as ReturnType<typeof useLiveQuery>;
          case 4:
          default:
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
            } as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter initialEntries={["/lotes/lote-1"]}>
        <Routes>
          <Route path="/lotes/:id" element={<LoteDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Overlay regulatorio impacta este lote"),
    ).toBeInTheDocument();
    expect(screen.getByText("Movimentacao restrita")).toBeInTheDocument();
    const addButtons = screen.getAllByRole("button", {
      name: /adicionar animais/i,
    });
    expect(addButtons[0]).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /abrir overlay de conformidade/i }),
    ).toBeInTheDocument();
  });
});
