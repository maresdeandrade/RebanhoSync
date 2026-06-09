import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SanitaryProductV2, SpeciesAuthorizationV2 } from "../sanitaryProductV2";
import type { SanitaryProtocolItemVersionV2, SanitaryProtocolV2 } from "../sanitaryProtocolV2";
import type { SanitarySourceRefV2 } from "../sanitarySourceV2";
import {
  createSanitaryAgendaV2SnapshotPayload,
  type AgendaV2SnapshotPayload,
} from "../sanitaryAgendaBridgeV2";
import type { AgendaSnapshotBuildInputV2, BuildSnapshotResult } from "../sanitarySnapshotBuildersV2";

const officialSource: SanitarySourceRefV2 = {
  id: "src-official",
  kind: "norma_oficial",
  title: "Norma oficial",
  strength: "forte",
  evidenceStatus: "SIM_NORMA",
  fieldKeys: [
    "legal_status",
    "eligibility_rule",
    "operational_window",
    "product_requirement",
    "species_authorization",
  ],
};

const labelSource: SanitarySourceRefV2 = {
  id: "src-label",
  kind: "bula",
  title: "Bula registrada",
  strength: "forte",
  evidenceStatus: "SIM_BULA",
  fieldKeys: ["species_authorization", "dose", "route", "presentation"],
};

const authorization: SpeciesAuthorizationV2 = {
  productId: "prod-1",
  speciesCode: "bovino",
  aptitude: "all",
  authorizationStatus: "SIM_BULA",
  sourceRefs: [labelSource],
};

const protocol: SanitaryProtocolV2 = {
  id: "protocol-1",
  familyCode: "VAC_CORE",
  name: "Vacinas core",
  scope: "global",
  speciesScope: ["bovino"],
  jurisdictionScope: { country: "BR" },
  legalStatus: "obrigatorio_norma",
  version: 1,
  status: "active",
  sourceRefsSnapshot: [officialSource],
  approvalStatus: "approved",
};

function protocolItem(
  overrides: Partial<SanitaryProtocolItemVersionV2> = {},
): SanitaryProtocolItemVersionV2 {
  return {
    id: "item-version-1",
    protocolId: "protocol-1",
    logicalItemKey: "vacina-core",
    version: 1,
    itemStatus: "recomendado",
    actionType: "vacinacao",
    productRequirementKind: "specific_product",
    productId: "prod-1",
    eligibilityRule: { minAgeDays: 90 },
    operationalWindowRule: { startDay: 90, endDay: 120 },
    speciesAuthorization: [authorization],
    sourceRefsByField: {
      eligibility_rule: [officialSource],
      operational_window: [officialSource],
      product_requirement: [officialSource],
      species_authorization: [labelSource],
    },
    limitations: [],
    allowsAgendaAuto: true,
    status: "active",
    ...overrides,
  };
}

const product: SanitaryProductV2 = {
  id: "prod-1",
  nomeComercial: "Produto teste",
  classe: "vacina",
  tipoProduto: "biologico",
  apresentacao: "Frasco",
  statusCuratorial: "ativo",
  sourceRefs: [labelSource],
  speciesAuthorizations: [authorization],
  doseRules: [{
    productId: "prod-1",
    route: "subcutanea",
    doseQuantity: 2,
    doseUnit: "mL",
    doseBasis: "animal",
    statusCuratorial: "ativo",
    sourceRefs: [labelSource],
  }],
};

function validInput(
  overrides: Partial<AgendaSnapshotBuildInputV2> = {},
): AgendaSnapshotBuildInputV2 {
  return {
    protocol,
    protocolItem: protocolItem(),
    plannedProduct: product,
    plannedProductSpeciesAuthorization: authorization,
    plannedDoseRule: product.doseRules?.[0] ?? null,
    technicalSources: [officialSource, labelSource],
    referenceContext: {
      speciesCode: "bovino",
      aptitude: "corte",
    },
    ...overrides,
  };
}

describe("sanitaryAgendaBridgeV2", () => {
  it("monta protocol_item_snapshot e produto_snapshot sem side effects", () => {
    const input = validInput();
    const before = JSON.stringify(input);

    const first = createSanitaryAgendaV2SnapshotPayload(input);
    const second = createSanitaryAgendaV2SnapshotPayload(input);

    expect(first.ok).toBe(true);
    expect(first.snapshot).toMatchObject({
      protocol_item_snapshot: { protocolId: "protocol-1" },
      produto_snapshot: { productId: "prod-1" },
    });
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("nao retorna payload quando o snapshot de agenda é invalido", () => {
    const result: BuildSnapshotResult<AgendaV2SnapshotPayload> =
      createSanitaryAgendaV2SnapshotPayload(
        validInput({
          protocolItem: protocolItem({
            allowsAgendaAuto: false,
          }),
        }),
      );

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "protocol_item_disallows_auto_agenda" }),
      ]),
    );
  });

  it("adapter nao cria agenda, evento, IO nem usa APIs proibidas", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/sanitario/rules/sanitaryAgendaBridgeV2.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@supabase|Dexie|dexie|React|react|storage|Date\.now|fetch\(|indexedDB/);
  });
});