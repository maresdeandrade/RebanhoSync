// Review-only consolidation of documentary fields and observed canonical receipts.
// Never writes to a database, promotes status or substitutes the operational catalog.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DIR = "docs/review/evidence/";
const read = name => JSON.parse(readFileSync(DIR + name, "utf8"));
const conflicts = new Set(["P33:milk", "P40:composition", "P40:meat", "P40:milk"]);

export function classifyDocumentedField(cell, { primaryEvidence = false } = {}) {
  if (cell.field === "registration") {
    if (!cell.value) return "SEM_EVIDENCIA";
    if (!["Ativo", "VIGENTE"].includes(cell.value.status)) return "DIVERGENTE";
    if (cell.value.expires) {
      const [d,m,y] = cell.value.expires.split("/");
      if (`${y}-${m}-${d}` < "2026-10-29") return "DIVERGENTE";
    }
    return primaryEvidence ? "CONFIRMADO" : "SEM_EVIDENCIA";
  }
  if (conflicts.has(cell.code + ":" + cell.field)) return "DIVERGENTE";
  if (cell.code === "P41" && cell.field === "composition") return "SEM_EVIDENCIA";
  return cell.value == null || !primaryEvidence ? "SEM_EVIDENCIA" : "CONFIRMADO";
}

// Five documented fragments are deliberately not projected into incomplete dose rules.
const unstructuredPrimary = {
  "P06:dose": { url: "https://www.msd-saude-animal.com.br/produto/bovilis-poli-star-t/", locator: "Resumo da bula, Dosagem: bovinos 5 mL; via primária não expressa." },
  "P40:dose": { url: "https://ruminantes.ceva.com.br/products/combo-pour-on/", locator: "Como usar: 10 mL/100 kg, máximo 60 mL acima de 600 kg." },
  "P40:route": { url: "https://ruminantes.ceva.com.br/products/combo-pour-on/", locator: "Como usar: pour-on." },
  "P41:dose": { url: "https://www.msd-saude-animal.com.br/produto/butox-p-ce25/", locator: "Resumo da bula: bovinos, 10 mL/10 L de água; calda mínima 5 L por adulto." },
  "P41:route": { url: "https://www.msd-saude-animal.com.br/produto/butox-p-ce25/", locator: "Resumo da bula: uso externo diluído, pulverização/aspersão." },
};
function primaryProof(cell, rows) {
  const field = { species: "species_authorization", restrictions: "species_authorization", meat: "withdrawal", milk: "withdrawal" }[cell.field] ?? cell.field;
  if (unstructuredPrimary[cell.code + ":" + cell.field]) {
    cell.documentary_primary_reference = unstructuredPrimary[cell.code + ":" + cell.field];
    return true;
  }
  return cell.source_ids.some(id => {
    const source = rows.sanitario_fontes_tecnicas_v2.find(s => s.id === id && !s.deleted_at);
    if (!source?.url || !/^(https:\/\/)([^/]+\.)?(zoetis\.com\.br|msd-saude-animal\.com\.br|ceva\.com\.br|ceva\.com|labovet\.com\.br|agricultura\.gov\.br)\//i.test(source.url)) return false;
    return rows.sanitario_fonte_cobertura_campos_v2.some(c => c.source_id === id && c.field_key === field && c.coverage_status === "covers" && !c.deleted_at) &&
      rows.sanitario_produto_fontes_v2.some(l => l.product_id === cell.product_id && l.source_id === id && l.field_key === field);
  });
}

export function reconcileClosure() {
  const matrix = read("SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json");
  const candidate = read("SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_20261029.json");
  const result = read("SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json");
  const rows = result.snapshot.rows;
  if (result.apply.create !== 43 || result.apply.update !== 0 || result.apply.approved !== 0 || result.replay.skip !== 85 || !result.replay.replay)
    throw new Error("F6_RECEIPT_MISMATCH");
  if (!Object.values(result.postconditions).every(c => c.all_previous_rows_unchanged)) throw new Error("F6_PREVIOUS_ROWS_CHANGED");
  for (const cell of matrix.cells) {
    if (cell.status !== classifyDocumentedField(cell, { primaryEvidence: primaryProof(cell, rows) })) throw new Error("F6_CLASSIFICATION_DRIFT:" + cell.code + ":" + cell.field);
    if (cell.status !== "CONFIRMADO" && !cell.reason) throw new Error("F6_EXCEPTION_REASON_REQUIRED");
    cell.persisted_after = cell.persisted_before;
    if (cell.field === "registration" && cell.status === "CONFIRMADO") {
      const ref = candidate.payload.product_rows.find(p => p.id === cell.product_id);
      const link = candidate.payload.product_source_rows.find(l => l.product_key === ref.product_key && l.field_key === "registration");
      const source = candidate.payload.source_rows.find(s => s.source_key === link?.source_key);
      const coverage = rows.sanitario_fonte_cobertura_campos_v2.find(c => c.source_id === source?.id && c.field_key === "registration" && c.coverage_status === "covers" && !c.deleted_at);
      const identity = coverage && JSON.parse(coverage.notes).find(r => r.product_id === cell.product_id);
      if (!source || !identity || identity.registration !== cell.value.registration || identity.holder !== cell.value.holder ||
        !rows.sanitario_produto_fontes_v2.some(l => l.product_id === cell.product_id && l.source_id === source.id && l.field_key === "registration"))
        throw new Error("F6_INDIVIDUAL_REGISTRATION_PROVENANCE_MISSING:" + cell.code);
      cell.persisted_after = true;
      cell.source_ids = [...new Set([...cell.source_ids, source.id])];
      cell.persistence = "Vínculo documental produto/fonte/registration e identidade na cobertura. registro_numero e metadata do cadastro preservados.";
    }
    const productRef = candidate.payload.product_rows.find(p => p.id === cell.product_id);
    for (const link of candidate.payload.product_source_rows.filter(l => l.product_key === productRef.product_key &&
      l.field_key === ({ species: "species_authorization", meat: "withdrawal", milk: "withdrawal" }[cell.field] ?? cell.field))) {
      const source = candidate.payload.source_rows.find(s => s.source_key === link.source_key);
      if (source) cell.source_ids = [...new Set([...cell.source_ids, source.id])];
    }
  }
  matrix.counts = Object.fromEntries(["CONFIRMADO", "DIVERGENTE", "SEM_EVIDENCIA"].map(status => [status, matrix.cells.filter(c => c.status === status).length]));
  matrix.confirmed_persisted_after = matrix.cells.filter(c => c.status === "CONFIRMADO" && c.persisted_after).length;
  delete matrix.confirmed_persisted_projected_after;
  matrix.receipt = "SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json";
  matrix.persistence_observed_at = result.snapshot.captured_at;
  matrix.exceptions = matrix.cells.filter(c => c.status !== "CONFIRMADO");
  return matrix;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const matrix = reconcileClosure();
  writeFileSync(DIR + "SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json", JSON.stringify(matrix, null, 2) + "\n");
  const fields = ["composition", "presentation", "dose", "route", "species", "restrictions", "meat", "milk", "registration"];
  const products = [...new Set(matrix.cells.map(c => c.code))];
  const csv = [["codigo", "produto", ...fields.flatMap(f => [f + "_status", f + "_valor", f + "_persistido"])]];
  const table = ["| Produto | Composição | Apresentação | Dose | Via | Espécie | Restrições | Carne | Leite | Registro |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const code of products) {
    const cells = fields.map(f => matrix.cells.find(c => c.code === code && c.field === f));
    csv.push([code, cells[0].product, ...cells.flatMap(c => [c.status, JSON.stringify(c.value), String(c.persisted_after)])]);
    table.push("| " + [code + " — " + cells[0].product, ...cells.map(c => ({ CONFIRMADO: "C", DIVERGENTE: "D", SEM_EVIDENCIA: "S" }[c.status]))].join(" | ") + " |");
  }
  writeFileSync(DIR + "SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.csv", csv.map(row => row.map(v => '"' + String(v).replaceAll('"','""') + '"').join(",")).join("\n") + "\n");
  const exceptions = [["codigo", "produto", "campo", "estado", "motivo", "acao_necessaria"], ...matrix.exceptions.map(c => [c.code, c.product, c.field, c.status, c.reason,
    c.field === "registration" ? "Obter confirmação MAPA do registro individual ou identificar licença nacional correta; não substituir por fabricante/produto homônimo."
      : c.status === "DIVERGENTE" ? "Obter bula nacional reconciliada do fabricante para o campo/contexto específico."
      : "Obter declaração primária explícita do campo/contexto; não preencher por analogia ou ausência."] )];
  writeFileSync(DIR + "SANITARIO_V2_C02_F6_CLOSURE_EXCEPTIONS_20261029.csv", exceptions.map(row => row.map(v => '"' + String(v).replaceAll('"','""') + '"').join(",")).join("\n") + "\n");
  writeFileSync(DIR + "SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.md", "# Matriz única F6 — 39 produtos\n\nC = CONFIRMADO documental; D = DIVERGENTE; S = SEM_EVIDENCIA suficiente. Recorte bovino explicitado; C não libera operação. Nove campos comuns por produto; subcampos suplementares não entram duas vezes nos totais. Valores, fontes, representação e motivos estão no JSON/CSV homônimo.\n\n" + table.join("\n") + "\n");
  console.log(JSON.stringify({ products: matrix.products, fields: matrix.total_fields, counts: matrix.counts, persisted_before: matrix.confirmed_persisted_before, persisted_after: matrix.confirmed_persisted_after }));
}
