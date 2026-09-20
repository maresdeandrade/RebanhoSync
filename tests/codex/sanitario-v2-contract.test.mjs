import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertStableIdentity,
  normalizeCanonicalData,
  validateCanonicalTechnicalContract,
} from "../../scripts/codex/sanitario-v2-contract.mjs";
import {
  applyGateError,
  itemInsertRow,
} from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const IMPORT_SCRIPT = fileURLToPath(
  new URL("../../scripts/codex/import-sanitario-protocols-v2.mjs", import.meta.url),
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
        class_key: "CLASS_TEST",
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
        class_key: "CLASS_TEST",
      }],
      product_class_default_rule_rows: [{
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        class_key: "CLASS_TEST",
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

describe("sanitario v2 canonical contract", () => {
  it("accepts a complete synthetic payload without database access", () => {
    const result = validateCanonicalTechnicalContract(validPayload());
    expect(result.indexes.protocols.keys.get("PROTOCOL_TEST")).toBe("protocol_rows[0]");
  });

  it.each([
    ["duplicate UUID", (payload) => { payload.payload.product_rows[0].id = ids.source; }, "UUID duplicado"],
    ["duplicate symbolic key", (payload) => { payload.payload.product_rows.push({ ...payload.payload.product_rows[0], id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }); }, "chave simbolica duplicada"],
    ["missing source", (payload) => { payload.payload.protocol_item_rows[0].source_refs_by_field = { dose: [{ source_ref: "SRC_MISSING" }] }; }, "source_key inexistente"],
    ["missing product", (payload) => { payload.payload.protocol_item_rows[0].product_requirement_kind = "specific_product"; payload.payload.protocol_item_rows[0].product_key = "PRODUCT_MISSING"; delete payload.payload.protocol_item_rows[0].group_key; }, "product_key inexistente"],
    ["missing class", (payload) => { payload.payload.product_class_group_member_rows[0].class_key = "CLASS_MISSING"; }, "class_key inexistente"],
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
          class_key: "CLASS_TEST",
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
            product_class: "CLASS_TEST",
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
    expect(normalized.protocol_item_rows[0].class_key).toBe("CLASS_TEST");
    expect(normalized.protocol_item_rows[1].protocol_key).toBe("protocol_test");
    expect(normalized.protocol_item_rows[1].group_key).toBe("GROUP_TEST");
    expect(normalizeCanonicalData(payload).memberRejections).toEqual([]);
  });

  it("validates and cleans lookup placeholders from the real artifact shape", () => {
    const payload = realFormPayload();
    const validated = validateCanonicalTechnicalContract(payload);
    const itemClass = validated.data.protocol_item_rows[0];
    expect(itemClass.protocol_key).toBe("protocol_test");
    expect(itemClass.class_key).toBe("CLASS_TEST");
    expect(itemClass).not.toHaveProperty("protocol_id");
    expect(itemClass).not.toHaveProperty("product_class");
    expect(JSON.stringify(validated.data)).not.toContain("{{lookup");
  });

  it("rejects an artificial UUID injected into a lookup placeholder", () => {
    const payload = realFormPayload();
    payload.payload.sanitario_protocolo_itens_versions_v2.rows[0].protocol_id = "123e4567-e89b-42d3-a456-426614174000";
    expect(() => validateCanonicalTechnicalContract(payload)).toThrow("UUID artificial");
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

  it("blocks the real CLI --apply before any database access", () => {
    const result = runImportScript(["--apply"], { ...process.env, DB_URL: "" });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toContain("PUBLISHER_INCOMPLETE");
    expect(result.stdout).not.toMatch(/ENOENT|DB_URL/);
  });

  it("fails real CLI --validate on artifact content without supabase connection", () => {
    const result = runImportScript(["--validate"], { ...process.env, DB_URL: "" });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toContain("Contrato canonico v2 invalido");
    expect(result.stdout).not.toMatch(/ENOENT|DB_URL|pg_advisory/);
  });
});
