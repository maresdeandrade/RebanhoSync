/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { Profiler } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SanitaryAutomaticPlanPanelV2 } from "../SanitaryAutomaticPlanPanelV2";
import { previewSanitaryAutomaticPlanV2 } from "@/lib/sanitario/agenda/sanitaryAutomaticGenerationV2";
import { saveSanitaryAutomationPlanV2, selectSanitaryAutomationRuleV2, SANITARY_AUTOMATION_PLAN_KEY, type SanitaryAutomationPlanV2 } from "@/lib/sanitario/agenda/sanitaryAutomationPlanV2";
import { useSanitaryAutomaticGenerationV2 } from "@/pages/ProtocolosSanitarios/helpers/useSanitaryAutomaticGenerationV2";
import { EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, type SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

vi.mock("@/pages/ProtocolosSanitarios/helpers/useSanitaryAutomaticGenerationV2", () => ({
  sanitaryAutomationTodayV2: () => "2026-10-20",
  useSanitaryAutomaticGenerationV2: vi.fn(() => ({ reevaluate: vi.fn(), message: null, busy: false })),
}));
vi.mock("@/lib/sanitario/agenda/sanitaryAutomaticGenerationV2", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/sanitario/agenda/sanitaryAutomaticGenerationV2")>(),
  previewSanitaryAutomaticPlanV2: vi.fn(() => ({ entries: [], toCreate: 0 })),
}));
vi.mock("@/lib/sanitario/agenda/sanitaryAutomationPlanV2", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/sanitario/agenda/sanitaryAutomationPlanV2")>(),
  saveSanitaryAutomationPlanV2: vi.fn(),
}));

// Synthetic read model: no Auth, remote calls or operational writers.
const protocol = {
  id: "b19", familyCode: "brucelose_b19", name: "B19 teste", scope: "global", fazendaId: null,
  version: 1, status: "active", approvalStatus: "approved", legalStatus: "obrigatorio_norma",
  speciesScope: {}, jurisdictionScope: {}, sourceRefsSnapshot: [], metadata: {},
};
const sources = Object.fromEntries(["eligibility_rule", "operational_window", "product_requirement", "composition", "dose", "route", "species_authorization"].map((field) => [field, [{
  kind: "norma_oficial", title: "Fixture explicitamente aprovada — teste", strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field],
}]]));
const item = {
  id: "b19-item", protocolId: "b19", logicalItemKey: "b19_femeas_3_8_meses", version: 1,
  status: "active", itemStatus: "obrigatorio", actionType: "vacinacao", productRequirementKind: "product_class",
  productId: null, productClass: "vacina_brucelose_b19", productClassGroupId: null,
  eligibilityRule: { species: ["bovino", "bubalino"], sex: "femea" }, operationalWindowRule: {},
  doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: sources,
  limitations: [], snapshotTemplate: {}, allowsAgendaAuto: true, requiresMvResponsavel: true,
};
function sourceFor(count = 20): SanitaryProtocolWindowSourceV2 {
  return {
    farmUf: "MG", catalog: { protocols: [protocol], items: Array.from({ length: count }, (_, i) => ({ ...item, id: `item-${i}` })), productClassGroups: [] },
    animals: [], lots: [], executedHistory: [], executedEvents: [], agendas: [], agendaAnimals: [],
  };
}
function renderPanel(source = sourceFor()) {
  let duration = 0;
  const element = (nextSource: SanitaryProtocolWindowSourceV2, farmId = "farm") => <MemoryRouter>
    <Profiler id="plan" onRender={(_, __, actual) => { duration += actual; }}>
      <SanitaryAutomaticPlanPanelV2 fazendaId={farmId} actorId="producer" source={nextSource} />
    </Profiler>
  </MemoryRouter>;
  const view = render(element(source));
  return { ...view, duration: () => duration, rerenderPanel: (nextSource: SanitaryProtocolWindowSourceV2, farmId: string) => view.rerender(element(nextSource, farmId)) };
}

function withSavedPlan(source = sourceFor(1), overrides: Partial<SanitaryAutomationPlanV2> = {}) {
  const plan: SanitaryAutomationPlanV2 = {
    schemaVersion: 1, revision: 2, enabled: true,
    rules: [selectSanitaryAutomationRuleV2(protocol, source.catalog.items[0])],
    context: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, sanitaryCadence: "annual" },
    confirmedBy: "producer", confirmedAt: "2026-10-19T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z", ...overrides,
  };
  source.farmConfig = { fazenda_id: "farm", uf: "MG", payload: { [SANITARY_AUTOMATION_PLAN_KEY]: plan } } as SanitaryProtocolWindowSourceV2["farmConfig"];
  return source;
}
async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Configurar plano automático"));
  await screen.findByRole("group", { name: "Configuração do plano automático" });
}

