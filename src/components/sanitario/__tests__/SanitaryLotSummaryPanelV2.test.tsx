/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SanitaryLotSummaryPanelV2 } from "@/components/sanitario/SanitaryLotSummaryPanelV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type {
  SanitaryPrecheckAnimalResumoV2,
  SanitaryPrecheckLoteResumoV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";

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
  ],
  productClassGroups: [],
};

const lote: SanitaryPrecheckLoteResumoV2 = {
  id: "lote-1",
  fazendaId: "farm-1",
  animalIds: ["animal-1"],
  categoria: "recria",
};

const animals: SanitaryPrecheckAnimalResumoV2[] = [
  {
    id: "animal-1",
    especie: "bovino",
    sexo: "F",
    nascimento: "2024-01-01",
    categoria: "vaca",
    fazendaId: "farm-1",
  },
];

function renderPanel() {
  render(
    <MemoryRouter>
      <SanitaryLotSummaryPanelV2
        lote={lote}
        loteId="lote-1"
        loteLabel="Lote recria"
        animals={animals}
        catalog={catalog}
        executedHistory={[]}
        futureAgenda={[
          {
            id: "agenda-1",
            label: "Brucelose B19 · B19 — fêmeas de 3 a 8 meses",
            dateLabel: "15/07/2026",
            detailLabel: "Planejamento do lote",
          },
        ]}
        today="2026-07-10"
      />
    </MemoryRouter>,
  );
}

describe("SanitaryLotSummaryPanelV2", () => {
  it("renderiza resumo compacto do lote sem preview manual aberto por padrão", () => {
    renderPanel();

    expect(screen.getByText("Conformidade sanitária do lote")).toBeInTheDocument();
    expect(screen.getByText("Animais conformes")).toBeInTheDocument();
    expect(screen.getByText("Animais com pendência")).toBeInTheDocument();
    expect(screen.getByText("Animais com agenda futura")).toBeInTheDocument();
    expect(screen.getByText("Pendências principais")).toBeInTheDocument();
    expect(screen.getAllByText("Agenda futura").length).toBeGreaterThan(0);
    expect(screen.getByText("Fêmea adulta exige comprovação documental de B19.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Abrir conformidade na Central filtrada para este lote/i }),
    ).toHaveAttribute("href", "/protocolos-sanitarios?tab=conformidade&loteId=lote-1");
    expect(screen.queryByText("Preview manual sanitário")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidatas")).not.toBeInTheDocument();
    expect(screen.queryByText("Bloqueadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Não aplicáveis")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Planejar agenda/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver detalhes técnicos da pré-checagem/i })).toBeInTheDocument();
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
      resolve(__dirname, "../SanitaryLotSummaryPanelV2.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/createGesture|queue_ops|event_eventos|insumo_movimentacoes/i);
    expect(source).not.toMatch(/createManualSanitaryAgendaV2/);
  });
});
