/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SanitaryPrecheckPanelV2 } from "@/components/sanitario/SanitaryPrecheckPanelV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryPrecheckAnimalResumoV2 } from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";

const protocol = (familyCode: string, overrides: JsonRecord = {}): JsonRecord => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name:
    familyCode === "brucelose_b19"
      ? "Brucelose B19"
      : familyCode === "febre_aftosa"
        ? "Febre aftosa"
        : familyCode === "raiva_herbivoros"
          ? "Raiva dos herbivoros"
          : familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: { species: ["bovino", "bubalino"] },
  jurisdiction_scope: { country: "BR", legal_scope: "nacional" },
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  approval_status: "draft",
  source_refs_snapshot: [],
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
  ...overrides,
});

const item = (
  protocolId: string,
  logicalItemKey: string,
  overrides: JsonRecord = {},
): JsonRecord => ({
  id: `item-${logicalItemKey}`,
  protocol_id: protocolId,
  logical_item_key: logicalItemKey,
  version: 1,
  item_status: "draft",
  action_type: "orientacao",
  product_requirement_kind: "none",
  product_id: null,
  product_class: null,
  product_class_group_id: null,
  eligibility_rule: {},
  operational_window_rule: {},
  dose_rule: {},
  route_rule: {},
  booster_rule: {},
  species_authorization: {},
  source_refs_by_field: {},
  limitations: [],
  snapshot_template: {},
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
  ...overrides,
});

function buildCatalog(): SanitaryProtocolCatalogReadModelV2 {
  return {
    protocols: [
      protocol("brucelose_b19", { legal_status: "obrigatorio_norma" }),
      protocol("febre_aftosa", {
        legal_status: "bloqueado",
        status: "retired",
      }),
      protocol("raiva_herbivoros"),
    ].map(adaptSanitaryProtocolV2Row),
    items: [
      item("protocol-brucelose_b19", "b19_femeas_3_8_meses", {
        item_status: "obrigatorio",
        action_type: "vacinacao",
        product_requirement_kind: "product_class",
        product_class: "vacina_brucelose_b19",
        eligibility_rule: {
          species: ["bovino", "bubalino"],
          sex: "femea",
          age_min_months: 3,
          age_max_months: 8,
        },
      }),
      item("protocol-febre_aftosa", "fmd_bloqueio_vacinacao_rotina", {
        item_status: "bloqueado",
      }),
      item("protocol-raiva_herbivoros", "raiva_primovac_dose1", {
        item_status: "condicional",
        action_type: "vacinacao",
        product_requirement_kind: "product_class",
        product_class: "vacina_raiva_herbivoros",
        eligibility_rule: {
          species: ["bovino", "bubalino"],
          requires_risk_area_overlay: true,
        },
      }),
    ].map(adaptSanitaryProtocolItemV2Row),
    productClassGroups: [],
  };
}

const baseAnimal: SanitaryPrecheckAnimalResumoV2 = {
  id: "animal-1",
  especie: "bovino",
  sexo: "femea",
  nascimento: "2026-01-01",
  categoria: "recria",
  fazendaId: "farm-1",
};

function renderPanel(
  animal: SanitaryPrecheckAnimalResumoV2 | null,
  catalog = buildCatalog(),
) {
  return render(
    <MemoryRouter>
      <SanitaryPrecheckPanelV2
        animal={animal}
        catalog={catalog}
        today="2026-05-01"
      />
    </MemoryRouter>,
  );
}

function renderLotPanel(
  animals: SanitaryPrecheckAnimalResumoV2[] | null,
  catalog = buildCatalog(),
) {
  return render(
    <MemoryRouter>
      <SanitaryPrecheckPanelV2
        scope="lote"
        lote={{
          id: "lote-1",
          fazendaId: "farm-1",
          animalIds: animals?.map((animal) => animal.id) ?? [],
          categoria: "recria",
        }}
        animals={animals}
        catalog={catalog}
        today="2026-05-01"
      />
    </MemoryRouter>,
  );
}

