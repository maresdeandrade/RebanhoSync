/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import type { Pasto } from "@/lib/offline/types";
import { getActiveFarmId } from "@/lib/storage";
import PastoDetalhe from "@/pages/PastoDetalhe";
import PastoEditar from "@/pages/PastoEditar";
import PastoNovo from "@/pages/PastoNovo";
import Pastos from "@/pages/Pastos";
import { showError } from "@/utils/toast";

vi.mock("@/hooks/useAuth");
vi.mock("@/lib/storage", () => ({
  getActiveFarmId: vi.fn(),
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(async () => "tx-1"),
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
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

function makePasto(overrides: Partial<Pasto> = {}): Pasto {
  return {
    id: "pasto-1",
    fazenda_id: "farm-1",
    nome: "Piquete 1",
    area_ha: 12,
    capacidade_ua: 18,
    tipo_pasto: "cultivado",
    tipo_area: null,
    forrageira_nome: null,
    forrageira_genero: null,
    forrageira_cultivar: null,
    altura_entrada_alvo_cm: null,
    altura_saida_alvo_cm: null,
    capacidade_ua_alvo: null,
    infraestrutura: {},
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-05-08T00:00:00.000Z",
    server_received_at: "2026-05-08T00:00:00.000Z",
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function mockLiveQueriesForPasto(pasto: Pasto | null) {
  vi.mocked(useLiveQuery).mockImplementation(((query) => {
    const source = typeof query === "function" ? query.toString() : "";
    if (source.includes("db.state_pastos.get")) return pasto;
    if (source.includes("db.state_pastos")) return pasto ? [pasto] : [];
    if (source.includes(".count()")) return 0;
    return [];
  }) as typeof useLiveQuery);
}

describe("P2 pasture management fields", () => {
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmId).mockReturnValue("farm-1");
    vi.mocked(useAuth).mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);
    mockLiveQueriesForPasto(null);
  });

  it("PastoNovo salva os novos campos", async () => {
    render(
      <MemoryRouter>
        <PastoNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome do pasto/i), {
      target: { value: "Piquete 2" },
    });
    fireEvent.change(screen.getByLabelText(/Area \(ha\)/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de pastagem" }), {
      target: { value: "cultivado" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Forrageira / cultivar" }), {
      target: { value: "Massai" },
    });
    fireEvent.change(screen.getByLabelText(/Capacidade \(UA\)/i), {
      target: { value: "22" },
    });
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Taxa de cobertura do solo / Aspecto visual",
      }),
      {
        target: { value: "media" },
      },
    );
    fireEvent.change(screen.getByLabelText(/Alt. entrada/i), {
      target: { value: "35" },
    });
    fireEvent.change(screen.getByLabelText(/Alt. saída/i), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar pasto/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    expect(mockedCreateGesture.mock.calls[0]?.[1][0]?.record).toMatchObject({
      nome: "Piquete 2",
      tipo_area: "cultivado",
      forrageira_genero: null,
      forrageira_nome: null,
      forrageira_cultivar: "Massai",
      altura_entrada_alvo_cm: 35,
      altura_saida_alvo_cm: 15,
      capacidade_ua: 22,
      capacidade_ua_alvo: 22,
    });
    expect(mockedCreateGesture.mock.calls[0]?.[1].map((op) => op.table)).toEqual([
      "pastos",
      "eventos",
      "eventos_pasto_avaliacao",
    ]);
    expect(mockedCreateGesture.mock.calls[0]?.[1][2]?.record).toMatchObject({
      pasto_id: mockedCreateGesture.mock.calls[0]?.[1][0]?.record.id,
      lote_id: null,
      ocupacao_id: null,
      momento: "ronda",
      cobertura_solo: "media",
    });
    expect(
      mockedCreateGesture.mock.calls[0]?.[1][0]?.record.infraestrutura.curral,
    ).toBeUndefined();
  });

  it("PastoEditar carrega e salva os novos campos", async () => {
    mockLiveQueriesForPasto(
      makePasto({
        forrageira_genero: "Panicum",
        forrageira_nome: "Mombaca",
        forrageira_cultivar: "Massai",
        altura_entrada_alvo_cm: 35,
        altura_saida_alvo_cm: 15,
        capacidade_ua_alvo: 22,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/pastos/pasto-1/editar"]}>
        <Routes>
          <Route path="/pastos/:id/editar" element={<PastoEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Forrageira / cultivar" })).toHaveValue("Massai"),
    );
    expect(screen.getByLabelText(/Capacidade \(UA\)/i)).toHaveValue(22);

    fireEvent.change(screen.getByLabelText(/Capacidade \(UA\)/i), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    expect(mockedCreateGesture.mock.calls[0]?.[1][0]?.record).toMatchObject({
      tipo_area: "cultivado",
      forrageira_genero: null,
      forrageira_nome: null,
      forrageira_cultivar: "Massai",
      altura_entrada_alvo_cm: 35,
      altura_saida_alvo_cm: 15,
      capacidade_ua: 24,
      capacidade_ua_alvo: 24,
    });
    expect(
      mockedCreateGesture.mock.calls[0]?.[1][0]?.record.infraestrutura.curral,
    ).toBeUndefined();
  });

  it("bloqueia altura de saida maior ou igual a entrada", async () => {
    render(
      <MemoryRouter>
        <PastoNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome do pasto/i), {
      target: { value: "Piquete 2" },
    });
    fireEvent.change(screen.getByLabelText(/Area \(ha\)/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Alt. entrada/i), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText(/Alt. saída/i), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar pasto/i })[0]);

    expect(showError).toHaveBeenCalledWith(
      "Altura de saida deve ser menor que a altura de entrada.",
    );
    expect(mockedCreateGesture).not.toHaveBeenCalled();
  });

  it("bloqueia altura zero ou negativa quando preenchida", async () => {
    render(
      <MemoryRouter>
        <PastoNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome do pasto/i), {
      target: { value: "Piquete 2" },
    });
    fireEvent.change(screen.getByLabelText(/Area \(ha\)/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Alt. entrada/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar pasto/i })[0]);

    expect(showError).toHaveBeenCalledWith(
      "Altura de entrada deve ser maior que zero.",
    );
    expect(mockedCreateGesture).not.toHaveBeenCalled();
  });

  it("PastoDetalhe renderiza registro antigo sem quebrar", async () => {
    mockLiveQueriesForPasto(makePasto({ tipo_pasto: "nativo" }));

    render(
      <MemoryRouter initialEntries={["/pastos/pasto-1"]}>
        <Routes>
          <Route path="/pastos/:id" element={<PastoDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Tipo de pastagem: nativo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nao informado/i).length).toBeGreaterThan(0);
  });

  it("Pastos aplica fallback cultivar, forrageira, tipo_area, tipo_pasto e Nao informado", () => {
    mockLiveQueriesForPasto(
      makePasto({
        tipo_pasto: null as unknown as Pasto["tipo_pasto"],
        tipo_area: null,
        forrageira_nome: null,
        forrageira_genero: null,
        forrageira_cultivar: null,
      }),
    );

    render(
      <MemoryRouter>
        <Pastos />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Nao informado/i).length).toBeGreaterThan(0);
  });
});

