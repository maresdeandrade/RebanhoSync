import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { compileProductClassPublicationV2 } from "./sanitario-product-class-publication-v2.mjs";
const supplied = JSON.parse(
  readFileSync(
    "tests/fixtures/sanitario-product-class-links-supplied-20261120.json",
    "utf8",
  ),
);
const technical = JSON.parse(
  readFileSync(
    "tests/fixtures/sanitario-product-class-technical-20261120.json",
    "utf8",
  ),
).rows;
const catalog = JSON.parse(
  readFileSync(
    "tests/fixtures/sanitario-product-class-catalog-20261120.json",
    "utf8",
  ),
).catalog;
const id = (text) => {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const registry =
  "https://www.merckvetmanual.com/multimedia/table/delivery-routes-for-anthelmintics";
const definitions = {
  benzimidazois: [
    "Família química que inclui fembendazol; classificação farmacológica, sem equivalência de eficácia, indicação ou dose.",
    registry,
  ],
  imidazotiazoleis: [
    "Família química do levamisol, inclusive seus sais; classificação farmacológica sem autorização clínica.",
    registry,
  ],
  lactonas_macrociclicas: [
    "Família de ivermectina, abamectina, doramectina, eprinomectina e moxidectina; formulações não são clinicamente equivalentes.",
    registry,
  ],
  vacina_brucelose_b19: [
    "Imunobiológico contendo Brucella abortus cepa B19; exclui RB-51 e não certifica habilitação, espécie ou aplicação.",
    "https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/brucelose-e-tuberculose",
  ],
  vacina_raiva_herbivoros: [
    "Imunobiológico antirrábico para herbívoros com antígeno de vírus rábico; classificação não determina obrigatoriedade ou esquema.",
    "https://www.zoetis.com.br/especies/bovinos/vacinas-bovinos.aspx",
  ],
  vacina_clostridial: [
    "Imunobiológico contendo bacterinas ou toxoides clostridiais. A classe não assegura todas as valências nem intercambialidade.",
    "https://labovet.com.br/produtos/starvac-12",
  ],
  vacina_ibr_bvd: [
    "Classe funcional restrita de imunobiológicos com componentes IBR e BVD documentados; formulações e variantes não são equivalentes.",
    "https://www.zoetis.com.br/_locale-assets/arquivos/bovinos/bula_bov-alt-50442600-cattlemaster-4l5.pdf",
  ],
  vacina_leptospirose: [
    "Imunobiológicos com antígenos de Leptospira documentados; não afirma cobertura de todos os sorovares ou de todo esquema.",
    "https://www.zoetis.com.br/_locale-assets/arquivos/bovinos/bula_bov-alt-50442600-cattlemaster-4l5.pdf",
  ],
};
const extras = [
  [
    "88c4a3c9-868d-5eb0-974c-b16812a8918e",
    "Cattle Master 4 L5",
    "https://www.zoetis.com.br/_locale-assets/arquivos/bovinos/bula_bov-alt-50442600-cattlemaster-4l5.pdf",
    "IBR/BVD e cinco sorotipos de Leptospira expressos na composição da bula oficial.",
    "bula",
    "SIM_BULA",
    "Zoetis",
  ],
  [
    "53678137-452a-5910-9bc6-67022504a6ce",
    "Ripercol L 150 F",
    "https://www.zoetis.com.br/especies/bovinos/endoparasiticidas.aspx",
    "Página oficial específica identifica fosfato de levamisol 18,8%.",
    "registro_produto",
    "SIM_COMPOSICAO_FABRICANTE",
    "Zoetis",
  ],
  [
    "db743728-59e2-5ecb-8b2e-211ab170618f",
    "Eprecis",
    "https://www.ceva.com.br/ceva-na-midia/noticias/controle-de-parasitas-na-epoca-do-periparto-e-aliado-estrategico-dos-produtores",
    "Comunicado oficial identifica Eprecis como produto à base de eprinomectina.",
    "registro_produto",
    "SIM_COMPOSICAO_FABRICANTE",
    "Ceva",
  ],
  [
    "670001a6-3634-582b-a277-f3bc65f89a0e",
    "Ticson 3.50",
    "https://www.ceva.com.br/ceva-na-midia/noticias/precisao-no-controle-das-verminoses-e-essencial-para-pecuaria",
    "Comunicado oficial identifica Ticson 3.50 entre as formulações de ivermectina 3,5%.",
    "registro_produto",
    "SIM_COMPOSICAO_FABRICANTE",
    "Ceva",
  ],
];
extras.push([
  "1628cf40-3676-53a6-9fe2-4e154936167b",
  "ANAVAC B19",
  "https://ruminants.ceva.com/app/uploads/sites/16/2023/10/Anavac-B19.pdf",
  "Bula oficial, página única, P504889 V01: composição com Brucella abortus B19 liofilizada; conferência visual do documento.",
  "bula",
  "SIM_BULA",
  "Ceva",
]);
const sources = extras.map(
  ([product_id, name, url, notes, kind, evidence_status, issuer]) => ({
    id: id("class-source:" + product_id + ":" + url),
    source_key:
      "SRC_PRODUCT_CLASS_20261120_" +
      product_id.replaceAll("-", "").toUpperCase(),
    product_id,
    title: name + " — composição documental para classificação cadastral",
    url,
    issuer,
    kind,
    evidence_status,
    scope: "global",
    strength: "forte",
    limitations: [
      "Comprova exclusivamente composição/classificação; não certifica espécie, dose, via, carência ou registro vigente.",
    ],
    metadata: {
      classification_only: true,
      operational_authorization: false,
      reviewed_at: "2026-11-20",
      evidence_summary: notes,
    },
    coverage: {
      id: id("class-coverage:" + product_id + ":" + url),
      field_key: "composition",
      coverage_status: "covers",
      notes,
    },
  }),
);
let strong = 0;
const links = supplied.links.map((l) => {
  assert(
    catalog.classes.some(
      (c) => c.id === l.class_id && c.class_key === l.class_key,
    ),
  );
  const p = technical.sanitario_produtos_v2.find((p) => p.id === l.product_id);
  assert(
    p?.status_curatorial === "ativo" && p.nome_comercial === l.nome_comercial,
  );
  let sourceId = l.source_id,
    coverageId = l.coverage_id;
  if (l.suggested_status === "ativo") {
    const s = technical.sanitario_fontes_tecnicas_v2.find(
      (s) => s.id === sourceId,
    );
    const c = technical.sanitario_fonte_cobertura_campos_v2.find(
      (c) => c.id === coverageId,
    );
    assert(
      s?.strength === "forte" &&
        s.evidence_status === "SIM_BULA" &&
        c?.source_id === s.id &&
        c.field_key === "composition" &&
        c.coverage_status === "covers",
    );
    assert(
      technical.sanitario_produto_fontes_v2.some(
        (ps) =>
          ps.product_id === p.id &&
          ps.source_id === s.id &&
          ps.field_key === "composition",
      ),
    );
    strong++;
  } else {
    const source = sources.find((s) => s.product_id === l.product_id);
    assert(source);
    sourceId = source.id;
    coverageId = source.coverage.id;
  }
  return {
    id: id("product-class:" + l.product_id + ":" + l.class_id),
    product_id: l.product_id,
    product_name: p.nome_comercial,
    class_id: l.class_id,
    class_key: l.class_key,
    status_curatorial: "ativo",
    source_refs: [
      {
        id: sourceId,
        field: "product_class",
        basedOnField: "composition",
        coverageId,
      },
    ],
  };
});
assert.equal(strong, 31);
assert.equal(links.length, 36);
const anavac = sources.find(
  (s) => s.product_id === "1628cf40-3676-53a6-9fe2-4e154936167b",
);
anavac.version = "P504889 V01";
anavac.metadata.document_sha256 =
  "e6c3be5f8788526d05a882444f6dcae29df757aa392bcd45e0b41b68ba863da1";
const b19 = catalog.classes.find((c) => c.class_key === "vacina_brucelose_b19");
links.push({
  id: id("product-class:" + anavac.product_id + ":" + b19.id),
  product_id: anavac.product_id,
  product_name: "ANAVAC B19",
  class_id: b19.id,
  class_key: b19.class_key,
  status_curatorial: "ativo",
  source_refs: [
    {
      id: anavac.id,
      field: "product_class",
      basedOnField: "composition",
      coverageId: anavac.coverage.id,
    },
  ],
});
const packet = {
  artifact: "sanitario_product_class_publication_v2",
  classification_only: true,
  operational_authorization: false,
  decision_reference: "EXPLICIT_USER_PRODUCT_CLASS_FINALIZATION_20261120",
  classes: catalog.classes.map((c) => ({
    id: c.id,
    class_key: c.class_key,
    definition: definitions[c.class_key][0],
    references: [definitions[c.class_key][1]],
  })),
  sources,
  links,
  residuals: [],
  excluded_products: [
    "Bovilis RB-51",
    "Butox P CE25",
    "COMBO Pour On",
    "Exzolt 5% Bovinos",
    "FLURON Gold",
    "Tick Gard",
  ],
};
writeFileSync(
  "docs/review/evidence/SANITARIO_PRODUCT_CLASS_PUBLICATION_20261120.json",
  JSON.stringify(packet, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    products: new Set(links.map((l) => l.product_id)).size,
    activeLinks: links.length,
    classes: packet.classes.length,
    digest: createHash("sha256")
      .update(compileProductClassPublicationV2(packet))
      .digest("hex"),
  }),
);
