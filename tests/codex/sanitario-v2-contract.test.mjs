import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertStableIdentity,
  normalizeCanonicalData,
  validateCanonicalTechnicalContract,
} from "../../scripts/codex/sanitario-v2-contract.mjs";
import {
  applyGateError,
  assertApplyGate,
  itemInsertRow,
} from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const IMPORT_SCRIPT = fileURLToPath(
  new URL("../../scripts/codex/import-sanitario-protocols-v2.mjs", import.meta.url),
);
const CANONICAL_PAYLOAD = fileURLToPath(
  new URL("../../docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json", import.meta.url),
);

const ids = {
  source: "11111111-1111-4111-8111-111111111111",
  product: "22222222-2222-4222-8222-222222222222",
  class: "33333333-3333-4333-8333-333333333333",
  group: "44444444-4444-4444-8444-444444444444",
  withdrawal: "55555555-5555-4555-8555-555555555555",
  protocol: "66666666-6666-4666-8666-666666666666",
  item: "77777777-7777-4777-8777-777777777777",
};

function validPayload() {
  return {
    artifact: "sanitario_protocols_v2_canonical_payload",
    artifact_version: "13.0.0-canonical-contract",
    payload: {
      source_rows: [{
        id: ids.source,
        source_key: "SRC_TEST_LABEL",
        kind: "bula",
        scope: "global",
        title: "Fonte sintetica de teste",
        strength: "forte",
        evidence_status: "SIM_BULA",
      }],
      coverage_rows: [{
        id: "88888888-8888-4888-8888-888888888888",
        source_key: "SRC_TEST_LABEL",
        field_key: "dose",
        coverage_status: "covers",
      }],
      product_rows: [{
        id: ids.product,
        product_key: "PRODUCT_TEST",
        nome_comercial: "Produto sintetico de teste",
        classe: "classe_teste",
        tipo_produto: "vacina",
        status_curatorial: "precisa_validar",
        source_keys: ["SRC_TEST_LABEL"],
      }],
      product_authorization_rows: [{
        id: "99999999-9999-4999-8999-999999999999",
        product_key: "PRODUCT_TEST",
        species_code: "bovino",
        authorization_status: "SIM_BULA",
        aptitude: "all",
      }],
      product_source_rows: [{
        product_id: ids.product,
        product_key: "PRODUCT_TEST",
        source_key: "SRC_TEST_LABEL",
        field_key: "dose",
      }],
      dose_rule_rows: [{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        product_key: "PRODUCT_TEST",
        route: "subcutanea",
        dose_quantity: 1,
        dose_unit: "mL",
        dose_basis: "animal",
      }],
      withdrawal_rule_rows: [{
        id: ids.withdrawal,
        withdrawal_rule_key: "WITHDRAWAL_TEST",
        product_key: "PRODUCT_TEST",
        species_code: "bovino",
        aptitude: "corte",
        applicability: "unknown",
        status_curatorial: "precisa_validar",
      }],
      withdrawal_source_rows: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        withdrawal_rule_key: "WITHDRAWAL_TEST",
        source_key: "SRC_TEST_LABEL",
        field_key: "withdrawal",
      }],
      product_class_rows: [{
        id: ids.class,
        class_key: "class_test",
        scope: "global",
        name: "Classe sintetica",
        product_type: "vacina",
        species_scope: ["bovino"],
        curation_status: "needs_review",
        automation_status: "manual_only",
      }],
      product_class_group_rows: [{
        id: ids.group,
        group_key: "GROUP_TEST",
        scope: "global",
        name: "Grupo sintetico",
        curation_status: "needs_review",
        automation_status: "manual_only",
      }],
      product_class_group_member_rows: [{
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        group_key: "GROUP_TEST",
        class_key: "class_test",
      }],
      product_class_default_rule_rows: [{
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        class_key: "class_test",
        species_code: "bovino",
        aptitude: "all",
      }],
      protocol_rows: [{
        id: ids.protocol,
        protocol_key: "PROTOCOL_TEST",
        family_code: "protocol_test",
        name: "Protocolo sintetico",
        scope: "global",
        legal_status: "recomendado_tecnico",
        version: 1,
        status: "draft",
        approval_status: "draft",
      }],
      protocol_item_rows: [{
        id: ids.item,
        protocol_key: "PROTOCOL_TEST",
        logical_item_key: "item_test",
        version: 1,
        item_status: "recomendado",
        action_type: "vacinacao",
        product_requirement_kind: "product_class_group",
        group_key: "GROUP_TEST",
        eligibility_rule: { species: ["bovino"] },
        operational_window_rule: { type: "age" },
        species_authorization: [{ species: "bovino", source_ref: "SRC_TEST_LABEL" }],
        source_refs_by_field: { dose: [{ source_ref: "SRC_TEST_LABEL" }] },
        allows_agenda_auto: false,
      }],
    },
  };
}

