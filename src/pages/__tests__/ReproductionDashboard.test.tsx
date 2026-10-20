/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { buildReproductionDashboard } from "@/lib/reproduction/dashboard";
import type { ReproEventJoined } from "@/lib/reproduction/selectors";
import type { Animal } from "@/lib/offline/types";
import ReproductionDashboard from "@/pages/ReproductionDashboard";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    activeFarmId: "farm-1",
    farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
  }),
}));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));

function matrix(id: string): Animal {
  return {
    id,
    identificacao: id,
    fazenda_id: "farm-1",
    sexo: "F",
    especie: "bovino",
    status: "ativo",
    nome: null,
    lote_id: null,
    data_nascimento: "2023-01-01",
    deleted_at: null,
    payload: { lifecycle: { estagio_vida: "adulta" } },
  } as Animal;
}

function show(
  animals = [matrix("M-ESTAVEL")],
  events: ReproEventJoined[] = [],
) {
  const dashboard = buildReproductionDashboard({
    animals,
    lotes: [],
    events,
    now: new Date("2026-10-20T12:00:00Z"),
  });
  vi.mocked(useLiveQuery).mockReturnValue({
    dashboard,
    events,
    eligibleAnimals: animals,
  });
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ReproductionDashboard />
    </MemoryRouter>,
  );
  return dashboard;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("UX13 — apresentacao inicial das matrizes", () => {
  it("mostra matrizes elegiveis mesmo sem atencao e mantem a Agenda visivel", async () => {
    const dashboard = show();
    expect(dashboard.totals.atencao).toBe(0);
    expect(
      await screen.findByRole("button", { name: /^M-ESTAVEL / }),
    ).toBeVisible();
    expect(screen.getByText("1 em exibicao")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Cobertura / IA", exact: true })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Nenhuma matriz encontrada"),
    ).not.toBeInTheDocument();
  });

  it("distingue filtro vazio de ausencia de matrizes e permite ver todas", async () => {
    const user = userEvent.setup();
    show();
    await user.click(
      screen.getByRole("button", { name: /Diagnosticos pendentes/ }),
    );
    expect(
      screen.getByText("Nenhuma matriz corresponde aos filtros"),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Importar animais" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Ver todas as matrizes" }),
    );
    expect(screen.getByRole("button", { name: /^M-ESTAVEL / })).toBeVisible();
  });

  it("limpa tambem a busca ao pedir todos os registros", async () => {
    const user = userEvent.setup();
    show();
    const search = screen.getByPlaceholderText(
      "Buscar por identificacao, nome ou lote",
    );
    await user.type(search, "sem-correspondencia");
    expect(
      screen.getByText("Nenhuma matriz corresponde aos filtros"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Ver todas as matrizes" }),
    );
    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: /^M-ESTAVEL / })).toBeVisible();
  });

  it("mantem o vazio real com orientacao de cadastro", () => {
    show([]);
    expect(
      screen.getByText("Nenhuma matriz elegível cadastrada"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Importar animais" }),
    ).toHaveAttribute("href", "/animais/importar");
    expect(
      screen.queryByRole("button", { name: "Ver todas as matrizes" }),
    ).not.toBeInTheDocument();
  });

  it("preserva prioridade de atencao, filtro, selecao, Agenda e historico", async () => {
    const user = userEvent.setup();
    const event = {
      id: "event-ia",
      animal_id: "M-ATENCAO",
      fazenda_id: "farm-1",
      dominio: "reproducao",
      occurred_at: "2026-08-01T12:00:00Z",
      deleted_at: null,
      observacoes: null,
      payload: {},
      details: { tipo: "IA", macho_id: null, payload: {} },
    } as ReproEventJoined;
    const dashboard = show([matrix("M-ESTAVEL"), matrix("M-ATENCAO")], [event]);
    expect(dashboard.totals.atencao).toBe(1);
    expect(
      screen.getAllByRole("button", { name: /^M-(ESTAVEL|ATENCAO) / }),
    ).toHaveLength(2);
    const timeline = screen
      .getByText("Timeline da matriz em foco")
      .closest('[class*="rounded-xl"]')!;
    expect(
      await within(timeline as HTMLElement).findByText("M-ATENCAO"),
    ).toBeVisible();
    expect(
      within(timeline as HTMLElement).getByText("Inseminacao artificial"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^M-ESTAVEL / }));
    expect(
      within(timeline as HTMLElement).getByText("M-ESTAVEL"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Diagnosticos pendentes/ }),
    );
    expect(
      screen.queryByRole("button", { name: /^M-ESTAVEL / }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^M-ATENCAO / })).toBeVisible();
    const agenda = screen
      .getByText("Agenda reprodutiva automatica")
      .closest('[class*="rounded-xl"]')!;
    expect(within(agenda as HTMLElement).getByText("Diagnostico previsto")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Registrar diagnostico" }).length,
    ).toBeGreaterThan(0);
  });
});
