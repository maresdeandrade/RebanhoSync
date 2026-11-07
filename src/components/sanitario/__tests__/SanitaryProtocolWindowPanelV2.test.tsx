/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SanitaryProtocolWindowPanelV2 } from "@/components/sanitario/SanitaryProtocolWindowPanelV2";
import { SanitaryContextualNeedsPanelV2 } from "@/components/sanitario/SanitaryContextualNeedsPanelV2";
import type { Animal, Lote } from "@/lib/offline/types";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

const animal = (id: string, sex: "M" | "F", birth: string): Animal => ({
  id,
  fazenda_id: "farm-1",
  identificacao: id === "female" ? "Fêmea 101" : id === "male" ? "Macho 202" : "Fêmea 303",
  nome: null,
  sexo: sex,
  status: "ativo",
  lote_id: "lot-1",
  data_nascimento: birth,
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  rfid: null,
  especie: "bovino",
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "client",
  client_op_id: `op-${id}`,
  client_tx_id: null,
  client_recorded_at: "2026-01-01",
  server_received_at: "2026-01-01",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  deleted_at: null,
});

const source: SanitaryProtocolWindowSourceV2 = {
  farmUf: "MG",
  catalog: {
    protocols: [
      { id: "protocol-b19", familyCode: "brucelose_b19", name: "Brucelose B19", scope: "global", fazendaId: null, speciesScope: {}, jurisdictionScope: {}, legalStatus: "manual_only", version: 1, status: "active", approvalStatus: "approved", sourceRefsSnapshot: [], metadata: {} },
      { id: "protocol-raiva", familyCode: "raiva_herbivoros", name: "Raiva dos herbívoros", scope: "global", fazendaId: null, speciesScope: {}, jurisdictionScope: {}, legalStatus: "manual_only", version: 1, status: "active", approvalStatus: "approved", sourceRefsSnapshot: [], metadata: {} },
    ],
    items: [
      { id: "item-b19", protocolId: "protocol-b19", logicalItemKey: "b19_femeas_3_8_meses", version: 1, itemStatus: "recomendado", actionType: "vacinacao", productRequirementKind: "product_class", productId: null, productClass: "vacina_brucelose_b19", productClassGroupId: null, eligibilityRule: { species: ["bovino", "bubalino"], sex: "femea" }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, allowsAgendaAuto: false, requiresMvResponsavel: false, status: "active" },
      { id: "item-raiva", protocolId: "protocol-raiva", logicalItemKey: "raiva_primovac_dose1", version: 1, itemStatus: "recomendado", actionType: "vacinacao", productRequirementKind: "product_class", productId: null, productClass: "vacina_raiva_herbivoros", productClassGroupId: null, eligibilityRule: { species: ["bovino", "bubalino"], requires_risk_area_overlay: true }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, allowsAgendaAuto: false, requiresMvResponsavel: false, status: "active" },
    ],
    productClassGroups: [],
  },
  animals: [
    animal("female", "F", "2026-03-01"),
    animal("male", "M", "2026-03-01"),
    animal("overdue", "F", "2025-09-01"),
  ],
  lots: [{ id: "lot-1", fazenda_id: "farm-1", nome: "Bezerros", deleted_at: null } as Lote],
  executedHistory: [],
  agendas: [],
  agendaAnimals: [],
};

