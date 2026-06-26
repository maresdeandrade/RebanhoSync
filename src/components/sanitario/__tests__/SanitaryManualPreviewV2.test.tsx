/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SanitaryManualPreviewV2 } from "@/components/sanitario/SanitaryManualPreviewV2";
import type { CreateManualSanitaryAgendaInputV2 } from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import {
  precheckSanitaryProtocolsForAnimalV2,
  precheckSanitaryProtocolsForLotV2,
  type SanitaryPrecheckAnimalResumoV2,
  type SanitaryProtocolPrecheckResultV2,
  type SanitaryProtocolPrecheckV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

const protocol = (familyCode: string, overrides: JsonRecord = {}): JsonRecord => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name:
    familyCode === "brucelose_b19"
      ? "Brucelose B19"
      : familyCode === "febre_aftosa"
        ? "Febre aftosa"
        : familyCode === "raiva_herbivoros"
          ? "Raiva dos herbívoros"
          : familyCode === "vermifugacao_pre_desmama"
            ? "Vermifugação pré-desmama"
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
      protocol("vermifugacao_pre_desmama"),
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
        },
      }),
      item("protocol-vermifugacao_pre_desmama", "pre_desmama_situacional", {
        item_status: "condicional",
        action_type: "vermifugacao",
        product_requirement_kind: "product_class_group",
        product_class_group_id: "grupo-tecnico-antiparasitarios",
        eligibility_rule: {
          species: ["bovino", "bubalino"],
        },
      }),
    ].map(adaptSanitaryProtocolItemV2Row),
    productClassGroups: [],
  };
}

const animal: SanitaryPrecheckAnimalResumoV2 = {
  id: "animal-1",
  especie: "bovino",
  sexo: "femea",
  nascimento: "2026-01-01",
  categoria: "bezerra",
  fazendaId: "farm-1",
};

function renderAnimalPreview() {
  const precheck = precheckSanitaryProtocolsForAnimalV2({
    scope: "animal",
    animal,
    catalog: buildCatalog(),
    today: "2026-05-01",
  });

  render(<SanitaryManualPreviewV2 precheck={precheck} />);
}

function renderLotPreview() {
  const precheck = precheckSanitaryProtocolsForLotV2({
    scope: "lote",
    lote: {
      id: "lote-1",
      fazendaId: "farm-1",
      animalIds: [animal.id],
      categoria: "bezerra",
    },
    animals: [animal],
    catalog: buildCatalog(),
    today: "2026-05-01",
  });

  render(<SanitaryManualPreviewV2 precheck={precheck} />);
}

function result(
  overrides: Partial<SanitaryProtocolPrecheckResultV2>,
): SanitaryProtocolPrecheckResultV2 {
  return {
    protocolId: "protocol-manual-preview",
    familyCode: "manual_preview",
    protocolName: "Protocolo de revisão manual",
    itemKey: "manual_preview_item",
    itemLabel: "Item de revisão manual",
    productRequirementKind: "product_class",
    productClass: "vacina_brucelose_b19",
    productClassGroupId: null,
    productClassGroupName: null,
    status: "in_action_window",
    reasons: ["Motivo resumido."],
    blockers: [],
    warnings: [],
    createsAgenda: false,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    ...overrides,
  };
}

function renderManualPreview(
  results: SanitaryProtocolPrecheckResultV2[],
  options: {
    withAgendaTarget?: boolean;
    createAgenda?: (input: CreateManualSanitaryAgendaInputV2) => Promise<{
      agendaId: string;
      clientOpId: string;
      status: "scheduled";
      created: boolean;
      createsEvent: false;
      createsStockMovement: false;
      createsActiveWithdrawal: false;
    }>;
  } = {},
) {
  const precheck: SanitaryProtocolPrecheckV2 = {
    animalOrLotId: "animal-preview",
    scope: "animal",
    evaluatedAt: "2026-05-01",
    results,
  };

  render(
    <SanitaryManualPreviewV2
      precheck={precheck}
      manualAgendaTarget={
        options.withAgendaTarget
          ? { fazendaId: "farm-1", animalIds: ["animal-preview"] }
          : undefined
      }
      createAgenda={options.createAgenda}
      clientOpIdFactory={() => "client-op-preview-test"}
    />,
  );
}

