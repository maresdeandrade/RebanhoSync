/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { createGesture } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";
import { showSuccess } from "@/utils/toast";
import AnimalEditar from "@/pages/AnimalEditar";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useLotes", () => ({ useLotes: () => [] }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("@/lib/offline/db", () => ({
  db: { state_animais: { get: vi.fn(), put: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn() }));
vi.mock("@/utils/toast", () => ({ showSuccess: vi.fn(), showError: vi.fn() }));
const animal = {
  id: "animal-1",
  fazenda_id: "farm-1",
  identificacao: "BOI-001",
  sexo: "F",
  especie: "bovino",
  status: "ativo",
  rfid: "RFID-001",
  payload: {},
};
function page() {
  return (
    <MemoryRouter
      initialEntries={["/animais/animal-1/editar"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/animais/:id/editar" element={<AnimalEditar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("acessibilidade do scanner RFID simulado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    vi.mocked(useLiveQuery).mockImplementation(((query) => {
      const source = String(query);
      if (source.includes("db.state_animais.get")) return animal;
      if (source.includes("const crias")) return false;
      return [];
    }) as typeof useLiveQuery);
  });
  afterEach(cleanup);
  it("tem nome acessivel descritivo e preserva a simulacao ao clicar", async () => {
    const user = userEvent.setup();
    render(page());
    const scanner = screen.getByRole("button", {
      name: "Simular leitura de RFID do animal",
    });
    expect(scanner).toHaveAttribute("type", "button");
    expect(scanner).toBeEnabled();
    expect(screen.getByLabelText("RFID")).toHaveValue("RFID-001");
    await user.click(scanner);
    expect(showSuccess).toHaveBeenCalledExactlyOnceWith(
      "Scanner de campo ativado (Simulação).",
    );
    expect(screen.getByLabelText("RFID")).toHaveValue("RFID-001");
    expect(createGesture).not.toHaveBeenCalled();
    expect(db.state_animais.put).not.toHaveBeenCalled();
    expect(db.state_animais.update).not.toHaveBeenCalled();
  });
  it("recebe foco apos o campo RFID e funciona com Enter e Espaco sem salvar", async () => {
    const user = userEvent.setup();
    render(page());
    const field = screen.getByLabelText("RFID");
    field.focus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Simular leitura de RFID do animal" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(showSuccess).toHaveBeenCalledTimes(2);
    expect(showSuccess).toHaveBeenNthCalledWith(
      1,
      "Scanner de campo ativado (Simulação).",
    );
    expect(showSuccess).toHaveBeenNthCalledWith(
      2,
      "Scanner de campo ativado (Simulação).",
    );
    expect(field).toHaveValue("RFID-001");
    expect(createGesture).not.toHaveBeenCalled();
    expect(db.state_animais.put).not.toHaveBeenCalled();
    expect(db.state_animais.update).not.toHaveBeenCalled();
  });
});
