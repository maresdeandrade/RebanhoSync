/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SanitaryProtocolWindowPanelV2 } from "@/components/sanitario/SanitaryProtocolWindowPanelV2";
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
  catalog: {
    protocols: [
      { id: "protocol-b19", familyCode: "brucelose_b19", name: "Brucelose B19", scope: "global", fazendaId: null, speciesScope: {}, jurisdictionScope: {}, legalStatus: "manual_only", version: 1, status: "draft", approvalStatus: "draft", sourceRefsSnapshot: [], metadata: {} },
      { id: "protocol-raiva", familyCode: "raiva_herbivoros", name: "Raiva dos herbívoros", scope: "global", fazendaId: null, speciesScope: {}, jurisdictionScope: {}, legalStatus: "manual_only", version: 1, status: "draft", approvalStatus: "draft", sourceRefsSnapshot: [], metadata: {} },
    ],
    items: [
      { id: "item-b19", protocolId: "protocol-b19", logicalItemKey: "b19_femeas_3_8_meses", version: 1, itemStatus: "draft", actionType: "vacinacao", productRequirementKind: "product_class", productId: null, productClass: "vacina_brucelose_b19", productClassGroupId: null, eligibilityRule: { species: ["bovino", "bubalino"], sex: "femea" }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, allowsAgendaAuto: false, requiresMvResponsavel: false, status: "draft" },
      { id: "item-raiva", protocolId: "protocol-raiva", logicalItemKey: "raiva_primovac_dose1", version: 1, itemStatus: "draft", actionType: "vacinacao", productRequirementKind: "product_class", productId: null, productClass: "vacina_raiva_herbivoros", productClassGroupId: null, eligibilityRule: { species: ["bovino", "bubalino"], requires_risk_area_overlay: true }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, allowsAgendaAuto: false, requiresMvResponsavel: false, status: "draft" },
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
});
