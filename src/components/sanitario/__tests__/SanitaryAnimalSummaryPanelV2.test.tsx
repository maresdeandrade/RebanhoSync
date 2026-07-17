/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { SanitaryAnimalSummaryPanelV2 } from "@/components/sanitario/SanitaryAnimalSummaryPanelV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryPrecheckAnimalResumoV2 } from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";

const catalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [
    {
      id: "protocol-b19",
      familyCode: "brucelose_b19",
      name: "Brucelose B19",
      scope: "global",
      fazendaId: null,
      speciesScope: {},
      jurisdictionScope: {},
      legalStatus: "manual_only",
      version: 1,
      status: "draft",
      approvalStatus: "draft",
      sourceRefsSnapshot: [],
      metadata: {},
    },
    {
      id: "protocol-aftosa",
      familyCode: "febre_aftosa",
      name: "Febre aftosa",
      scope: "global",
      fazendaId: null,
      speciesScope: {},
      jurisdictionScope: {},
      legalStatus: "bloqueado",
      version: 1,
      status: "retired",
      approvalStatus: "draft",
      sourceRefsSnapshot: [],
      metadata: {},
    },
  ],
  items: [
    {
      id: "item-b19",
      protocolId: "protocol-b19",
      logicalItemKey: "b19_femeas_3_8_meses",
      version: 1,
      itemStatus: "draft",
      actionType: "vacinacao",
      productRequirementKind: "product_class",
      productId: null,
      productClass: "vacina_brucelose_b19",
      productClassGroupId: null,
      eligibilityRule: { species: ["bovino"], sex: "femea" },
      operationalWindowRule: {},
      doseRule: {},
      routeRule: {},
      boosterRule: {},
      speciesAuthorization: {},
      sourceRefsByField: {},
      limitations: [],
      snapshotTemplate: {},
      allowsAgendaAuto: false,
      requiresMvResponsavel: false,
      status: "draft",
    },
    {
      id: "item-aftosa",
      protocolId: "protocol-aftosa",
      logicalItemKey: "fmd_bloqueio_vacinacao_rotina",
      version: 1,
      itemStatus: "bloqueado",
      actionType: "vacinacao",
      productRequirementKind: "none",
      productId: null,
      productClass: null,
      productClassGroupId: null,
      eligibilityRule: { species: ["bovino"] },
      operationalWindowRule: {},
      doseRule: {},
      routeRule: {},
      boosterRule: {},
      speciesAuthorization: {},
      sourceRefsByField: {},
      limitations: [],
      snapshotTemplate: {},
      allowsAgendaAuto: false,
      requiresMvResponsavel: false,
      status: "blocked",
    },
  ],
  productClassGroups: [],
};

const adultFemale: SanitaryPrecheckAnimalResumoV2 = {
  id: "animal-1",
  especie: "bovino",
  sexo: "F",
  nascimento: "2024-01-01",
  categoria: "vaca",
  fazendaId: "farm-1",
};

function renderPanel() {
  const onRegisterEntryHistory = vi.fn();
  render(
    <MemoryRouter>
      <SanitaryAnimalSummaryPanelV2
        animal={adultFemale}
        animalId="animal-1"
        lotId="lot-1"
        catalog={catalog}
        executedHistory={[
          {
            animalId: "animal-1",
            events: [
              {
                eventId: "event-1",
                protocolId: "protocol-clostridial",
                familyCode: "clostridioses",
                itemKey: "clostridial_primovac_dose1",
                productClass: "vacina_clostridial",
                productId: "product-1",
                productName: "Vacina Clostridial",
                doseQuantity: 2,
                doseUnit: "ml",
                route: "subcutanea",
                responsibleName: "mv@example.com",
                stockStatus: "without_movement",
                withdrawalStatus: "without_rule",
                originLabel: "agenda sanitária",
                executedAt: "2026-07-02T12:00:00.000Z",
                source: "event",
              },
            ],
          },
        ]}
        externalDocumentedHistory={[]}
        declaredHistory={[]}
        futureAgenda={[
          {
            id: "agenda-1",
            label: "Vacina brucelose",
            dateLabel: "15/07/2026",
            detailLabel: "Planejamento local",
          },
        ]}
        today="2026-07-10"
        onRegisterEntryHistory={onRegisterEntryHistory}
      />
    </MemoryRouter>,
  );
  return { onRegisterEntryHistory };
}

describe("SanitaryAnimalSummaryPanelV2", () => {
  it("renderiza resumo compacto sem preview manual aberto por padrão", () => {
    renderPanel();

    expect(screen.getByText("Conformidade sanitária")).toBeInTheDocument();
    expect(screen.getByText("Conforme")).toBeInTheDocument();
    expect(screen.getByText("Planejado")).toBeInTheDocument();
    expect(screen.getByText("Pendências principais")).toBeInTheDocument();
    expect(screen.getByText("Histórico sanitário executado")).toBeInTheDocument();
    expect(screen.getByText(/Vacina Clostridial/)).toBeInTheDocument();
    expect(screen.getByText(/origem: agenda sanitária/)).toBeInTheDocument();
    expect(screen.getByText("Histórico de entrada")).toBeInTheDocument();
    expect(screen.getAllByText("Agenda futura").length).toBeGreaterThan(0);
    expect(screen.getByText("Fêmea adulta exige comprovação documental de B19.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir conformidade na Central/i })).toHaveAttribute(
      "href",
      "/protocolos-sanitarios?tab=conformidade&animalId=animal-1&loteId=lot-1",
    );
    expect(screen.queryByText("Preview manual sanitário")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidatas")).not.toBeInTheDocument();
    expect(screen.queryByText("Bloqueadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Não aplicáveis")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Planejar agenda/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes técnicos da pré-checagem/i })).toBeInTheDocument();
  });

  it("mantem histórico anterior acessível por ação principal", async () => {
    const user = userEvent.setup();
    const { onRegisterEntryHistory } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Registrar histórico anterior/i }));

    expect(onRegisterEntryHistory).toHaveBeenCalledTimes(1);
  });

  it("mostra detalhes técnicos somente após abrir o accordion", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByText("Pré-checagem sanitária")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ver detalhes técnicos da pré-checagem/i }));

    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(screen.getByText("Preview manual sanitário")).toBeInTheDocument();
  });

  it("não importa persistência operacional nem fila local", () => {
    const source = readFileSync(
      resolve(__dirname, "../SanitaryAnimalSummaryPanelV2.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/createGesture|queue_ops|event_eventos|insumo_movimentacoes/i);
    expect(source).not.toMatch(/createManualSanitaryAgendaV2/);
  });
});
