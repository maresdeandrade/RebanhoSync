/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "@/lib/farms/measurementConfig";
import type { AgendaItem, Animal } from "@/lib/offline/types";
import AnimalDetalhe from "@/pages/AnimalDetalhe";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

function makeAnimal(
  overrides: Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">,
): Animal {
  return {
    id: overrides.id,
    fazenda_id: "farm-1",
    identificacao: overrides.identificacao,
    sexo: overrides.sexo,
    status: "ativo",
    lote_id: "lote-1",
    data_nascimento: "2025-01-10",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T00:00:00.000Z",
    server_received_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeAgendaItem(
  overrides: Partial<AgendaItem> & Pick<AgendaItem, "id" | "tipo" | "data_prevista">,
): AgendaItem {
  return {
    id: overrides.id,
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: overrides.tipo,
    status: "agendado",
    data_prevista: overrides.data_prevista,
    animal_id: "animal-1",
    lote_id: null,
    dedup_key: null,
    source_kind: "automatico",
    source_ref: null,
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: "item-1",
    interval_days_applied: 0,
    payload: {},
    client_id: "client-1",
    client_op_id: "agenda-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T00:00:00.000Z",
    server_received_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("AnimalDetalhe", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG,
    } as ReturnType<typeof useAuth>);
  });

  it("renderiza aba de agenda sem quebrar o fluxo da página", () => {
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });

    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        animal,
        null,
        null,
        null,
        [],
        [],
        [
          {
            item: makeAgendaItem({
              id: "agenda-1",
              tipo: "vacina_brucelose",
              data_prevista: "2026-04-15",
            }),
            scheduleLabel: "Aplicar entre 3 e 8 meses",
            scheduleModeLabel: "Janela etaria",
            scheduleAnchorLabel: "Nascimento",
          },
        ],
        [],
        null,
        [],
        null,
        null,
      ];
      let callCount = 0;
      return () =>
        (responses[callCount++] ?? null) as ReturnType<typeof useLiveQuery>;
    })());

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Proximo manejo")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /agenda/i })).toBeInTheDocument();
  });
});