function expectInvalid(payload, text) {
  expect(() => validateCanonicalTechnicalContract(payload)).toThrow(text);
}

function payloadWithSourceKey(sourceKey) {
  return JSON.parse(
    JSON.stringify(validPayload()).replaceAll("SRC_TEST_LABEL", sourceKey),
  );
}

describe("sanitario v2 canonical contract", () => {
  it("accepts a complete synthetic payload without database access", () => {
    const result = validateCanonicalTechnicalContract(validPayload());
    expect(result.indexes.protocols.keys.get("PROTOCOL_TEST")).toBe("protocol_rows[0]");
  });

  it.each([
    "SRC_PNCEBT_BRUCELOSE",
    "SRC_BULA_LEPTOFERM5",
  ])("accepts canonical source_key %s", (sourceKey) => {
    expect(() => validateCanonicalTechnicalContract(payloadWithSourceKey(sourceKey)))
      .not.toThrow();
  });

  it.each([
    "src_bula_x",
    "SRC-BULA-X",
    " SRC_X ",
    "SRC_Á",
  ])("rejects non-canonical source_key %s", (sourceKey) => {
    expectInvalid(payloadWithSourceKey(sourceKey), "source_key deve seguir");
  });

  it("accepts canonical class_key vacina_clostridial", () => {
    const payload = validPayload();
    payload.payload.product_class_rows[0].class_key = "vacina_clostridial";
    payload.payload.product_class_group_member_rows[0].class_key = "vacina_clostridial";
    payload.payload.product_class_default_rule_rows[0].class_key = "vacina_clostridial";
    expect(() => validateCanonicalTechnicalContract(payload)).not.toThrow();
  });

  it.each([
    "Vacina_Clostridial",
    "vacina-clostridial",
  ])("rejects non-canonical class_key %s", (classKey) => {
    const payload = validPayload();
    payload.payload.product_class_rows[0].class_key = classKey;
    payload.payload.product_class_group_member_rows[0].class_key = classKey;
    payload.payload.product_class_default_rule_rows[0].class_key = classKey;
    expectInvalid(payload, "class_key deve seguir");
  });

  it.each([
    ["duplicate UUID", (payload) => { payload.payload.product_rows[0].id = ids.source; }, "UUID duplicado"],
    ["duplicate symbolic key", (payload) => { payload.payload.product_rows.push({ ...payload.payload.product_rows[0], id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }); }, "chave simbolica duplicada"],
    ["missing source", (payload) => { payload.payload.protocol_item_rows[0].source_refs_by_field = { dose: [{ source_ref: "SRC_MISSING" }] }; }, "source_key inexistente"],
    ["missing product", (payload) => { payload.payload.protocol_item_rows[0].product_requirement_kind = "specific_product"; payload.payload.protocol_item_rows[0].product_key = "PRODUCT_MISSING"; delete payload.payload.protocol_item_rows[0].group_key; }, "product_key inexistente"],
    ["missing class", (payload) => { payload.payload.product_class_group_member_rows[0].class_key = "CLASS_MISSING"; }, "class_key inexistente"],
    ["missing member group", (payload) => { payload.payload.product_class_group_member_rows[0].group_key = "GROUP_MISSING"; }, "group_key inexistente"],
    ["missing group UUID", (payload) => { delete payload.payload.product_class_group_rows[0].id; }, "UUID estavel explicito obrigatorio"],
    ["missing member UUID", (payload) => { delete payload.payload.product_class_group_member_rows[0].id; }, "UUID estavel explicito obrigatorio"],
    ["duplicate group UUID", (payload) => { payload.payload.product_class_group_rows.push({ ...payload.payload.product_class_group_rows[0], group_key: "GROUP_OTHER" }); }, "UUID duplicado"],
    ["duplicate member UUID", (payload) => { payload.payload.product_class_group_member_rows.push({ ...payload.payload.product_class_group_member_rows[0] }); }, "UUID duplicado"],
    ["duplicate membership", (payload) => { payload.payload.product_class_group_member_rows.push({ ...payload.payload.product_class_group_member_rows[0], id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }); }, "membership duplicado"],
    ["missing group", (payload) => { payload.payload.protocol_item_rows[0].group_key = "GROUP_MISSING"; }, "group_key inexistente"],
    ["missing protocol", (payload) => { payload.payload.protocol_item_rows[0].protocol_key = "PROTOCOL_MISSING"; }, "protocol_key inexistente"],
    ["invalid dose", (payload) => { payload.payload.dose_rule_rows[0].dose_quantity = 0; }, "quantidade deve ser positiva"],
    ["invalid weight interval", (payload) => { payload.payload.dose_rule_rows[0].min_weight_kg = 10; payload.payload.dose_rule_rows[0].max_weight_kg = 1; }, "min_weight_kg maior"],
    ["incomplete withdrawal", (payload) => { payload.payload.withdrawal_rule_rows[0].applicability = "period"; }, "carencia period exige"],
    ["invalid scope", (payload) => { payload.payload.product_class_rows[0].scope = "global"; payload.payload.product_class_rows[0].fazenda_id = ids.protocol; }, "global nao pode"],
    ["incompatible requirement", (payload) => { payload.payload.protocol_item_rows[0].product_requirement_kind = "none"; }, "requirement none"],
    ["missing specific product key", (payload) => { payload.payload.protocol_item_rows[0].product_requirement_kind = "specific_product"; delete payload.payload.protocol_item_rows[0].product_key; delete payload.payload.protocol_item_rows[0].group_key; }, "product_key obrigatoria ausente"],
    ["missing product class key", (payload) => { payload.payload.protocol_item_rows[0].product_requirement_kind = "product_class"; delete payload.payload.protocol_item_rows[0].class_key; delete payload.payload.protocol_item_rows[0].group_key; }, "class_key obrigatoria ausente"],
    ["missing product class group key", (payload) => { delete payload.payload.protocol_item_rows[0].group_key; }, "group_key obrigatoria ausente"],
    ["zero withdrawal without strong source", (payload) => { payload.payload.withdrawal_rule_rows[0].applicability = "zero"; payload.payload.withdrawal_rule_rows[0].source_keys = ["SRC_TEST_LABEL"]; payload.payload.source_rows[0].strength = "apoio"; }, "fonte forte"],
    ["cross scope group", (payload) => { payload.payload.product_class_group_rows[0].scope = "tenant"; payload.payload.product_class_group_rows[0].fazenda_id = ids.protocol; }, "cross-scope"],
  ])("rejects %s before writing", (_name, mutate, message) => {
    const payload = validPayload();
    mutate(payload);
    expectInvalid(payload, message);
  });

  it("preserves identity and resolution on repeated validation", () => {
    const payload = validPayload();
    const first = validateCanonicalTechnicalContract(payload);
    const second = validateCanonicalTechnicalContract(payload);
    expect(second.indexes.products.keys.get("PRODUCT_TEST")).toBe(first.indexes.products.keys.get("PRODUCT_TEST"));
    expect(second.indexes.products.ids.get(ids.product)).toBe(first.indexes.products.ids.get(ids.product));
  });

  it("passes one normalized CanonicalData shape from validation to publication", () => {
    const payload = validPayload();
    const normalized = normalizeCanonicalData(payload);
    const validated = validateCanonicalTechnicalContract(payload);
    expect(validated.data).toEqual(normalized);
    expect(validated.data.product_class_group_rows[0].group_key).toBe("GROUP_TEST");
  });

  it.each([
    "source_rows", "coverage_rows", "product_rows", "product_authorization_rows",
    "dose_rule_rows", "withdrawal_rule_rows", "product_class_rows",
    "product_class_group_rows", "product_class_group_member_rows",
    "product_class_default_rule_rows", "protocol_rows", "protocol_item_rows",
  ])("requires UUID PK for %s", (collection) => {
    const payload = validPayload();
    delete payload.payload[collection][0].id;
    expectInvalid(payload, `${collection}[0].id`);
  });

  it.each(["product_key", "source_key", "field_key"])("requires composite product source key component %s", (field) => {
    const payload = validPayload();
    delete payload.payload.product_source_rows[0][field];
    expectInvalid(payload, `product_source_rows[0].${field}`);
  });

  it("rejects an old artifact version", () => {
    const payload = validPayload();
    payload.artifact_version = "12F10.0-canonical-candidate";
    expectInvalid(payload, "versao esperada");
  });

  it("rejects an identity conflict without preserving the existing id", () => {
    expect(() => assertStableIdentity({ id: ids.source }, { id: ids.product }, "SRC_TEST_LABEL"))
      .toThrow("IDENTITY_CONFLICT");
  });

  it.each([
    ["coverage_status", (p) => delete p.payload.coverage_rows[0].coverage_status],
    ["dose_basis", (p) => delete p.payload.dose_rule_rows[0].dose_basis],
    ["withdrawal species_code", (p) => delete p.payload.withdrawal_rule_rows[0].species_code],
    ["withdrawal aptitude", (p) => delete p.payload.withdrawal_rule_rows[0].aptitude],
    ["withdrawal applicability", (p) => delete p.payload.withdrawal_rule_rows[0].applicability],
    ["item eligibility_rule", (p) => delete p.payload.protocol_item_rows[0].eligibility_rule],
    ["item operational_window_rule", (p) => delete p.payload.protocol_item_rows[0].operational_window_rule],
    ["item species_authorization", (p) => delete p.payload.protocol_item_rows[0].species_authorization],
    ["class curation_status", (p) => delete p.payload.product_class_rows[0].curation_status],
    ["group automation_status", (p) => delete p.payload.product_class_group_rows[0].automation_status],
    ["default rule species_code", (p) => delete p.payload.product_class_default_rule_rows[0].species_code],
  ])("requires schema column %s", (_name, mutate) => {
    const payload = validPayload();
    mutate(payload);
    expectInvalid(payload, "obrigatorio ausente");
  });

  it("requires a valid UUID for fazenda_id when scope demands it", () => {
    const payload = validPayload();
    payload.payload.product_class_rows[0].scope = "tenant";
    payload.payload.product_class_rows[0].fazenda_id = "fazenda-01";
    expectInvalid(payload, "fazenda_id exige UUID valido");
  });

  it("rejects a payload carrying both modern and legacy representations", () => {
    const payload = validPayload();
    payload.payload.sanitario_protocolos_v2 = { rows: [] };
    expect(() => validateCanonicalTechnicalContract(payload)).toThrow("Representacao dupla");
  });

  function realFormPayload() {
    return {
      artifact_version: "13.0.0-canonical-contract",
      import_gate: { import_real_authorized: false },
      payload: {
        sanitario_fontes_tecnicas_v2: { rows: [{
          id: ids.source,
          source_key: "SRC_TEST_LABEL",
          kind: "bula",
          scope: "global",
          title: "Fonte sintetica de teste",
          strength: "forte",
          evidence_status: "SIM_BULA",
        }] },
        sanitario_product_classes_v2: { rows: [{
          id: ids.class,
          class_key: "class_test",
          scope: "global",
          name: "Classe sintetica",
          product_type: "vacina",
          species_scope: ["bovino"],
          curation_status: "needs_review",
          automation_status: "manual_only",
        }] },
        sanitario_protocolos_v2: { rows: [{
          id: ids.protocol,
          family_code: "protocol_test",
          name: "Protocolo sintetico",
          scope: "global",
          fazenda_id: null,
          legal_status: "recomendado_tecnico",
          version: 1,
          status: "draft",
          approval_status: "draft",
        }] },
        sanitario_protocolo_itens_versions_v2: { rows: [
          {
            id: ids.item,
            protocol_id: "{{lookup sanitario_protocolos_v2.id by family_code=protocol_test}}",
            logical_item_key: "item_class_test",
            version: 1,
            item_status: "recomendado",
            action_type: "vacinacao",
            product_requirement_kind: "product_class",
            product_id: null,
            product_class: "class_test",
            product_class_group_id: null,
            eligibility_rule: { species: ["bovino"] },
            operational_window_rule: { type: "age" },
            species_authorization: [{ species: "bovino", source_ref: "SRC_TEST_LABEL" }],
            source_refs_by_field: { dose: [{ source_ref: "SRC_TEST_LABEL" }] },
            allows_agenda_auto: false,
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            protocol_id: "{{lookup sanitario_protocolos_v2.id by family_code=protocol_test}}",
            logical_item_key: "item_group_test",
            version: 1,
            item_status: "recomendado",
            action_type: "vacinacao",
            product_requirement_kind: "product_class_group",
            product_id: null,
            product_class: null,
            product_class_group_id: "{{lookup sanitario_product_class_groups_v2.id by group_key=GROUP_TEST}}",
            eligibility_rule: { species: ["bovino"] },
            operational_window_rule: { type: "age" },
            species_authorization: [{ species: "bovino", source_ref: "SRC_TEST_LABEL" }],
            source_refs_by_field: { dose: [{ source_ref: "SRC_TEST_LABEL" }] },
            allows_agenda_auto: false,
          },
        ] },
        sanitario_product_class_groups_v2: { rows: [{
          id: ids.group,
          group_key: "GROUP_TEST",
          scope: "global",
          name: "Grupo sintetico",
          curation_status: "needs_review",
          automation_status: "manual_only",
        }] },
      },
    };
  }

  it("normalizes the real sanitario_*_v2.rows artifact into canonical keys", () => {
    const payload = realFormPayload();
    const normalized = normalizeCanonicalData(payload);
    expect(normalized.protocol_rows[0].protocol_key).toBe("protocol_test");
    expect(normalized.protocol_item_rows[0].protocol_key).toBe("protocol_test");
    expect(normalized.protocol_item_rows[0].class_key).toBe("class_test");
    expect(normalized.protocol_item_rows[1].protocol_key).toBe("protocol_test");
    expect(normalized.protocol_item_rows[1].group_key).toBe("GROUP_TEST");
    expect(normalizeCanonicalData(payload).memberRejections).toEqual([]);
  });

  it("validates and cleans lookup placeholders from the real artifact shape", () => {
    const payload = realFormPayload();
    const validated = validateCanonicalTechnicalContract(payload);
    const itemClass = validated.data.protocol_item_rows[0];
    expect(itemClass.protocol_key).toBe("protocol_test");
    expect(itemClass.class_key).toBe("class_test");
    expect(itemClass).not.toHaveProperty("protocol_id");
    expect(itemClass).not.toHaveProperty("product_class");
    expect(JSON.stringify(validated.data)).not.toContain("{{lookup");
  });

  it("rejects an artificial UUID injected into a lookup placeholder", () => {
    const payload = realFormPayload();
    payload.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id = "123e4567-e89b-42d3-a456-426614174000";
    expect(() => validateCanonicalTechnicalContract(payload)).toThrow("UUID artificial");
  });

  it("materializes the C0.3 product classes with stable global identity", () => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    const normalized = normalizeCanonicalData(payload);
    const classes = normalized.product_class_rows;
    const requiredClassKeys = [
      "vacina_brucelose_b19",
      "vacina_clostridial",
      "vacina_raiva_herbivoros",
      "vacina_leptospirose",
      "lactonas_macrociclicas",
      "benzimidazois",
      "imidazotiazoleis",
    ];

    expect(classes).toHaveLength(8);
    expect(payload.counts.product_classes).toBe(classes.length);
    expect(new Set(classes.map((row) => row.id)).size).toBe(classes.length);
    expect(new Set(classes.map((row) => row.class_key)).size).toBe(classes.length);
    expect(classes.every((row) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id))).toBe(true);
    expect(classes.every((row) => row.scope === "global" && row.fazenda_id === null)).toBe(true);
    expect(requiredClassKeys.every((classKey) => classes.some((row) => row.class_key === classKey))).toBe(true);
  });

  it("keeps IBR/BVD restricted and antiparasitic associations outside ProductClass", () => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    const normalized = normalizeCanonicalData(payload);
    const classKeys = new Set(normalized.product_class_rows.map((row) => row.class_key));
    const ibrBvd = normalized.product_class_rows.find((row) => row.class_key === "vacina_ibr_bvd");
    const classItems = normalized.protocol_item_rows.filter((row) => row.product_requirement_kind === "product_class");

    expect(ibrBvd).toMatchObject({
      scope: "global",
      fazenda_id: null,
      curation_status: "needs_review",
      automation_status: "manual_only",
    });
    expect(ibrBvd.limitations).toEqual(expect.arrayContaining([
      "requires_real_product",
      "product_specific_composition",
      "product_specific_schedule",
      "product_specific_reproductive_restrictions",
      "withdrawal_by_executed_product",
      "do_not_generalize_product_label",
    ]));
    expect(ibrBvd.metadata.can_validate_execution).toBe(false);
    expect(classKeys.has("associacoes_antiparasitarias")).toBe(false);
    expect(normalized.product_class_group_member_rows).toHaveLength(12);
    expect(normalized.product_class_group_member_rows.some((row) => row.class_key === "associacoes_antiparasitarias")).toBe(false);
    expect(classItems.every((item) => classKeys.has(item.class_key))).toBe(true);
    expect(classItems.filter((item) => item.class_key === "vacina_ibr_bvd").map((item) => item.logical_item_key)).toEqual([
      "ibr_bvd_primovac_dose1",
      "ibr_bvd_primovac_dose2",
    ]);
  });

  it("keeps C0.4 group and member identities explicit, unique, and referentially complete", () => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    const normalized = normalizeCanonicalData(payload);
    const groups = normalized.product_class_group_rows;
    const members = normalized.product_class_group_member_rows;
    const classes = new Map(normalized.product_class_rows.map((row) => [row.class_key, row]));
    const groupKeys = [
      "pcg_antiparasitarios_recria_estrategicos",
      "pcg_antiparasitarios_bezerros_pre_desmama",
      "pcg_antiparasitarios_pre_confinamento",
      "pcg_antiparasitarios_matrizes_pre_parto",
    ];
    const memberClasses = ["lactonas_macrociclicas", "benzimidazois", "imidazotiazoleis"];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const groupIdentity = new Map(groups.map((row) => [row.group_key, row.id]));
    const memberIdentity = new Map(members.map((row) => [`${row.group_key}:${row.class_key}`, row.id]));

    expect(groups).toHaveLength(4);
    expect([...groupIdentity.keys()].sort()).toEqual([...groupKeys].sort());
    expect(groups.every((row) => uuid.test(row.id) && row.scope === "global" && row.fazenda_id === null)).toBe(true);
    expect(new Set(groupIdentity.values()).size).toBe(4);
    expect(members).toHaveLength(12);
    expect(memberIdentity.size).toBe(12);
    expect(members.every((row) => uuid.test(row.id) && groupIdentity.has(row.group_key) && classes.get(row.class_key)?.scope === "global")).toBe(true);
    expect(new Set(memberIdentity.values()).size).toBe(12);
    for (const groupKey of groupKeys) {
      for (const classKey of memberClasses) expect(memberIdentity.has(`${groupKey}:${classKey}`)).toBe(true);
    }
    const again = normalizeCanonicalData(payload);
    expect(new Map(again.product_class_group_rows.map((row) => [row.group_key, row.id]))).toEqual(groupIdentity);
    expect(new Map(again.product_class_group_member_rows.map((row) => [`${row.group_key}:${row.class_key}`, row.id]))).toEqual(memberIdentity);

    const rejections = normalized.memberRejections;
    expect(rejections).toHaveLength(4);
    expect(rejections.map((row) => row.group_key).sort()).toEqual([...groupKeys].sort());
    expect(rejections.every((row) => row.class_key === "associacoes_antiparasitarias" && row.reason === "NOT_A_CLASS_CONFIRMED")).toBe(true);
    expect(payload.import_gate.blocked_reasons).toEqual([
      "IMPORT_REAL_NOT_AUTHORIZED",
      "CATALOG_APPROVAL_NOT_GRANTED",
      "AGENDA_AUTOMATION_NOT_ALLOWED",
    ]);
    expect(payload.import_gate.import_real_authorized).toBe(false);
  });

  it("materializes C0.5 VERSIONED_EXPLICIT_UUID identities without orphans or regeneration", () => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    const before = JSON.stringify(payload);
    const rawProtocols = payload.payload.sanitario_protocolos_v2.rows;
    const rawItems = payload.payload.sanitario_protocolo_itens_versions_v2.rows;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const parents = new Map(rawProtocols.map((row) => [row.protocol_key, row.id]));
    const mapping = {
      protocols: rawProtocols.map((row) => [row.protocol_key, row.id]).sort(),
      items: rawItems.map((row) => [row.protocol_key, row.logical_item_key, row.version, row.id, row.protocol_id]).sort(),
    };

    expect(payload.identity_model).toBe("VERSIONED_EXPLICIT_UUID");
    expect(rawProtocols).toHaveLength(10);
    expect(parents.size).toBe(10);
    expect(new Set(parents.values()).size).toBe(10);
    expect(rawProtocols.every((row) => uuid.test(row.id) && row.protocol_key === row.family_code && row.version === 1)).toBe(true);
    expect(rawItems).toHaveLength(20);
    expect(new Set(rawItems.map((row) => row.id)).size).toBe(20);
    expect(rawItems.every((row) => uuid.test(row.id) && uuid.test(row.protocol_id) && row.version === 1 && parents.get(row.protocol_key) === row.protocol_id)).toBe(true);
    // Permanent mapping: changing any UUID, parent, key or item version requires explicit review.
    expect(createHash("sha256").update(JSON.stringify(mapping)).digest("hex"))
      .toBe("187b4c0c6d4957aadd4b896edd3908b2d9096e364b503c4c4f0a517f5d5aa6b1");
    expect(payload.payload.sanitario_protocolo_itens_versions_v2.defaults).not.toHaveProperty("protocol_id");

    for (let replay = 0; replay < 2; replay += 1) {
      const fresh = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
      const { data } = validateCanonicalTechnicalContract(fresh);
      expect(data.protocol_rows).toEqual(rawProtocols);
      expect(data.protocol_item_rows.map((row) => [row.protocol_key, row.logical_item_key, row.version, row.id, row.protocol_id]).sort()).toEqual(mapping.items);
      for (const item of data.protocol_item_rows) {
        const physical = itemInsertRow(item, parents.get(item.protocol_key), null);
        expect(physical.id).toBe(item.id);
        expect(physical.protocol_id).toBe(item.protocol_id);
      }
      expect(JSON.stringify(fresh)).toBe(before);
    }
    expect(JSON.stringify(payload)).toBe(before);
  });

  it("preserves all C0.4 content outside the materialized identity fields", () => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    delete payload.identity_model;
    for (const row of payload.payload.sanitario_protocolos_v2.rows) {
      delete row.id;
      delete row.protocol_key;
    }
    for (const row of payload.payload.sanitario_protocolo_itens_versions_v2.rows) {
      delete row.id;
      delete row.protocol_key;
      delete row.protocol_id;
    }
    delete payload.payload.sanitario_protocolo_itens_versions_v2.defaults.protocol_id;
    // Digest captured from e5dde1c before C0.5: sanitary content, classes, groups, members and gates.
    expect(createHash("sha256").update(JSON.stringify(payload)).digest("hex"))
      .toBe("6bdd48bb615518802f395be82fc2d20a77288f196e695ff621da9abba3f93fe6");
  });

  it.each([
    ["missing protocol UUID", (p) => { delete p.payload.sanitario_protocolos_v2.rows[0].id; }, "protocol_rows[0].id"],
    ["missing item UUID", (p) => { delete p.payload.sanitario_protocolo_itens_versions_v2.rows[0].id; }, "protocol_item_rows[0].id"],
    ["duplicate protocol UUID", (p) => { p.payload.sanitario_protocolos_v2.rows[1].id = p.payload.sanitario_protocolos_v2.rows[0].id; }, "UUID duplicado"],
    ["duplicate item UUID", (p) => { p.payload.sanitario_protocolo_itens_versions_v2.rows[1].id = p.payload.sanitario_protocolo_itens_versions_v2.rows[0].id; }, "UUID duplicado"],
    ["missing explicit protocol key", (p) => { delete p.payload.sanitario_protocolos_v2.rows[0].protocol_key; }, "protocol_key"],
    ["missing explicit parent UUID", (p) => { delete p.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id; }, "UUID explicito do protocolo pai obrigatorio"],
    ["orphan item", (p) => { p.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id = ids.protocol; }, "protocol_id inexistente"],
    ["wrong parent UUID", (p) => { p.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id = p.payload.sanitario_protocolos_v2.rows[1].id; }, "UUID nao corresponde"],
    ["duplicate logical identity", (p) => { const rows = p.payload.sanitario_protocolo_itens_versions_v2.rows; rows[2].logical_item_key = rows[1].logical_item_key; }, "identidade de item duplicada"],
    ["obsolete protocol lookup", (p) => { p.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id = "{{lookup sanitario_protocolos_v2.id by family_code=brucelose_b19}}"; }, "UUID explicito do protocolo pai obrigatorio"],
    ["identity generation model", (p) => { p.identity_model = "RUNTIME_UUID"; }, "modelo esperado VERSIONED_EXPLICIT_UUID"],
  ])("rejects C0.5 %s without generating identities", (_name, mutate, message) => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    mutate(payload);
    const before = JSON.stringify(payload);
    expectInvalid(payload, message);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it.each(["sanitario_protocolos_v2", "sanitario_protocolo_itens_versions_v2"])("rejects replacing a canonical UUID in %s", (collection) => {
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    const canonical = payload.payload[collection].rows[0];
    expect(() => assertStableIdentity({ id: ids.protocol }, canonical, canonical.protocol_key))
      .toThrow("IDENTITY_CONFLICT");
  });

  it("builds physical rows purely from canonical fields without lookup placeholders", () => {
    const validated = validateCanonicalTechnicalContract(realFormPayload());
    const canonicalItem = validated.data.protocol_item_rows.find((item) => item.logical_item_key === "item_group_test");
    const row = itemInsertRow(canonicalItem, "protocol-uuid", "group-uuid");
    expect(row.protocol_id).toBe("protocol-uuid");
    expect(row.product_class).toBeNull();
    expect(row.product_class_group_id).toBe("group-uuid");
    expect(JSON.stringify(row)).not.toContain("{{lookup");
  });

  it("blocks --apply while the publisher is incomplete", () => {
    expect(applyGateError(realFormPayload(), false)).toMatch("PUBLISHER_INCOMPLETE");
  });

  it("blocks --apply while the artifact gate is closed even with a complete publisher", () => {
    expect(applyGateError(realFormPayload(), true)).toMatch("IMPORT_REAL_NOT_AUTHORIZED");
  });

  it("allows --apply only with complete publisher and open artifact gate", () => {
    const payload = realFormPayload();
    payload.import_gate = { import_real_authorized: true };
    expect(applyGateError(payload, true)).toBeNull();
  });

  function runImportScript(flags, env = process.env) {
    const result = spawnSync(process.execPath, [IMPORT_SCRIPT, ...flags], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      code: result.status ?? 1,
      stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
  }

  it("blocks the actual apply gate without invoking --apply or accessing a database", () => {
    // Exercise the guard used before connectDb; P1 does not authorize CLI --apply.
    const payload = JSON.parse(readFileSync(CANONICAL_PAYLOAD, "utf8"));
    expect(() => assertApplyGate(payload)).toThrow("IMPORT_REAL_NOT_AUTHORIZED");
    const script = readFileSync(IMPORT_SCRIPT, "utf8");
    const mainBody = script.slice(script.indexOf("async function main()"));
    expect(mainBody.indexOf("assertApplyGate(payload)")).toBeGreaterThan(-1);
    expect(mainBody.indexOf("assertApplyGate(payload)")).toBeLessThan(mainBody.indexOf("await connectDb(mode)"));
  });

  it("validates the materialized artifact with the publisher gate closed and without database access", () => {
    const result = runImportScript(["--validate"], { ...process.env, DB_URL: "" });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("12G validate OK");
    expect(result.stdout).toContain('"publisher_complete": true');
    expect(result.stdout).toContain('"execute_import": false');
    expect(result.stdout).not.toMatch(/ENOENT|DB_URL|pg_advisory/);
  });
});