describe("P3 pasture infrastructure scope", () => {
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmId).mockReturnValue("farm-1");
    vi.mocked(useAuth).mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);
    mockLiveQueriesForPasto(null);
  });

  it("PastoNovo nao renderiza curral, brete ou balanca", () => {
    render(
      <MemoryRouter>
        <PastoNovo />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/curral/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/brete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/balan[cç]a/i)).not.toBeInTheDocument();
  });

  it("PastoNovo salva infraestrutura sem curral", async () => {
    render(
      <MemoryRouter>
        <PastoNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome do pasto/i), {
      target: { value: "Piquete sem curral" },
    });
    fireEvent.change(screen.getByLabelText(/Area \(ha\)/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar pasto/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const record = mockedCreateGesture.mock.calls[0]?.[1][0]?.record;
    expect(record.infraestrutura).toMatchObject({
      cochos: expect.any(Object),
      bebedouros: expect.any(Object),
      saleiros: expect.any(Object),
      cerca: expect.any(Object),
    });
    expect(record.infraestrutura.curral).toBeUndefined();
  });

  it("PastoEditar nao renderiza curral, brete ou balanca", async () => {
    mockLiveQueriesForPasto(
      makePasto({
        infraestrutura: {
          cochos: { quantidade: 1, tipo: "madeira", estado: "bom" },
          bebedouros: { quantidade: 1, tipo: "concreto", estado: "bom" },
          saleiros: { quantidade: 1, tipo: "coberto", estado: "bom" },
          cerca: { tipo: "arame", estado: "bom", comprimento_metros: 100 },
          curral: {
            estado: "bom",
            area_metros: 20,
            possui_balanca: true,
            possui_brete: true,
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/pastos/pasto-1/editar"]}>
        <Routes>
          <Route path="/pastos/:id/editar" element={<PastoEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/Nome do pasto/i)).toHaveValue("Piquete 1"),
    );
    expect(screen.queryByText(/curral/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/brete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/balan[cç]a/i)).not.toBeInTheDocument();
  });

  it("PastoEditar nao reintroduz curral mesmo com registro legado", async () => {
    mockLiveQueriesForPasto(
      makePasto({
        infraestrutura: {
          cochos: { quantidade: 1, tipo: "madeira", estado: "bom" },
          bebedouros: { quantidade: 1, tipo: "concreto", estado: "bom" },
          saleiros: { quantidade: 1, tipo: "coberto", estado: "bom" },
          cerca: { tipo: "arame", estado: "bom", comprimento_metros: 100 },
          curral: {
            estado: "bom",
            area_metros: 20,
            possui_balanca: true,
            possui_brete: true,
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/pastos/pasto-1/editar"]}>
        <Routes>
          <Route path="/pastos/:id/editar" element={<PastoEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/Nome do pasto/i)).toHaveValue("Piquete 1"),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const record = mockedCreateGesture.mock.calls[0]?.[1][0]?.record;
    expect(record.infraestrutura.curral).toBeUndefined();
    expect(record.infraestrutura).toMatchObject({
      cochos: expect.any(Object),
      bebedouros: expect.any(Object),
      saleiros: expect.any(Object),
      cerca: expect.any(Object),
    });
  });

  it("PastoDetalhe ignora curral legado e mostra infraestrutura local do pasto", async () => {
    mockLiveQueriesForPasto(
      makePasto({
        infraestrutura: {
          cochos: { quantidade: 2, tipo: "madeira", capacidade: 4, estado: "bom" },
          bebedouros: { quantidade: 1, tipo: "concreto", capacidade: 500, estado: "bom" },
          saleiros: { quantidade: 3, tipo: "coberto", capacidade: 2, estado: "bom" },
          cerca: { tipo: "arame liso", estado: "regular", comprimento_metros: 120 },
          curral: {
            estado: "bom",
            area_metros: 20,
            possui_balanca: true,
            possui_brete: true,
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/pastos/pasto-1"]}>
        <Routes>
          <Route path="/pastos/:id" element={<PastoDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Cochos")).toBeInTheDocument();
    expect(screen.getByText("Bebedouros")).toBeInTheDocument();
    expect(screen.getByText("Cerca")).toBeInTheDocument();
    expect(screen.getByText("Saleiros")).toBeInTheDocument();
    expect(screen.queryByText(/curral/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/brete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/balan[cç]a/i)).not.toBeInTheDocument();
  });
});

