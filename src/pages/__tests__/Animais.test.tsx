/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "@/lib/farms/measurementConfig";
import type { Animal } from "@/lib/offline/types";
import Animais from "@/pages/Animais";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useDebouncedValue");
vi.mock("@/hooks/useLotes");
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

describe("Animais page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseDebouncedValue = vi.mocked(useDebouncedValue);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseDebouncedValue.mockImplementation((value) => value);
    mockedUseLotes.mockReturnValue([
      {
        id: "lote-1",
        fazenda_id: "farm-1",
        nome: "Matrizes",
        status: "ativo",
        pasto_id: null,
        touro_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-lote",
        client_tx_id: null,
        client_recorded_at: "2026-04-01T00:00:00.000Z",
        server_received_at: "2026-04-01T00:00:00.000Z",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        deleted_at: null,
      },
    ] as ReturnType<typeof useLotes>);
  });

  it("prioriza peso, ganho e proximo evento sem exibir fase vet ou vinculo", () => {
    const mother = makeAnimal({
      id: "cow-1",
      identificacao: "M-100",
      sexo: "F",
      nome: "Aurora",
      data_nascimento: "2020-01-10",
    });
    const calf = makeAnimal({
      id: "calf-1",
      identificacao: "BZ-01",
      sexo: "F",
      mae_id: mother.id,
      data_nascimento: "2026-02-01",
    });

    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 5;
        callCount += 1;

        switch (index) {
          case 0:
            return [mother, calf] as ReturnType<typeof useLiveQuery>;
          case 1:
            return [] as ReturnType<typeof useLiveQuery>;
          case 2:
            return [
              {
                animalId: mother.id,
                ultimoPesoKg: 450,
                ultimoPesoData: "2026-04-01T00:00:00.000Z",
                ganhoMedioDiaKg: 0.4,
                totalPesagens: 3,
              },
              {
                animalId: calf.id,
                ultimoPesoKg: 62,
                ultimoPesoData: "2026-04-03T00:00:00.000Z",
                ganhoMedioDiaKg: 0.7,
                totalPesagens: 2,
              },
            ] as ReturnType<typeof useLiveQuery>;
          case 3:
            return [
              {
                animalId: calf.id,
                titulo: "Sanitario: vacina reforco",
                data: "2026-04-10",
                status: "proximo",
              },
            ] as ReturnType<typeof useLiveQuery>;
          case 4:
          default:
            return [mother] as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getByText("Peso atual")).toBeInTheDocument();
    expect(screen.getByText("Ganho")).toBeInTheDocument();
    expect(screen.getByText("Proximo evento")).toBeInTheDocument();
    expect(screen.queryByText("Fase vet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Vinculo")).not.toBeInTheDocument();
    expect(screen.queryByText(/junto da matriz/i)).not.toBeInTheDocument();
    expect(screen.getByText("450,0 kg")).toBeInTheDocument();
    expect(screen.getByText("0,7 kg/dia")).toBeInTheDocument();
    expect(screen.getByText("Sanitario: vacina reforco")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir matriz" })).toBeInTheDocument();
  });
});
