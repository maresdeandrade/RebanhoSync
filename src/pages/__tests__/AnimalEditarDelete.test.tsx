/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { Animal } from "@/lib/offline/types";
import AnimalEditar from "@/pages/AnimalEditar";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useLotes");
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(async () => "tx-delete-animal"),
}));
vi.mock("@/utils/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const farmId = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";

function makeAnimal(): Animal {
  const timestamp = "2026-08-23T12:00:00.000Z";
  return {
    id: animalId,
    fazenda_id: farmId,
    identificacao: "DEL-001",
    sexo: "F",
    status: "ativo",
    especie: "bovino",
    lote_id: null,
    data_nascimento: "2024-01-01",
    data_entrada: "2024-01-01",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: "Animal para exclusao",
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: "snapshot relevante",
    payload: { origem_teste: "delete-handler" },
    client_id: "client-seed",
    client_op_id: "op-seed",
    client_tx_id: "tx-seed",
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
}

describe("AnimalEditar delete handler", () => {
  const animal = makeAnimal();

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.state_animais.clear();
    await db.state_animais.put(animal);
    vi.mocked(useAuth).mockReturnValue({
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    vi.mocked(useLotes).mockReturnValue([]);
    vi.mocked(useLiveQuery).mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_animais.get")) return animal;
      if (source.includes("const crias")) return false;
      return [];
    }) as typeof useLiveQuery);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await db.state_animais.clear();
  });

  it("confirma, cria DELETE de animais e remove a projecao operacional", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/animais/${animalId}/editar`]}>
        <Routes>
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Campo" }));
    await user.click(
      screen.getByRole("button", { name: "Excluir animal permanentemente" }),
    );

    await waitFor(() =>
      expect(createGesture).toHaveBeenCalledWith(farmId, [
        { table: "animais", action: "DELETE", record: { id: animalId } },
      ]),
    );
    await waitFor(() => expect(db.state_animais.get(animalId)).resolves.toBeUndefined());
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/animais");
  });
});