describe("SanitaryManualPreviewV2", () => {
  it("preview renderiza resultados de animal com textos principais em portugues", () => {
    renderAnimalPreview();

    expect(screen.getByText("Preview manual sanitário")).toBeInTheDocument();
    expect(screen.getByText("Animal")).toBeInTheDocument();
    expect(screen.getByText("Candidatas")).toBeInTheDocument();
    expect(screen.getByText("Atrasadas")).toBeInTheDocument();
    expect(screen.getByText("Pendências de dados")).toBeInTheDocument();
    expect(screen.getByText("Bloqueadas")).toBeInTheDocument();
    expect(screen.getByText("Não aplicáveis")).toBeInTheDocument();
  });

  it("preview renderiza resultados de lote", () => {
    renderLotPreview();

    expect(screen.getByText("Preview manual sanitário")).toBeInTheDocument();
    expect(screen.getByText("Lote")).toBeInTheDocument();
    expect(screen.getByText("Brucelose B19")).toBeInTheDocument();
  });

  it("B19 em janela aparece como candidata", () => {
    renderAnimalPreview();

    const candidates = screen.getByLabelText("Candidatas");
    expect(within(candidates).getByText("Brucelose B19")).toBeInTheDocument();
    expect(within(candidates).getByText("B19 — fêmeas de 3 a 8 meses"))
      .toBeInTheDocument();
    expect(within(candidates).getAllByText("Em janela").length).toBeGreaterThan(0);
  });

  it("botao Planejar agenda aparece em item candidato", () => {
    renderManualPreview([result({ itemLabel: "Item candidato" })], {
      withAgendaTarget: true,
    });

    const candidates = screen.getByLabelText("Candidatas");
    expect(within(candidates).getByRole("button", { name: /Planejar agenda/i }))
      .toBeInTheDocument();
  });

  it("overdue aparece em Atrasadas e nao aparece em Candidatas", () => {
    renderManualPreview(
      [
        result({
          itemLabel: "Revisão atrasada",
          status: "overdue",
          reasons: ["Janela informada já passou."],
        }),
      ],
      { withAgendaTarget: true },
    );

    const overdue = screen.getByLabelText("Atrasadas");
    const candidates = screen.getByLabelText("Candidatas");
    expect(within(overdue).getByText("Revisão atrasada")).toBeInTheDocument();
    expect(within(overdue).getByText("Atrasado")).toBeInTheDocument();
    expect(within(overdue).getByRole("button", { name: /Planejar agenda/i }))
      .toBeInTheDocument();
    expect(within(candidates).queryByText("Revisão atrasada"))
      .not.toBeInTheDocument();
    expect(within(candidates).queryByRole("button", { name: /Planejar agenda/i }))
      .not.toBeInTheDocument();
  });

  it("warning usado como motivo principal nao duplica", () => {
    renderManualPreview([
      result({
        itemLabel: "Revisão com aviso",
        status: "insufficient_data",
        reasons: [],
        warnings: ["Aviso usado como motivo principal.", "Aviso complementar."],
      }),
    ]);

    expect(screen.getAllByText("Aviso usado como motivo principal.")).toHaveLength(1);
    expect(screen.getByText("Aviso complementar.")).toBeInTheDocument();
  });

  it("botao Planejar agenda nao aparece em dados insuficientes, nao aplicavel ou bloqueado", () => {
    renderManualPreview(
      [
        result({
          itemLabel: "Item sem dado",
          status: "insufficient_data",
          reasons: ["Dado obrigatório ausente."],
        }),
        result({
          itemLabel: "Item não aplicável",
          status: "not_applicable",
          reasons: ["Fora do alvo informado."],
        }),
        result({
          itemLabel: "Item bloqueado",
          status: "not_applicable",
          blockers: ["Protocolo bloqueado ou retirado no catálogo sanitário v2."],
        }),
      ],
      { withAgendaTarget: true },
    );

    expect(screen.queryByRole("button", { name: /Planejar agenda/i }))
      .not.toBeInTheDocument();
  });

  it("modal informa limites da agenda e exige data planejada e confirmacao", async () => {
    const createAgenda = vi.fn(async () => ({
      agendaId: "agenda-1",
      clientOpId: "client-op-preview-test",
      status: "scheduled" as const,
      created: true,
      createsEvent: false as const,
      createsStockMovement: false as const,
      createsActiveWithdrawal: false as const,
    }));

    renderManualPreview(
      [
        result({
          itemLabel: "Item candidato",
          warnings: [
            "Produto real obrigatório na execução.",
            "Carência depende do produto executado.",
          ],
        }),
      ],
      { withAgendaTarget: true, createAgenda },
    );

    fireEvent.click(screen.getByRole("button", { name: /Planejar agenda/i }));

    expect(screen.getByText("Agenda é uma intenção futura. Não registra execução, não movimenta estoque e não calcula carência."))
      .toBeInTheDocument();
    expect(screen.getByText("Isso cria uma agenda futura, não registra execução."))
      .toBeInTheDocument();
    expect(screen.getByText("Produto real, dose, estoque e carência serão definidos somente na execução."))
      .toBeInTheDocument();
    expect(screen.getByText("Classe técnica não substitui o produto real. O produto executado será informado somente na execução."))
      .toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: /Confirmar agenda manual/i,
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Data planejada"), {
      target: { value: "2026-05-10" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Confirmo que esta agenda manual não registra execução/i,
      }),
    );
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(createAgenda).toHaveBeenCalledTimes(1));
    expect(createAgenda.mock.calls[0][0]).toMatchObject({
      plannedFor: "2026-05-10",
      confirmed: true,
      clientOpId: "client-op-preview-test",
      target: {
        scope: "animal",
        id: "animal-preview",
        fazendaId: "farm-1",
      },
      source: {
        kind: "sanitary_precheck_preview_v2",
        precheckStatus: "in_action_window",
        productRequirementKind: "product_class",
        productClass: "vacina_brucelose_b19",
      },
    });
    expect(screen.getByText("Agenda manual criada como intenção futura."))
      .toBeInTheDocument();
  });

  it("productRequirementKind vem de campo estruturado e nao de warnings", async () => {
    const createAgenda = vi.fn(async () => ({
      agendaId: "agenda-structured-1",
      clientOpId: "client-op-preview-test",
      status: "scheduled" as const,
      created: true,
      createsEvent: false as const,
      createsStockMovement: false as const,
      createsActiveWithdrawal: false as const,
    }));

    renderManualPreview(
      [
        result({
          itemLabel: "Item por grupo técnico",
          productRequirementKind: "product_class_group",
          productClass: null,
          productClassGroupId: "grupo-tecnico-antiparasitarios",
          productClassGroupName: "Antiparasitários",
          warnings: ["Texto humanizado alterado sem palavra-chave técnica."],
        }),
      ],
      { withAgendaTarget: true, createAgenda },
    );

    fireEvent.click(screen.getByRole("button", { name: /Planejar agenda/i }));

    expect(
      screen.getByText(
        "Grupo técnico não define produto, dose nem carência. Esses dados só serão definidos na execução.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Data planejada"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Confirmo que esta agenda manual não registra execução/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Confirmar agenda manual/i }));

    await waitFor(() => expect(createAgenda).toHaveBeenCalledTimes(1));
    expect(createAgenda.mock.calls[0][0].source).toMatchObject({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "grupo-tecnico-antiparasitarios",
      productClassGroupName: "Antiparasitários",
      warnings: ["Texto humanizado alterado sem palavra-chave técnica."],
    });
  });

  it("aftosa aparece como bloqueada ou nao aplicavel", () => {
    renderAnimalPreview();

    const blocked = screen.getByLabelText("Bloqueadas");
    expect(within(blocked).getByText("Febre aftosa")).toBeInTheDocument();
    expect(
      within(blocked).getByText(
        "Protocolo bloqueado ou retirado no catálogo sanitário v2.",
      ),
    ).toBeInTheDocument();
    expect(within(blocked).getByText("Não aplicável")).toBeInTheDocument();
  });

  it("raiva sem risco aparece como pendencia de dados insuficientes", () => {
    renderAnimalPreview();

    const pending = screen.getByLabelText("Pendências de dados");
    expect(within(pending).getByText("Raiva dos herbívoros")).toBeInTheDocument();
    expect(
      within(pending).getByText(
        "Protocolo de raiva depende de dado regional/de área de risco.",
      ),
    ).toBeInTheDocument();
    expect(within(pending).getByText("Dados insuficientes")).toBeInTheDocument();
  });

  it("grupo tecnico de produtos aparece com aviso de produto real obrigatorio", () => {
    renderAnimalPreview();

    const candidates = screen.getByLabelText("Candidatas");
    expect(within(candidates).getByText("Vermifugação pré-desmama"))
      .toBeInTheDocument();
    expect(
      within(candidates).getByText(
        "Grupo técnico de produtos não valida execução, dose nem carência.",
      ),
    ).toBeInTheDocument();
    expect(within(candidates).getByText("Produto real obrigatório na execução."))
      .toBeInTheDocument();
  });

  it("nao renderiza CTA operacional nem texto tecnico cru", () => {
    renderAnimalPreview();

    expect(screen.queryByRole("button", { name: /Agendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Executar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar/i })).not.toBeInTheDocument();
    expect(screen.queryByText("b19_femeas_3_8_meses")).not.toBeInTheDocument();
    expect(screen.queryByText("raiva_primovac_dose1")).not.toBeInTheDocument();
    expect(screen.queryByText("grupo-tecnico-antiparasitarios"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("animal-1")).not.toBeInTheDocument();
  });

  it("nao importa Supabase nem cria push ou queue_ops", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../SanitaryManualPreviewV2.tsx"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/@\/lib\/supabase|supabase\.from/i);
    expect(moduleSource).not.toMatch(/queue_ops|createGesture|sync-batch|rpc\(/i);
    expect(moduleSource).not.toMatch(/push/i);
  });
});