describe("formulário de plano automático", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não monta campos nem calcula preview enquanto recolhido, mantendo o motor existente montado", () => {
    const view = renderPanel();
    console.info("SANITARY_PLAN_RENDER", JSON.stringify({
      selects: view.container.querySelectorAll("select").length,
      choices: screen.queryAllByRole("checkbox", { name: /^Automatizar / }).length,
      previewCalls: vi.mocked(previewSanitaryAutomaticPlanV2).mock.calls.length,
      actualDurationMs: Math.round(view.duration() * 100) / 100,
    }));
    expect(screen.getByRole("region", { name: "Plano de geração automática" })).toBeInTheDocument();
    expect(view.container.querySelectorAll("select")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Configuração do plano automático" })).not.toBeInTheDocument();
    expect(previewSanitaryAutomaticPlanV2).not.toHaveBeenCalled();
    expect(useSanitaryAutomaticGenerationV2).toHaveBeenCalled();
    expect(saveSanitaryAutomationPlanV2).not.toHaveBeenCalled();
  });

  it("oferece só regras elegíveis, com um contexto geral e acesso ao catálogo completo", async () => {
    const user = userEvent.setup();
    const source = sourceFor(4);
    source.catalog.items[1] = { ...source.catalog.items[1], allowsAgendaAuto: false };
    source.catalog.items[2] = { ...source.catalog.items[2], status: "draft", itemStatus: "draft" };
    source.catalog.protocols.push({ ...protocol, id: "foreign-protocol", fazendaId: "other-farm", scope: "fazenda" });
    source.catalog.items[3] = { ...source.catalog.items[3], protocolId: "foreign-protocol" };
    const view = renderPanel(source);
    await openForm(user);
    expect(screen.getAllByRole("checkbox", { name: /^Automatizar / })).toHaveLength(1);
    expect(view.container.querySelectorAll("select")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Consultar catálogo sanitário" })).toHaveAttribute("href", "/protocolos-sanitarios/catalogo-v2");
    await user.click(screen.getByRole("checkbox", { name: /^Automatizar / }));
    expect(view.container.querySelectorAll("select")).toHaveLength(5);
    expect(screen.getByText("Usando contexto geral · ajustar esta regra")).toBeInTheDocument();
  });

  it("herda o contexto geral; cria e remove ajuste somente por ação explícita", async () => {
    const user = userEvent.setup();
    renderPanel(withSavedPlan());
    await openForm(user);
    await user.click(screen.getByText("Usando contexto geral · ajustar esta regra"));
    const specificCadence = await screen.findByLabelText(/B19.*Cadência do plano/);
    expect(specificCadence).toHaveValue("annual");
    await user.selectOptions(screen.getByRole("combobox", { name: "Cadência do plano" }), "semiannual");
    expect(specificCadence).toHaveValue("semiannual");
    await user.selectOptions(specificCadence, "annual");
    expect(await screen.findByRole("button", { name: "Usar contexto geral" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Cadência do plano" }), "");
    expect(specificCadence).toHaveValue("annual");
    await user.click(screen.getByRole("button", { name: "Usar contexto geral" }));
    expect(specificCadence).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Usar contexto geral" })).not.toBeInTheDocument();
    expect(saveSanitaryAutomationPlanV2).not.toHaveBeenCalled();
  });

  it("preserva seleções, revisão, contexto específico e rascunho após recolher, salvar e falhar", async () => {
    const user = userEvent.setup();
    const source = withSavedPlan(sourceFor(1), { schemaVersion: 2, ruleContexts: {
      "item-0": { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, management: "rearing" },
    } });
    vi.mocked(saveSanitaryAutomationPlanV2).mockRejectedValueOnce(new Error("Falha local; tente novamente"));
    renderPanel(source);
    await openForm(user);
    await user.selectOptions(screen.getByLabelText("Cadência do plano"), "semiannual");
    await user.click(screen.getByText("Configurar plano automático"));
    await waitFor(() => expect(screen.queryByLabelText("Cadência do plano")).not.toBeInTheDocument());
    await openForm(user);
    expect(screen.getByLabelText("Cadência do plano")).toHaveValue("semiannual");
    expect(screen.getByText("Contexto específico desta regra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar revisão do plano" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Confirmar ativação do plano" }));
    await user.click(screen.getByRole("button", { name: "Salvar revisão do plano" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha local; tente novamente");
    expect(saveSanitaryAutomationPlanV2).toHaveBeenCalledWith(expect.objectContaining({
      fazendaId: "farm", actorId: "producer", enabled: true, confirmed: true, expectedRevision: 2,
      draft: expect.objectContaining({ context: expect.objectContaining({ sanitaryCadence: "semiannual" }),
        ruleContexts: expect.objectContaining({ "item-0": expect.objectContaining({ management: "rearing" }) }),
        rules: [selectSanitaryAutomationRuleV2(protocol, source.catalog.items[0])],
      }),
    }));
    expect(screen.getByLabelText("Cadência do plano")).toHaveValue("semiannual");
    await user.click(screen.getByRole("button", { name: "Salvar revisão do plano" }));
    await waitFor(() => expect(saveSanitaryAutomationPlanV2).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveSanitaryAutomationPlanV2).mock.calls[1][0].draft).toEqual(vi.mocked(saveSanitaryAutomationPlanV2).mock.calls[0][0].draft);
    await user.selectOptions(screen.getByLabelText("Cadência do plano"), "annual");
    expect(screen.getByRole("checkbox", { name: "Confirmar ativação do plano" })).not.toBeChecked();
  });

  it("mantém ajustes de calendário, indicação e contexto programado acessíveis sob demanda", async () => {
    const user = userEvent.setup();
    const source = withSavedPlan();
    source.catalog.items[0].eligibilityRule = { ...item.eligibilityRule, requires_destination_context: true, requires_mv_or_management_context: true };
    source.catalog.items[0].operationalWindowRule = { calendar_months: [5, 7, 9] };
    renderPanel(source);
    await openForm(user);
    expect(screen.queryByLabelText("Data do contexto programado")).not.toBeInTheDocument();
    await user.click(screen.getByText("Usando contexto geral · ajustar esta regra"));
    expect(await screen.findByLabelText("Data do contexto programado")).toBeInTheDocument();
    expect(screen.getByLabelText("Indicação pré-desmama")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Adotar calendário regional/ })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /^Adotar calendário regional/ }));
    expect(screen.getByRole("checkbox", { name: /^Adotar calendário regional/ })).toBeChecked();
    expect(saveSanitaryAutomationPlanV2).not.toHaveBeenCalled();
  });

  it("recolhe e troca o rascunho ao mudar de fazenda, sem transportar seleções", async () => {
    const user = userEvent.setup();
    const view = renderPanel(withSavedPlan());
    await openForm(user);
    expect(screen.getByRole("checkbox", { name: /^Automatizar / })).toBeChecked();
    view.rerenderPanel(sourceFor(1), "other");
    expect(screen.queryByLabelText("Cadência do plano")).not.toBeInTheDocument();
    await openForm(user);
    expect(screen.getByRole("checkbox", { name: /^Automatizar / })).not.toBeChecked();
    expect(screen.getByLabelText("Cadência do plano")).toHaveValue("");
    expect(saveSanitaryAutomationPlanV2).not.toHaveBeenCalled();
  });

  it.each(["blocked", "version"])("não descarta seleção salva indisponível (%s) nem a substitui silenciosamente", async (reason) => {
    const user = userEvent.setup();
    const source = withSavedPlan();
    source.catalog.items[0] = { ...source.catalog.items[0], ...(reason === "blocked" ? { allowsAgendaAuto: false } : { version: 3 }) };
    renderPanel(source);
    await openForm(user);
    expect(screen.getByRole("alert")).toHaveTextContent("1 regra(s) do plano salvo");
    await user.click(screen.getByRole("checkbox", { name: "Confirmar ativação do plano" }));
    expect(screen.getByRole("button", { name: "Salvar revisão do plano" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desativar plano automático" })).toBeEnabled();
    await user.click(screen.getByText("Revisar seleções indisponíveis"));
    await user.click(screen.getByRole("button", { name: "Remover seleção" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveSanitaryAutomationPlanV2).not.toHaveBeenCalled();
  });
});