describe("SanitaryPrecheckPanelV2", () => {
  it("renderiza com catalogo e animal usando status em portugues", () => {
    renderPanel(baseAnimal);

    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Consulta baseada no catálogo sanitário v2 local. Não cria agenda nem evento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Brucelose B19 · B19 — fêmeas de 3 a 8 meses"))
      .toBeInTheDocument();
    expect(screen.getByText("Em janela")).toBeInTheDocument();
    expect(screen.getAllByText("Dados insuficientes").length).toBeGreaterThan(0);
    expect(screen.getByText("Não aplicável")).toBeInTheDocument();
  });

  it("B19 femea 3-8 meses fica em janela e macho fica nao aplicavel", () => {
    renderPanel(baseAnimal);
    expect(screen.getByText("Em janela")).toBeInTheDocument();

    renderPanel({ ...baseAnimal, id: "animal-macho", sexo: "macho" });
    expect(screen.getAllByText("Não aplicável").length).toBeGreaterThan(0);
    expect(
      screen.getByText("B19 se aplica a fêmeas bovinas/bubalinas."),
    ).toBeInTheDocument();
  });

  it("animal sem nascimento mostra dados insuficientes", () => {
    renderPanel({ ...baseAnimal, nascimento: null });

    expect(screen.getAllByText("Dados insuficientes").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Nascimento ausente para calcular janela B19."),
    ).toBeInTheDocument();
  });

  it("aftosa aparece bloqueada e raiva sem risco nao e inferida", () => {
    renderPanel(baseAnimal);

    expect(
      screen.getByText("Febre aftosa · Bloqueio de vacinação de rotina"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Protocolo bloqueado ou retirado no catálogo sanitário v2.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Raiva dos herbivoros · Primovacinação — dose 1"))
      .toBeInTheDocument();
    expect(
      screen.getByText("Protocolo de raiva depende de dado regional/de área de risco."),
    ).toBeInTheDocument();
    expect(screen.getByText("A pré-checagem não infere área de risco."))
      .toBeInTheDocument();
  });

  it("catalogo vazio mostra mensagem de sincronizacao e link do catalogo v2", () => {
    renderPanel(baseAnimal, {
      protocols: [],
      items: [],
      productClassGroups: [],
    });

    expect(
      screen.getByText("Catálogo sanitário local ainda não sincronizado"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver catálogo sanitário v2/i }))
      .toHaveAttribute("href", "/protocolos-sanitarios/catalogo-v2");
  });

  it("lote sem animais mostra dados insuficientes", () => {
    renderLotPanel([]);

    expect(screen.getByText("Dados insuficientes para avaliar o lote."))
      .toBeInTheDocument();
  });

  it("lote com animais usa precheck de lote e exibe status em portugues", () => {
    renderLotPanel([baseAnimal]);

    expect(screen.getByText("Brucelose B19 · B19 — fêmeas de 3 a 8 meses"))
      .toBeInTheDocument();
    expect(screen.getByText("Em janela")).toBeInTheDocument();
  });

  it("nao renderiza CTA operacional nem chaves tecnicas como titulo principal", () => {
    renderPanel(baseAnimal);

    const forbiddenButtons = [
      /Agendar/i,
      /Criar agenda/i,
      /Executar/i,
      /Registrar/i,
      /Aplicar/i,
      /Baixar estoque/i,
      /Calcular carência/i,
      /Liberar venda/i,
      /Liberar abate/i,
      /Liberar leite/i,
    ];

    for (const label of forbiddenButtons) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }

    expect(screen.queryByText("b19_femeas_3_8_meses")).not.toBeInTheDocument();
    expect(screen.queryByText("raiva_primovac_dose1")).not.toBeInTheDocument();
    expect(screen.queryByText("fmd_bloqueio_vacinacao_rotina")).not.toBeInTheDocument();
  });

  it("traduz todos os status padronizados", () => {
    const expected: Record<SanitaryEligibilityStatus, string> = {
      not_applicable: "Não aplicável",
      insufficient_data: "Dados insuficientes",
      not_yet_eligible: "Ainda não elegível",
      eligible_soon: "Elegível em breve",
      in_action_window: "Em janela",
      near_deadline: "Próximo do limite",
      overdue: "Atrasado",
      completed: "Concluído",
    };

    for (const [status, label] of Object.entries(expected)) {
      expect(formatSanitaryPrecheckStatusV2(status as SanitaryEligibilityStatus))
        .toBe(label);
    }
  });

  it("painel nao chama Supabase direto nem cria queue_ops", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../SanitaryPrecheckPanelV2.tsx"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/@\/lib\/supabase|supabase\.from/i);
    expect(moduleSource).not.toMatch(/queue_ops|createGesture|sync-batch|rpc\(/i);
    expect(moduleSource).not.toMatch(/event_eventos|state_agenda_itens/i);
    expect(moduleSource).toMatch(/precheckSanitaryProtocolsForLotV2/);
  });
});
