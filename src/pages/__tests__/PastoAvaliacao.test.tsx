/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { createGesture } from "@/lib/offline/ops";
import type {
  Evento,
  EventoPastoAvaliacao,
  Pasto,
  PastoOcupacao,
} from "@/lib/offline/types";
import PastoDetalhe from "@/pages/PastoDetalhe";

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
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");

  return {
    Dialog: ({
      open,
      children,
    }: {
      open?: boolean;
      children: React.ReactNode;
    }) => (open ? React.createElement("div", null, children) : null),
    DialogContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { role: "dialog" }, children),
    DialogFooter: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    DialogHeader: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    DialogTitle: ({ children }: { children: React.ReactNode }) =>
      React.createElement("h2", null, children),
  };
});
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
    tipo_area: "piquete",
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

function makeOcupacao(overrides: Partial<PastoOcupacao> = {}): PastoOcupacao {
  return {
    id: "ocupacao-1",
    fazenda_id: "farm-1",
    pasto_id: "pasto-1",
    lote_id: "lote-1",
    entrada_em: "2026-05-08T08:00:00.000Z",
    saida_em: null,
    entrada_evento_id: "evento-mov-1",
    saida_evento_id: null,
    animais_inicio: 10,
    animais_fim: null,
    ua_inicio: null,
    ua_fim: null,
    status: "aberta",
    payload: {},
    client_id: "client-1",
    client_op_id: "op-ocupacao",
    client_tx_id: null,
    client_recorded_at: "2026-05-08T08:00:00.000Z",
    server_received_at: "2026-05-08T08:00:00.000Z",
    created_at: "2026-05-08T08:00:00.000Z",
    updated_at: "2026-05-08T08:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeAvaliacao(): {
  avaliacao: EventoPastoAvaliacao;
  evento: Evento;
} {
  const evento: Evento = {
    id: "evento-avaliacao-1",
    fazenda_id: "farm-1",
    dominio: "pastagem",
    occurred_at: "2026-05-08T10:00:00.000Z",
    animal_id: null,
    lote_id: "lote-1",
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-evento",
    client_tx_id: null,
    client_recorded_at: "2026-05-08T10:00:00.000Z",
    server_received_at: "2026-05-08T10:00:00.000Z",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z",
    deleted_at: null,
  };
  const avaliacao: EventoPastoAvaliacao = {
    evento_id: evento.id,
    fazenda_id: "farm-1",
    pasto_id: "pasto-1",
    lote_id: "lote-1",
    ocupacao_id: "ocupacao-1",
    momento: "ronda",
    altura_cm: 32,
    cobertura_solo: "media",
    invasoras_nivel: "leve",
    ecc_lote_medio: 3.2,
    ecc_escala: "1_5",
    fezes_score: "liquidas",
    agua_status: "sujo",
    suplemento_tipo: "mineral",
    suplemento_quantidade: 1,
    suplemento_unidade: "kg",
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-avaliacao",
    client_tx_id: null,
    client_recorded_at: "2026-05-08T10:00:00.000Z",
    server_received_at: "2026-05-08T10:00:00.000Z",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z",
    deleted_at: null,
  };

  return { avaliacao, evento };
}

function mockPastoDetalheQueries({
  pasto = makePasto(),
  ocupacao = null,
  avaliacoes = [],
}: {
  pasto?: Pasto | null;
  ocupacao?: PastoOcupacao | null;
  avaliacoes?: Array<{ avaliacao: EventoPastoAvaliacao; evento: Evento }>;
} = {}) {
  vi.mocked(useLiveQuery).mockImplementation(((query) => {
    const source = typeof query === "function" ? query.toString() : "";
    if (source.includes("db.state_pastos.get")) return pasto;
    if (source.includes("state_pasto_ocupacoes")) return ocupacao ?? undefined;
    if (source.includes("event_eventos_pasto_avaliacao")) return avaliacoes;
    if (source.includes(".count()")) return 0;
    if (source.includes("db.state_lotes.where")) return [];
    return [];
  }) as typeof useLiveQuery);
}

function renderPastoDetalhe() {
  render(
    <MemoryRouter initialEntries={["/pastos/pasto-1"]}>
      <Routes>
        <Route path="/pastos/:id" element={<PastoDetalhe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PastoDetalhe avaliacao/ronda", () => {
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPastoDetalheQueries();
  });

  it("renderiza botao Registrar ronda", () => {
    renderPastoDetalhe();

    expect(
      screen.getByRole("button", { name: /Registrar ronda/i }),
    ).toBeInTheDocument();
  });

  it("mostra ultima avaliacao quando existe", () => {
    mockPastoDetalheQueries({ avaliacoes: [makeAvaliacao()] });

    renderPastoDetalhe();

    expect(screen.getByText(/Ultima ronda/i)).toBeInTheDocument();
    expect(screen.getByText(/32 cm/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura: media/i)).toBeInTheDocument();
    expect(screen.getByText(/Agua: sujo/i)).toBeInTheDocument();
    expect(screen.getByText(/ECC: 3.2/i)).toBeInTheDocument();
    expect(screen.getByText(/Fezes: liquidas/i)).toBeInTheDocument();
  });

  it("registro de ronda chama createGesture com evento e detalhe", async () => {
    mockPastoDetalheQueries({ ocupacao: makeOcupacao() });

    renderPastoDetalhe();

    fireEvent.click(screen.getByRole("button", { name: /Registrar ronda/i }));
    fireEvent.change(screen.getByLabelText(/Altura do capim/i), {
      target: { value: "31" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Cobertura do solo" }), {
      target: { value: "excelente" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Status da agua" }), {
      target: { value: "limpo" },
    });
    fireEvent.change(screen.getByLabelText(/ECC medio/i), {
      target: { value: "3.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ronda/i }));

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops.map((op) => op.table)).toEqual([
      "eventos",
      "eventos_pasto_avaliacao",
    ]);
    expect(ops[0].record).toMatchObject({
      dominio: "pastagem",
      animal_id: null,
      lote_id: "lote-1",
    });
    expect(ops[1].record).toMatchObject({
      pasto_id: "pasto-1",
      lote_id: "lote-1",
      ocupacao_id: "ocupacao-1",
      momento: "ronda",
      altura_cm: 31,
      cobertura_solo: "excelente",
      agua_status: "limpo",
      ecc_lote_medio: 3.5,
    });
    expect(
      ops.filter((op) =>
        ["pastos", "lotes", "pasto_ocupacoes"].includes(op.table),
      ),
    ).toHaveLength(0);
  });

  it("sem ocupacao aberta ainda permite avaliacao com lote_id null", async () => {
    mockPastoDetalheQueries({ ocupacao: null });

    renderPastoDetalhe();

    fireEvent.click(screen.getByRole("button", { name: /Registrar ronda/i }));
    fireEvent.change(screen.getByLabelText(/Altura do capim/i), {
      target: { value: "29" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ronda/i }));

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0].record.lote_id).toBeNull();
    expect(ops[1].record.lote_id).toBeNull();
    expect(ops[1].record.ocupacao_id).toBeNull();
  });
});