describe("SanitaryProtocolWindowPanelV2", () => {
  it("descobre necessidades sem protocolo e abre revisão apenas para planejáveis", async () => {
    const onPlan = vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><SanitaryContextualNeedsPanelV2 source={source} onPlan={onPlan} initialAnimalId="female" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Data de avaliação das necessidades"), { target: { value: "2026-07-04" } });
    expect(screen.queryByLabelText("Selecionar protocolo")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Brucelose B19/ })).toHaveTextContent("Necessidade identificada");
    expect(screen.getByRole("article", { name: /Raiva dos herbívoros/ })).toHaveTextContent("Informação insuficiente");
    expect(screen.getAllByRole("button", { name: "Planejar manejo" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Planejar manejo" }));
    expect(screen.queryByLabelText("Filtrar por lote")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtro", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Área de risco para raiva")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cadência sanitária")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Selecionar Fêmea 101"));
    fireEvent.click(screen.getByRole("button", { name: "Planejar agenda para selecionados" }));
    expect(onPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e gerar Agenda" }));
    await waitFor(() => expect(onPlan).toHaveBeenCalledTimes(1));
    expect(onPlan.mock.calls[0][0].map((row: { animalId: string }) => row.animalId)).toEqual(["female"]);
  });

  it("invalida alvo, contexto e revisão ao trocar fazenda", () => {
    const props = { onPlan: vi.fn(), initialAnimalId: "female" };
    const { rerender } = render(<MemoryRouter><SanitaryContextualNeedsPanelV2 {...props} source={{ ...source, fazendaId: "farm-1" }} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Data de avaliação das necessidades"), { target: { value: "2026-07-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Planejar manejo" }));
    fireEvent.click(screen.getByLabelText("Selecionar Fêmea 101"));
    fireEvent.click(screen.getByRole("button", { name: "Planejar agenda para selecionados" }));
    rerender(<MemoryRouter><SanitaryContextualNeedsPanelV2 {...props} initialAnimalId={null} source={{ ...source, fazendaId: "farm-2", animals: [], lots: [] }} /></MemoryRouter>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Animal das necessidades")).toHaveValue("");
  });

  it("mantém consulta do lote offline e não promove regra sem aprovação", () => {
    const unapproved = { ...source, catalog: { ...source.catalog, protocols: source.catalog.protocols.map(protocol => ({ ...protocol, approvalStatus: "draft" })) } };
    const onPlan = vi.fn();
    render(<MemoryRouter><SanitaryContextualNeedsPanelV2 source={unapproved} onPlan={onPlan} initialLotId="lot-1" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Data de avaliação das necessidades"), { target: { value: "2026-07-04" } });
    const b19 = screen.getByRole("article", { name: /Brucelose B19/ });
    expect(b19).toHaveTextContent("Fêmea 101");
    expect(b19).toHaveTextContent("Macho 202");
    expect(screen.queryByRole("button", { name: "Planejar manejo" })).not.toBeInTheDocument();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(screen.getByText(/Offline: consulta local disponível/)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Brucelose B19/ })).toBeInTheDocument();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent(window, new Event("online"));
    expect(screen.queryByText(/Offline: consulta/)).not.toBeInTheDocument();
    fireEvent.click(within(b19).getByRole("button", { name: "Consultar limitações e complementos" }));
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Planejar agenda para selecionados" })).toBeDisabled();
    expect(onPlan).not.toHaveBeenCalled();
  });

  it("não solicita programação pré-parto já resolvida por Eventos e fonte técnica", () => {
    const known: SanitaryProtocolWindowSourceV2 = {
      ...source, fazendaId: "farm-1", animals: [animal("female", "F", "2022-01-01")],
      catalog: { ...source.catalog, protocols: [{ ...source.catalog.protocols[0], id: "prepartum", familyCode: "matrizes_pre_parto", name: "Avaliação pré-parto" }], items: [{
        ...source.catalog.items[0], id: "prepartum-item", protocolId: "prepartum", logicalItemKey: "matrizes_pre_parto_antiparasitario",
        actionType: "manejo_sanitario", productRequirementKind: "none", productClass: null,
        eligibilityRule: { species: ["bovino"], sex: "femea", requires_pregnancy_or_peripartum_context: true },
        operationalWindowRule: { anchor: "parturition", min_offset_days: -60, max_offset_days: -20 },
        sourceRefsByField: { operational_window: [{ kind: "mv_responsavel", strength: "forte", evidenceStatus: "SIM_BULA", fieldKeys: ["operational_window"], title: "Fonte técnica sintética" }] },
      }] },
      reproductiveEvents: [
        { id: "service", animal_id: "female", fazenda_id: "farm-1", occurred_at: "2026-01-01", deleted_at: null, details: { tipo: "IA", payload: { schema_version: 1 } } },
        { id: "diagnosis", animal_id: "female", fazenda_id: "farm-1", occurred_at: "2026-02-01", deleted_at: null, details: { tipo: "diagnostico", payload: { schema_version: 1, resultado: "positivo", episode_evento_id: "service", data_prevista_parto: "2026-08-10" } } },
      ],
    };
    const { rerender } = render(<MemoryRouter><SanitaryContextualNeedsPanelV2 source={known} onPlan={vi.fn()} initialAnimalId="female" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Data de avaliação das necessidades"), { target: { value: "2026-07-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Planejar manejo" }));
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeEnabled();
    expect(screen.queryByLabelText("Data do contexto programado")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Referência do contexto programado")).not.toBeInTheDocument();
    expect(screen.getByText(/Gestação e DPP dentro da janela versionada/)).toBeInTheDocument();
    rerender(<MemoryRouter><SanitaryContextualNeedsPanelV2 source={{ ...known, reproductiveEvents: [] }} onPlan={vi.fn()} initialAnimalId="female" /></MemoryRouter>);
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeDisabled();
    expect(screen.queryByLabelText("Animais do contexto programado")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data do contexto programado"), { target: { value: "2026-07-04" } });
    fireEvent.change(screen.getByLabelText("Referência do contexto programado"), { target: { value: "Avaliação técnica referenciada" } });
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeEnabled();
    expect(screen.getByText(/Avaliação genérica programada; gestação e janela técnica ainda não comprovadas/)).toBeInTheDocument();
  });
  it("seleção de geração condicional exige autorização individual sem promover catálogo", () => {
    render(<MemoryRouter><SanitaryProtocolWindowPanelV2 source={source} onPlan={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Selecionar protocolo"), { target: { value: "protocol-b19" } });
    fireEvent.change(screen.getByLabelText("Selecionar item do protocolo"), { target: { value: "item-b19" } });
    fireEvent.change(screen.getByLabelText("Data de avaliação"), { target: { value: "2026-07-04" } });
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Geração de Agenda"), { target: { value: "automatic" } });
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeDisabled();
    expect(source.catalog.items[0].allowsAgendaAuto).toBe(false);
  });
  it("seleciona protocolo/item, calcula animais e planeja seleção múltipla", async () => {
    const onPlan = vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><SanitaryProtocolWindowPanelV2 source={source} onPlan={onPlan} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Selecionar protocolo"), { target: { value: "protocol-b19" } });
    expect(screen.getByRole("option", { name: "B19 — fêmeas de 3 a 8 meses" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Selecionar item do protocolo"), { target: { value: "item-b19" } });
    fireEvent.change(screen.getByLabelText("Data de avaliação"), { target: { value: "2026-07-04" } });

    expect(screen.getByText("Fêmea 101")).toBeInTheDocument();
    expect(screen.getByText("Macho 202")).toBeInTheDocument();
    expect(screen.getByLabelText("Selecionar Macho 202")).toBeDisabled();
    expect(screen.getByLabelText("Selecionar Fêmea 303")).toBeDisabled();
    expect(screen.getByText("Pendência documental")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Selecionar Fêmea 101"));
    fireEvent.click(screen.getByRole("button", { name: "Planejar agenda para selecionados" }));

    expect(onPlan).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const technicalSummary = screen.getByText(/Cuidados técnicos do planejamento/);
    expect(technicalSummary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(technicalSummary);
    expect(technicalSummary.closest("details")).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e gerar Agenda" }));
    await waitFor(() => expect(onPlan).toHaveBeenCalled());
    expect(onPlan.mock.calls[0][0]).toHaveLength(1);
    expect(onPlan.mock.calls[0][2]).toEqual({
      rabiesRiskArea: null,
      sanitaryCadence: null,
      reproductiveContext: null,
      management: null,
    });
    expect(document.body.textContent).not.toMatch(/protocol-b19|item-b19|b19_femeas_3_8_meses/);
  });

  it("recalcula a janela quando o contexto operacional muda", () => {
    render(<MemoryRouter><SanitaryProtocolWindowPanelV2 source={source} onPlan={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("combobox", { name: "Contexto reprodutivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Recria" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Selecionar protocolo"), { target: { value: "protocol-raiva" } });
    fireEvent.change(screen.getByLabelText("Selecionar item do protocolo"), { target: { value: "item-raiva" } });
    const animalCheckbox = screen.getByLabelText("Selecionar Fêmea 101");
    expect(animalCheckbox).toBeDisabled();
    expect(screen.getAllByText("Dados insuficientes").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Área de risco para raiva"), { target: { value: "yes" } });

    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeEnabled();
    expect(screen.getByText(/raiva em área de risco/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/risk_area|rabiesRiskArea|protocol-raiva/);
  });

  it("filtra por card, seleciona somente elegíveis visíveis e mantém seleção ao ordenar", async () => {
    const onPlan = vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><SanitaryProtocolWindowPanelV2 source={source} onPlan={onPlan} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Selecionar protocolo"), { target: { value: "protocol-b19" } });
    fireEvent.change(screen.getByLabelText("Selecionar item do protocolo"), { target: { value: "item-b19" } });
    fireEvent.change(screen.getByLabelText("Data de avaliação"), { target: { value: "2026-07-04" } });

    fireEvent.click(screen.getByRole("button", { name: /Em janela/ }));
    expect(screen.getByText("Filtro ativo: Em janela")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos os elegíveis visíveis" }));
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeChecked();
    expect(screen.queryByText("Macho 202")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Animal/ }));
    expect(screen.getByLabelText("Selecionar Fêmea 101")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(screen.getByText("Macho 202")).toBeInTheDocument();
  });
  it("mantém a revisão após erro e permite retry explícito sem perder seleção", async () => {
    const onPlan = vi.fn().mockRejectedValueOnce(new Error("Seleção desatualizada")).mockResolvedValueOnce(undefined);
    render(<MemoryRouter><SanitaryProtocolWindowPanelV2 source={source} onPlan={onPlan} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Selecionar protocolo"), { target: { value: "protocol-b19" } });
    fireEvent.change(screen.getByLabelText("Selecionar item do protocolo"), { target: { value: "item-b19" } });
    fireEvent.change(screen.getByLabelText("Data de avaliação"), { target: { value: "2026-07-04" } });
    fireEvent.click(screen.getByLabelText("Selecionar Fêmea 101"));
    fireEvent.click(screen.getByRole("button", { name: "Planejar agenda para selecionados" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e gerar Agenda" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Seleção desatualizada"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e gerar Agenda" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onPlan).toHaveBeenCalledTimes(2);
  });

});
