/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SanitarioCatalogoV2 from "@/pages/SanitarioCatalogoV2";
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

const group = (groupKey: string) => ({
  id: `group-${groupKey}`,
  fazendaId: null,
  scope: "global",
  groupKey,
  name: groupKey,
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
    protocol("clostridioses", "Clostridioses"),
    protocol("raiva_herbivoros", "Raiva dos herbivoros"),
  ],
  items: [
    item("brucelose_b19", "b19_femeas_3_8_meses", {
      eligibilityRule: {
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
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
    item("ibr_bvd", "ibr_bvd_primovac_dose1"),
    item("ibr_bvd", "ibr_bvd_primovac_dose2"),
    item("febre_aftosa", "fmd_historico_contingencia", {
      productRequirementKind: "none",
      productClass: null,
    }),
    item("febre_aftosa", "fmd_bloqueio_vacinacao_rotina", {
      productRequirementKind: "none",
      productClass: null,
    }),
    item("clostridioses", "clostridial_primovac_dose1"),
    item("clostridioses", "clostridial_primovac_dose2"),
    item("clostridioses", "clostridial_reforco_anual"),
    item("raiva_herbivoros", "raiva_area_risco_anual"),
    item("matrizes_pre_parto", "matrizes_pre_parto_lepto_reforco_situacional"),
  ],
  productClassGroups: [
    group("pcg_antiparasitarios_bezerros_pre_desmama"),
    group("pcg_antiparasitarios_matrizes_pre_parto"),
    group("pcg_antiparasitarios_pre_confinamento"),
    group("pcg_antiparasitarios_recria_estrategicos"),
  ],
};

describe("SanitarioCatalogoV2", () => {
  const mockedReadLocal = vi.mocked(readLocalSanitaryProtocolCatalogV2);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadLocal.mockResolvedValue(catalogFixture);
  });

  it("renderiza resumo local com 10 protocolos, 19 itens e 4 grupos", async () => {
    render(<SanitarioCatalogoV2 />);

    expect(await screen.findByText("Catalogo sanitario v2")).toBeInTheDocument();
    expect(mockedReadLocal).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Protocolos")).toBeInTheDocument();
    expect(screen.getByText("Itens")).toBeInTheDocument();
    expect(screen.getByText("ProductClassGroups")).toBeInTheDocument();
    expect(screen.getByText("Members bloqueados")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("19").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("Itens ProductClassGroup")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("exibe B19 nacional/manual_only e aftosa bloqueada/retired", async () => {
    render(<SanitarioCatalogoV2 />);

    expect((await screen.findAllByText("Brucelose B19")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("B19 nacional presente")).toBeInTheDocument();
    expect(screen.getByText("manual_only")).toBeInTheDocument();
    expect(screen.getByText("Febre aftosa")).toBeInTheDocument();
    expect(screen.getByText("bloqueado/retired")).toBeInTheDocument();
    expect(screen.getByText("Aftosa bloqueada presente")).toBeInTheDocument();
  });

  it("exibe antiparasitarios com ProductClassGroup em detalhe read-only", async () => {
    render(<SanitarioCatalogoV2 />);

    const recriaButton = await screen.findByRole("button", {
      name: /Controle parasitario recria/i,
    });
    fireEvent.click(recriaButton);

    expect(screen.getByText("recria_maio")).toBeInTheDocument();
    expect(screen.getAllByText("product_class_group").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      screen.getAllByText("group-pcg_antiparasitarios_recria_estrategicos")
        .length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("nao renderiza CTAs de agenda, execucao, estoque, carencia ou liberacao", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findByText("Catalogo read-only.");

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

    expect(screen.getByText("Nao cria agenda.")).toBeInTheDocument();
    expect(screen.getByText("Nao registra evento.")).toBeInTheDocument();
    expect(screen.getByText("Nao movimenta estoque.")).toBeInTheDocument();
    expect(screen.getByText("Nao calcula carencia ativa.")).toBeInTheDocument();
    expect(
      screen.getByText("Produto real continua obrigatorio na execucao."),
    ).toBeInTheDocument();
  });

  it("filtra e seleciona protocolo sem usar Supabase direto", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findByText("Catalogo sanitario v2");
    fireEvent.change(screen.getByLabelText("Filtrar protocolos"), {
      target: { value: "ibr" },
    });

    expect(screen.getAllByText("IBR/BVD").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Brucelose B19")).toHaveLength(0);
    expect(mockedReadLocal).toHaveBeenCalledTimes(1);
  });

  it("mantem a leitura como visualizacao local sem formularios operacionais", async () => {
    render(<SanitarioCatalogoV2 />);

    await screen.findAllByText("Brucelose B19");
    const b19Button = screen.getByRole("button", { name: /Brucelose B19/i });

    expect(within(b19Button).getByText("brucelose_b19")).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
