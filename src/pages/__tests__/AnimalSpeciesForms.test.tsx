/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { createGesture } from "@/lib/offline/ops";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import type { Animal } from "@/lib/offline/types";
import AnimalNovo from "@/pages/AnimalNovo";
import AnimalEditar from "@/pages/AnimalEditar";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useLotes");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(async () => "tx-1"),
}));
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  function findAriaLabel(children: React.ReactNode): string | undefined {
    const childArray = React.Children.toArray(children);
    for (const child of childArray) {
      if (!React.isValidElement(child)) continue;
      const props = child.props as {
        "aria-label"?: string;
        children?: React.ReactNode;
      };
      if (props["aria-label"]) return props["aria-label"];
      const nested = findAriaLabel(props.children);
      if (nested) return nested;
    }
    return undefined;
  }

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) =>
      React.createElement(
        "select",
        {
          value,
          "aria-label": findAriaLabel(children),
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange?.(event.target.value),
        },
        children,
      ),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children?: React.ReactNode;
    }) => React.createElement("option", { value }, children),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "BR-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: null,
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: null,
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

async function chooseSpecies(label: string) {
  const value = label === "Bubalino" ? "bubalino" : "bovino";
  fireEvent.change(screen.getByRole("combobox", { name: "Espécie" }), {
    target: { value },
  });
}

describe("animal species in create/edit forms", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseLotes.mockReturnValue([]);
    mockedUseLiveQuery.mockReturnValue([]);
  });

  it("grava especie informada no cadastro novo", async () => {
    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "BR-010" },
    });
    await chooseSpecies("Bubalino");
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record).toMatchObject({
      identificacao: "BR-010",
      especie: "bubalino",
    });
  });

  it("preserva especie existente na edicao quando o campo nao muda", async () => {
    const existingAnimal = makeAnimal({ especie: "bovino" });
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_animais.get")) {
        return existingAnimal;
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
        <Routes>
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0],
    );

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record.especie).toBe("bovino");
  });

  it("altera especie no cadastro existente", async () => {
    const existingAnimal = makeAnimal({ especie: "bovino" });
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_animais.get")) {
        return existingAnimal;
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
        <Routes>
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Espécie" })).toHaveValue(
        "bovino",
      ),
    );
    await chooseSpecies("Bubalino");
    expect(screen.getByRole("combobox", { name: "Espécie" })).toHaveValue(
      "bubalino",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0],
    );

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record.especie).toBe("bubalino");
  });
});
