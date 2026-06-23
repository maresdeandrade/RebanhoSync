/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SanitarioCatalogoV2 from "@/pages/SanitarioCatalogoV2";
import { supabase } from "@/lib/supabase";
import {
  readLocalSanitaryProtocolCatalogV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

vi.mock("@/lib/sanitario/catalog/sanitaryProtocolCatalogV2", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/sanitario/catalog/sanitaryProtocolCatalogV2")
  >("@/lib/sanitario/catalog/sanitaryProtocolCatalogV2");

  return {
    ...actual,
    readLocalSanitaryProtocolCatalogV2: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const protocol = (
  familyCode: string,
  name: string,
  overrides: Partial<SanitaryProtocolV2ReadModel> = {},
): SanitaryProtocolV2ReadModel => ({
  id: `protocol-${familyCode}`,
  familyCode,
  name,
  scope: "global",
  fazendaId: null,
  speciesScope: { especies: ["bovino"] },
  jurisdictionScope: {},
  legalStatus: "recomendado_tecnico",
  version: 1,
  status: "draft",
  approvalStatus: "draft",
  sourceRefsSnapshot: [],
  metadata: {
    curationStatus: "needs_review",
    automationStatus: "manual_only",
    agenda_allowed: false,
    approved_for_catalog: false,
  },
  ...overrides,
});

const item = (
  familyCode: string,
  logicalItemKey: string,
  overrides: Partial<SanitaryProtocolItemV2ReadModel> = {},
): SanitaryProtocolItemV2ReadModel => ({
  id: `item-${logicalItemKey}`,
  protocolId: `protocol-${familyCode}`,
  logicalItemKey,
  version: 1,
  itemStatus: "draft",
  actionType: "orientacao",
  productRequirementKind: "product_class",
  productId: null,
  productClass: "classe_tecnica",
  productClassGroupId: null,
  eligibilityRule: {},
  operationalWindowRule: {},
  doseRule: {},
  routeRule: {},
  boosterRule: {},
  speciesAuthorization: {},
  sourceRefsByField: {},
  limitations: {},
  snapshotTemplate: {},
  allowsAgendaAuto: false,
  requiresMvResponsavel: false,
  status: "draft",
  ...overrides,
});

const GROUP_NAMES: Record<string, string> = {
  pcg_antiparasitarios_bezerros_pre_desmama:
    "Antiparasitários bezerros pré-desmama",
  pcg_antiparasitarios_matrizes_pre_parto:
    "Antiparasitários matrizes pré-parto",
  pcg_antiparasitarios_pre_confinamento:
    "Antiparasitários pré-confinamento",
  pcg_antiparasitarios_recria_estrategicos:
    "Antiparasitários recria estratégicos",
};

const group = (groupKey: string) => ({
  id: `group-${groupKey}`,
  fazendaId: null,
  scope: "global",
  groupKey,
  name: GROUP_NAMES[groupKey] ?? groupKey,
  requiresMvForOtherClass: true,
  curationStatus: "needs_review",
  automationStatus: "blocked",
  limitations: ["members_sem_class_id_bloqueados"],
  metadata: {
    agenda_allowed: false,
    approved_for_catalog: false,
  },
});

const productClassGroupItem = (
  familyCode: string,
  logicalItemKey: string,
  groupKey: string,
) =>
  item(familyCode, logicalItemKey, {
    productRequirementKind: "product_class_group",
    productClass: null,
    productClassGroupId: `group-${groupKey}`,
    limitations: {
      principal: ["produto_real_obrigatorio_na_execucao"],
    },
    snapshotTemplate: {
      sourceGaps: ["source_gap_product_withdrawal_snapshot"],
      sourcePolicy: { withdrawal: "by_executed_product_snapshot" },
      restrictions: ["members_sem_class_id_bloqueados"],
    },
  });

const catalogFixture: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [
    protocol("brucelose_b19", "Brucelose B19", {
      speciesScope: { especies: ["bovino", "bubalino"] },
      jurisdictionScope: { country: "BR", legal_scope: "nacional" },
      legalStatus: "obrigatorio_norma",
      metadata: {
        curationStatus: "needs_review",
        automationStatus: "manual_only",
        agenda_allowed: false,
        approved_for_catalog: false,
        sourceGaps: [
          "requires_mv_habilitado",
          "requires_official_record_flow",
          "requires_executed_product_snapshot",
          "requires_product_catalog_validation",
        ],
        restrictions: [
          "execution_requires_enabled_veterinarian",
          "execution_requires_official_record",
          "execution_requires_real_product_snapshot",
        ],
      },
    }),
    protocol("controle_parasitario_recria_5_7_9", "Controle parasitario recria", {
      metadata: {
        curationStatus: "needs_review",
        automationStatus: "preview_allowed",
        agenda_allowed: false,
        approved_for_catalog: false,
      },
    }),
    protocol("vermifugacao_pre_desmama", "Vermifugacao pre-desmama"),
    protocol(
      "vermifugacao_pre_confinamento_pasto_vedado",
      "Vermifugacao pre-confinamento",
    ),
    protocol("matrizes_pre_parto", "Matrizes pre-parto"),
    protocol("leptospirose", "Leptospirose"),
    protocol("ibr_bvd", "IBR/BVD", {
      metadata: {
        curationStatus: "needs_review",
        automationStatus: "preview_allowed",
        agenda_allowed: false,
        approved_for_catalog: false,
      },
    }),
    protocol("febre_aftosa", "Febre aftosa", {
      legalStatus: "bloqueado",
      status: "retired",
      metadata: {
        curationStatus: "needs_review",
        automationStatus: "blocked",
        agenda_allowed: false,
        approved_for_catalog: false,
      },
    }),
    protocol("clostridioses", "Clostridioses", {
      metadata: {
        curationStatus: "needs_review",
        automationStatus: "preview_allowed",
        agenda_allowed: false,
        approved_for_catalog: false,
        sourceGaps: ["source_gap_age_product", "source_gap_bubalino"],
        restrictions: [
          "product_specific_label_required",
          "do_not_generalize_class",
        ],
      },
    }),
    protocol("raiva_herbivoros", "Raiva dos herbivoros"),
  ],
  items: [
    item("brucelose_b19", "b19_femeas_3_8_meses", {
      productClass: "vacina_brucelose_b19",
      eligibilityRule: {
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
      },
      limitations: [
        "requires_mv_habilitado",
        "execution_requires_enabled_veterinarian",
      ],
      snapshotTemplate: {
        sourcePolicy: {
          dose: "by_executed_product_label",
          withdrawal: "by_executed_product_snapshot",
        },
      },
    }),
    productClassGroupItem(
      "controle_parasitario_recria_5_7_9",
      "recria_maio",
      "pcg_antiparasitarios_recria_estrategicos",
    ),
    productClassGroupItem(
      "controle_parasitario_recria_5_7_9",
      "recria_julho",
      "pcg_antiparasitarios_recria_estrategicos",
    ),
    productClassGroupItem(
      "controle_parasitario_recria_5_7_9",
      "recria_setembro",
      "pcg_antiparasitarios_recria_estrategicos",
    ),
    productClassGroupItem(
      "vermifugacao_pre_desmama",
      "pre_desmama_situacional",
      "pcg_antiparasitarios_bezerros_pre_desmama",
    ),
    productClassGroupItem(
      "vermifugacao_pre_confinamento_pasto_vedado",
      "pre_confinamento_dose_unica",
      "pcg_antiparasitarios_pre_confinamento",
    ),
    productClassGroupItem(
      "matrizes_pre_parto",
      "matrizes_pre_parto_antiparasitario",
      "pcg_antiparasitarios_matrizes_pre_parto",
    ),
    item("leptospirose", "lepto_primovac_dose1"),
    item("leptospirose", "lepto_primovac_dose2"),
    item("leptospirose", "lepto_reforco_anual_semestral"),
    item("ibr_bvd", "ibr_bvd_primovac_dose1", {
      productClass: "vacina_ibr_bvd",
    }),
    item("ibr_bvd", "ibr_bvd_primovac_dose2", {
      productClass: "vacina_ibr_bvd",
    }),
    item("febre_aftosa", "fmd_historico_contingencia", {
      productRequirementKind: "none",
      productClass: null,
      snapshotTemplate: { restrictions: ["vaccination_routine_blocked"] },
    }),
    item("febre_aftosa", "fmd_bloqueio_vacinacao_rotina", {
      productRequirementKind: "none",
      productClass: null,
      snapshotTemplate: { restrictions: ["vaccination_routine_blocked"] },
    }),
    item("clostridioses", "clostridial_primovac_dose1", {
      productClass: "vacina_clostridial_multivalente",
      limitations: [
        "source_gap_age_product",
        "source_gap_bubalino",
        "product_specific_label_required",
        "do_not_generalize_class",
      ],
    }),
    item("clostridioses", "clostridial_primovac_dose2", {
      productClass: "vacina_clostridial_multivalente",
      limitations: ["product_specific_label_required"],
    }),
    item("clostridioses", "clostridial_reforco_anual", {
      productClass: "vacina_clostridial_multivalente",
      limitations: ["product_specific_label_required"],
    }),
    item("raiva_herbivoros", "raiva_primovac_dose1", {
      itemStatus: "condicional",
      productRequirementKind: "product_class",
      productClass: "vacina_raiva_herbivoros",
      snapshotTemplate: {
        sourceGaps: ["requires_risk_area_overlay"],
        sourcePolicy: { withdrawal: "by_executed_product_snapshot" },
        metadata: { automationStatus: "manual_only" },
      },
    }),
    item("raiva_herbivoros", "raiva_primovac_reforco_30d", {
      itemStatus: "condicional",
      productRequirementKind: "product_class",
      productClass: "vacina_raiva_herbivoros",
      operationalWindowRule: {
        anchor: "previous_dose",
        min_offset_days: 30,
        max_offset_days: 30,
      },
      snapshotTemplate: {
        sourceGaps: ["requires_risk_area_overlay"],
        sourcePolicy: { withdrawal: "by_executed_product_snapshot" },
        metadata: { automationStatus: "manual_only" },
      },
    }),
    item("raiva_herbivoros", "raiva_reforco_anual_area_risco", {
      itemStatus: "condicional",
      productRequirementKind: "product_class",
      productClass: "vacina_raiva_herbivoros",
      boosterRule: { recurrenceRule: { kind: "annual_if_risk_area" } },
      snapshotTemplate: {
        sourceGaps: ["requires_risk_area_overlay"],
        sourcePolicy: { withdrawal: "by_executed_product_snapshot" },
        metadata: { automationStatus: "manual_only" },
      },
    }),
  ],
  productClassGroups: [
    group("pcg_antiparasitarios_bezerros_pre_desmama"),
    group("pcg_antiparasitarios_matrizes_pre_parto"),
    group("pcg_antiparasitarios_pre_confinamento"),
    group("pcg_antiparasitarios_recria_estrategicos"),
  ],
};

const emptyCatalogFixture: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [],
  items: [],
  productClassGroups: [],
};

describe("SanitarioCatalogoV2", () => {
  const mockedReadLocal = vi.mocked(readLocalSanitaryProtocolCatalogV2);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadLocal.mockResolvedValue(catalogFixture);
  });

  it("renderiza resumo local com 10 protocolos, 20 itens e 4 grupos", async () => {
    render(<SanitarioCatalogoV2 />);

    expect(await screen.findByText("Catálogo sanitário v2")).toBeInTheDocument();
    expect(mockedReadLocal).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Protocolos")).toBeInTheDocument();
    expect(screen.getByText("Itens")).toBeInTheDocument();
    expect(screen.getByText("Grupos técnicos")).toBeInTheDocument();
    expect(screen.getByText("Members bloqueados")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("Itens com grupo técnico")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("mostra estado vazio quando a Dexie local ainda nao foi sincronizada", async () => {
    mockedReadLocal.mockResolvedValueOnce(emptyCatalogFixture);

    render(<SanitarioCatalogoV2 />);

    expect(
      await screen.findByText("Catálogo local ainda não sincronizado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Execute a sincronização para baixar os protocolos sanitários v2.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protocolos v2")).not.toBeInTheDocument();
  });

  it("exibe B19 nacional/manual e aftosa bloqueada/retirada", async () => {
    render(<SanitarioCatalogoV2 />);

    expect((await screen.findAllByText("Brucelose B19")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("B19 nacional presente")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Febre aftosa")).toBeInTheDocument();
    expect(screen.getByText("Bloqueado/retirado")).toBeInTheDocument();
    expect(screen.getByText("Aftosa bloqueada presente")).toBeInTheDocument();
  });

  it("exibe antiparasitarios com grupo tecnico em detalhe read-only", async () => {
    render(<SanitarioCatalogoV2 />);

    const recriaButton = await screen.findByRole("button", {
      name: /Controle parasitario recria/i,
    });
    fireEvent.click(recriaButton);

    expect(screen.getByText("Recria — maio")).toBeInTheDocument();
    expect(screen.queryByText("recria_maio")).not.toBeInTheDocument();
    expect(screen.getAllByText("Grupo técnico").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("product_class_group")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Antiparasitários recria estratégicos").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      screen.queryByText("group-pcg_antiparasitarios_recria_estrategicos"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ProductClassGroupId")).not.toBeInTheDocument();
    expect(screen.queryByText("Exigência de produto")).not.toBeInTheDocument();
    expect(screen.getAllByText("Produto exigido").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      screen.getAllByText("Antiparasitários recria estratégicos").length,
    ).toBeGreaterThanOrEqual(3);
    const itemCards = screen
      .getAllByText("Produto exigido")
      .map((label) => label.parentElement?.textContent ?? "");
    expect(
      itemCards.some((text) =>
        /Exigência de produto\s*Grupo técnico\s*Grupo técnico/.test(text),
      ),
    ).toBe(false);
    expect(
      screen.getAllByText("Grupo técnico não valida dose nem carência.").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      screen.queryByText("Produto real continua obrigatório na execução."),
    ).not.toBeInTheDocument();
    const technicalToggles = screen.getAllByRole("button", {
      name: /Limitações e detalhes técnicos/i,
    });
    expect(technicalToggles.length).toBeGreaterThanOrEqual(3);
    expect(technicalToggles[0]).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(technicalToggles[0]);
    expect(screen.getByText("Chave técnica")).toBeInTheDocument();
    expect(screen.getByText("recria_maio")).toBeInTheDocument();
    expect(screen.getByText("Requisito técnico interno")).toBeInTheDocument();
    expect(screen.queryByText("Product requirement")).not.toBeInTheDocument();
    expect(screen.getByText("product_class_group")).toBeInTheDocument();
    expect(
      screen.getByText("Produto real continua obrigatório na execução."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("source_gap_product_withdrawal_snapshot"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("withdrawal: by_executed_product_snapshot"),
    ).not.toBeInTheDocument();
  });

  it("exibe raiva com primovacinacao, reforco 30d e reforco anual read-only", async () => {
    render(<SanitarioCatalogoV2 />);

    const raivaButton = await screen.findByRole("button", {
      name: /Raiva dos herbivoros/i,
    });
    fireEvent.click(raivaButton);

    expect(screen.getByText("Primovacinação — dose 1")).toBeInTheDocument();
    expect(
      screen.getByText("Reforço da primovacinação — 30 dias"),
    ).toBeInTheDocument();
    expect(screen.getByText("Reforço anual em área de risco")).toBeInTheDocument();
    expect(screen.queryByText("raiva_primovac_dose1")).not.toBeInTheDocument();
    expect(screen.queryByText("raiva_area_risco_anual")).not.toBeInTheDocument();
    expect(screen.getAllByText("Vacina contra raiva dos herbívoros").length).toBe(
      3,
    );
    expect(screen.queryByText("vacina_raiva_herbivoros")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Catálogo read-only. Produto real, dose e carência são definidos somente na execução.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sem agenda automática nesta versão do catálogo."),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /Limitações e detalhes técnicos/i,
      })[0],
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Dose, via e carência dependem do produto executado."),
    ).not.toBeInTheDocument();
    for (const toggle of screen.getAllByRole("button", {
      name: /Limitações e detalhes técnicos/i,
    })) {
      fireEvent.click(toggle);
    }
    expect(screen.getByText("raiva_primovac_dose1")).toBeInTheDocument();
    expect(screen.getAllByText("vacina_raiva_herbivoros").length).toBe(3);
    expect(
      screen.getAllByText("Dose, via e carência dependem do produto executado.")
        .length,
    ).toBe(3);
  });

  it("humaniza limitacoes de B19 sem vazar codigos internos", async () => {
    render(<SanitarioCatalogoV2 />);

    const b19Button = await screen.findByRole("button", {
      name: /Brucelose B19/i,
    });
    fireEvent.click(b19Button);

    const technicalToggle = screen.getByRole("button", {
      name: /Limitações e detalhes técnicos/i,
    });
    expect(technicalToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText("Exige médico-veterinário habilitado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exige fluxo oficial de registro quando aplicável."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Exige produto real registrado na execução."),
    ).not.toBeInTheDocument();
    fireEvent.click(technicalToggle);
    expect(screen.getByText("Limitações operacionais")).toBeInTheDocument();
    expect(
      screen.getByText("Exige produto real registrado na execução."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dose deve seguir a bula do produto executado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Carência deve seguir o produto executado."),
    ).toBeInTheDocument();
    expect(screen.queryByText("requires_mv_habilitado")).not.toBeInTheDocument();
    expect(
      screen.queryByText("execution_requires_enabled_veterinarian"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Exige médico-veterinário habilitado."),
    ).toHaveLength(2);
    expect(
      screen.getAllByText("Exige produto real registrado na execução."),
    ).toHaveLength(1);
  });

  it("humaniza clostridioses sem source_gap cru ou snake_case operacional", async () => {
    render(<SanitarioCatalogoV2 />);

    const clostridiosesButton = await screen.findByRole("button", {
      name: /Clostridioses/i,
    });
    fireEvent.click(clostridiosesButton);

    expect(screen.getByText("Primovacinação — dose 1")).toBeInTheDocument();
    expect(screen.getByText("Primovacinação — dose 2")).toBeInTheDocument();
    expect(screen.getByText("Reforço anual")).toBeInTheDocument();
    expect(screen.queryByText("clostridial_primovac_dose1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Classe técnica").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Vacina clostridial").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(screen.queryByText("Requirement")).not.toBeInTheDocument();
    expect(screen.queryByText("ProductClass")).not.toBeInTheDocument();
    expect(screen.queryByText("allowsAgendaAuto")).not.toBeInTheDocument();
    expect(screen.queryByText("product_class")).not.toBeInTheDocument();
    expect(screen.queryByText("vacina_clostridial")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Há lacuna de fonte para idade/produto.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Bubalinos exigem fonte/bula específica quando aplicável.")
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(
        "Dose, via e carência dependem da bula do produto executado.",
      ),
    ).not.toBeInTheDocument();
    for (const toggle of screen.getAllByRole("button", {
      name: /Limitações e detalhes técnicos/i,
    })) {
      fireEvent.click(toggle);
    }
    expect(screen.getByText("clostridial_primovac_dose1")).toBeInTheDocument();
    expect(screen.getAllByText("product_class").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("vacina_clostridial_multivalente").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        "Dose, via e carência dependem da bula do produto executado.",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        "Classe técnica não autoriza generalizar dose, via ou carência.",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("source_gap_age_product")).not.toBeInTheDocument();
    expect(
      screen.queryByText("product_specific_label_required"),
    ).not.toBeInTheDocument();

    expect(
      screen
        .getAllByRole("button", { name: /Limitações e detalhes técnicos/i })
        .every((button) => !/[a-z]+_[a-z_]+/.test(button.textContent ?? "")),
    ).toBe(true);
  });

  it("mantem matrizes pre-parto sem item ativo de leptospirose concorrente", async () => {
    render(<SanitarioCatalogoV2 />);

    const matrizesButton = await screen.findByRole("button", {
      name: /Matrizes pre-parto/i,
    });
    fireEvent.click(matrizesButton);

    expect(
      screen.getByText("Antiparasitário pré-parto"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("matrizes_pre_parto_antiparasitario"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("matrizes_pre_parto_lepto_reforco_situacional"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("vacina_leptospirose")).not.toBeInTheDocument();
    expect(screen.getByText("Leptospirose")).toBeInTheDocument();
  });

  it("mostra produto exigido de classe tecnica sem duplicar rotulos", async () => {
    render(<SanitarioCatalogoV2 />);

    const ibrButton = await screen.findByRole("button", {
      name: /IBR\/BVD/i,
    });
    fireEvent.click(ibrButton);

    expect(screen.queryByText("Exigência de produto")).not.toBeInTheDocument();
    expect(screen.queryByText("ProductClass")).not.toBeInTheDocument();
    expect(screen.queryByText("ProductClassGroupId")).not.toBeInTheDocument();
    expect(screen.getAllByText("Produto exigido").length).toBe(2);
    expect(screen.getAllByText("Vacina IBR/BVD").length).toBe(2);
    expect(screen.getAllByText("Classe técnica").length).toBe(2);

    const itemCards = screen
      .getAllByText("Produto exigido")
      .map((label) => label.parentElement?.textContent ?? "");
    expect(
      itemCards.some((text) =>
        /Exigência de produto\s*Classe técnica\s*Classe técnica/.test(text),
      ),
    ).toBe(false);
  });

  it("mostra contexto de grupo e limitacoes para itens sem ProductClassGroup", async () => {
    render(<SanitarioCatalogoV2 />);

    const aftosaButton = await screen.findByRole("button", {
      name: /Febre aftosa/i,
    });
    fireEvent.click(aftosaButton);

    expect(
      screen.getAllByText("Não se aplica — item bloqueado/sem produto").length,
    ).toBe(2);
    expect(screen.getAllByText("Produto exigido").length).toBe(2);
    expect(screen.getAllByText("Sem produto executável").length).toBe(2);
    expect(screen.getAllByText("Item sem produto executável.").length).toBe(2);
    for (const toggle of screen.getAllByRole("button", {
      name: /Limitações e detalhes técnicos/i,
    })) {
      fireEvent.click(toggle);
    }
    expect(
      screen.getAllByText("Não gera ação sanitária operacional.").length,
    ).toBe(2);
    expect(screen.queryByText("Sem limitacao textual")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem limitação textual")).not.toBeInTheDocument();
  });

  it("nao renderiza CTAs de agenda, execucao, estoque, carencia ou liberacao", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findByText(
      "Catálogo read-only. Produto real, dose e carência são definidos somente na execução.",
    );

    const forbiddenButtons = [
      /Gerar agenda/i,
      /Criar agenda/i,
      /^Agendar$/i,
      /^Executar$/i,
      /^Registrar$/i,
      /Aplicar protocolo/i,
      /Baixar estoque/i,
      /Liberar venda/i,
      /Liberar abate/i,
      /Calcular carencia/i,
    ];

    for (const label of forbiddenButtons) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }

    expect(screen.queryByText("Nao cria agenda.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nao registra evento.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nao movimenta estoque.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nao calcula carencia ativa.")).not.toBeInTheDocument();
  });

  it("filtra e seleciona protocolo sem usar Supabase direto", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findByText("Catálogo sanitário v2");
    fireEvent.change(screen.getByLabelText("Filtrar protocolos"), {
      target: { value: "ibr" },
    });

    expect(screen.getAllByText("IBR/BVD").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Brucelose B19")).toHaveLength(0);
    expect(mockedReadLocal).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("mantem a leitura como visualizacao local sem formularios operacionais", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findAllByText("Brucelose B19");
    const b19Button = screen.getByRole("button", { name: /Brucelose B19/i });

    expect(within(b19Button).getByText("brucelose_b19")).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
