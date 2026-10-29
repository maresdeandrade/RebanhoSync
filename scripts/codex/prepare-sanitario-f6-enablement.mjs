// Local readiness projection of the frozen F6 receipts. Never activates remote rows.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const dir = "docs/review/evidence/";
const read = name => JSON.parse(readFileSync(dir + name, "utf8"));
const strong = s => s && !s.deleted_at && s.scope === "global" && s.strength === "forte" && ["SIM_BULA","SIM_NORMA"].includes(s.evidence_status);

export function buildF6Enablement(rows, matrix) {
  const products = matrix.cells.filter(c => c.field === "registration");
  const result = [];
  function sources(productId, field, ruleId = null) {
    const ids = rows.sanitario_produto_fontes_v2.filter(l => l.product_id === productId && l.field_key === field)
      .filter(l => !ruleId || rows.sanitario_produto_carencia_fontes_v2.some(w => w.withdrawal_rule_id === ruleId && w.source_id === l.source_id && w.field_key === "withdrawal"))
      .map(l => l.source_id);
    return [...new Set(ids)].map(id => rows.sanitario_fontes_tecnicas_v2.find(s => s.id === id))
      .filter(s => s && !s.deleted_at && rows.sanitario_fonte_cobertura_campos_v2.some(c => c.source_id === s.id && c.field_key === field && !c.deleted_at && c.coverage_status === "covers"));
  }
  for (const product of products) for (const [purpose, aptitude] of [["meat","corte"],["milk","leite"]]) {
    const rules = rows.sanitario_produto_carencia_rules_v2.filter(r => r.product_id === product.product_id && r.aptitude === aptitude && !r.deleted_at);
    for (const rule of rules.length ? rules : [null]) {
      const reasons = [], actions = [];
      let state = "ELEGIVEL";
      const restrict = (reason, action) => { state = "RESTRITO"; reasons.push(reason); actions.push(action); };
      const incomplete = (reason, action) => { if (state !== "RESTRITO") state = "INCOMPLETO"; reasons.push(reason); actions.push(action); };
      const cell = matrix.cells.find(c => c.product_id === product.product_id && c.field === purpose);
      if (["P03","P16","P25"].includes(product.code)) restrict("registro_individual_cancelado", "Comprovar licença vigente do mesmo produto antes de uso; não substituir por homônimo.");
      else if (product.status !== "CONFIRMADO") incomplete(product.code === "P06" ? "identidade_da_licenca_a_confirmar" : "vigencia_individual_nao_confirmada", "Resolver somente a identidade/vigência individual indicada na exceção regulatória.");
      if (cell.status === "DIVERGENTE") restrict("divergencia_material_" + purpose, "Reconciliar somente a bula/valor dessa finalidade; não bloquear a outra finalidade por essa divergência.");
      if (rule?.applicability === "not_permitted") restrict("uso_na_finalidade_nao_permitido", "Manter a proibição explícita dessa finalidade; nenhuma ativação permissiva.");
      if (!rule) incomplete("regra_da_finalidade_ausente", "Obter prazo/proibição explícito da finalidade; não inferir zero.");
      if (rule && rule.applicability !== "not_permitted") {
        if (!rule.route) incomplete("via_da_regra_nao_delimitada", "Preparar versão restrita à via comprovada antes de ativar uma regra hoje sem via; preservar a identidade/histórico anteriores.");
        const proof = sources(product.product_id, "withdrawal", rule.id).filter(strong);
        if (proof.length !== 1) incomplete(proof.length ? "prova_da_regra_ambigua" : "prova_forte_da_regra_ausente", "Conferir cobertura withdrawal e vínculo forte da regra selecionada; não basta fonte do produto.");
        for (const field of ["dose","route","species_authorization"]) {
          const proof = sources(product.product_id, field);
          if (proof.length !== 1 || !strong(proof[0])) incomplete("prova_" + field + (proof.length > 1 ? "_ambigua" : "_insuficiente"), "Delimitar cobertura primária única do campo " + field + " no contrato existente.");
        }
        const doses = rows.sanitario_produto_dose_rules_v2.filter(d => d.product_id === product.product_id && !d.deleted_at && (!rule.route || d.route === rule.route));
        if (!doses.length) incomplete("dose_via_sem_representacao", "Representar dose/via sem perder teto, diluição ou contexto já documentados.");
        if (product.code === "P38") incomplete("contexto_clinico_da_autorizacao_a_qualificar", "Qualificar a autorização pendente com as precauções P12073 V00 já conhecidas: segurança não avaliada abaixo de cinco meses, sensibilidade e orientação MV; não inventar conversão mensal em dias ou proibição mais ampla.");
      }
      result.push({ code: product.code, product_id: product.product_id, product: product.product, purpose,
        rule_id: rule?.id ?? null, route: rule?.route ?? null, applicability: rule?.applicability ?? "unknown", period_days: purpose === "meat" ? rule?.meat_days ?? null : rule?.milk_days ?? null,
        state, reasons: [...new Set(reasons)], minimum_actions: [...new Set(actions)],
        clinical_scope: product.code === "P11" ? "Bovinos de corte, SC, 1 mL/50 kg; excluir produtoras de leite para consumo humano; respeitar bula ART-21644 v2." : "Somente espécie, aptidão, via e restrições da fonte específica; não extrapolar contexto.",
        currently_enabled: false, administrative_action_if_eligible: state === "ELEGIVEL" ? "Após publicação compatível, decisão curatorial específica e versionada; não promover versões sobrepostas ou autorização ampla." : null });
    }
  }
  return { scope: "Prontidão da regra de carência por finalidade e seus pré-requisitos; não certifica execução clínica, automação, venda ou abate.",
    global_technical_block: "Publicar e comprovar SHA do contrato v34/proveniência/zero antes de habilitação; não bloqueia cadastro/consulta.",
    counts: Object.fromEntries(["ELEGIVEL","RESTRITO","INCOMPLETO"].map(s => [s,result.filter(r => r.state === s).length])), rows: result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildF6Enablement(read("SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json").snapshot.rows, read("SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json"));
  writeFileSync(dir + "SANITARIO_V2_C02_F6_ENABLEMENT_20261029.json", JSON.stringify(result,null,2)+"\n");
  const csv = [["produto","finalidade","regra_id","via","estado","motivo","acao_minima"], ...result.rows.map(r => [r.code + " — " + r.product,r.purpose,r.rule_id??"",r.route??"",r.state,r.reasons.join("; "),r.minimum_actions.join("; ")])];
  writeFileSync(dir + "SANITARIO_V2_C02_F6_ENABLEMENT_20261029.csv", csv.map(row => row.map(v => '"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n")+"\n");
  console.log(JSON.stringify({ rows: result.rows.length, counts: result.counts, eligible: result.rows.filter(r => r.state === "ELEGIVEL").map(r => [r.code,r.purpose,r.rule_id]) }));
}
