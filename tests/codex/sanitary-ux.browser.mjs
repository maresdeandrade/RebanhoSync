// Isolated presentation harness: real components/builders, synthetic data, no remote access.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const entryPath = "/__sanitary_ux.tsx";
const entryId = path.resolve("__sanitary_ux.tsx").replaceAll("\\", "/");
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '/src/globals.css';
import { SanitaryNeedsDiscoveryV2 } from '/src/components/sanitario/SanitaryNeedsDiscoveryV2';
import { buildSanitaryProtocolWindowV2, EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 } from '/src/lib/sanitario/windows/sanitaryProtocolWindowsV2';
const protocol = { id:'fixture-protocol', familyCode:'brucelose_b19', name:'Protocolo sintético', scope:'global', fazendaId:null, version:1, status:'active', approvalStatus:'approved', legalStatus:'manual_only', speciesScope:{}, jurisdictionScope:{}, sourceRefsSnapshot:[], metadata:{} };
const refs = Object.fromEntries(['eligibility_rule','operational_window','product_requirement'].map(field => [field, [{kind:'norma_oficial',title:'Fonte sintética — não autoriza catálogo real',strength:'forte',evidenceStatus:'SIM_NORMA',fieldKeys:[field]}]]));
const item = { id:'fixture-item', protocolId:protocol.id, logicalItemKey:'b19_femeas_3_8_meses', version:1, status:'active', itemStatus:'recomendado', actionType:'vacinacao', productRequirementKind:'product_class', productId:null, productClass:'vacina_brucelose_b19', productClassGroupId:null, eligibilityRule:{species:['bovino'],sex:'femea',requires_risk_context:true}, operationalWindowRule:{}, doseRule:{}, routeRule:{}, boosterRule:{}, speciesAuthorization:{}, sourceRefsByField:refs,limitations:[],snapshotTemplate:{},requiresMvResponsavel:false };
const context = {...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, riskContext:true, management:'rearing'};
const source = {farmUf:'MG',catalog:{protocols:[protocol],items:[item],productClassGroups:[]},animals:['a','b','c'].map((id,i)=>({id,fazenda_id:'fixture',identificacao:'V0'+(i+1),nome:null,sexo:'F',especie:'bovino',status:'ativo',data_nascimento:'2026-07-01',lote_id:null,payload:{},deleted_at:null})),lots:[],executedHistory:[],executedEvents:[],agendas:[],agendaAnimals:[],farmConfig:{fazenda_id:'fixture',uf:'MG',payload:{}}};
const base = buildSanitaryProtocolWindowV2({source,protocolId:protocol.id,itemId:item.id,evaluatedAt:'2026-11-08',operationalContext:context}).rows[0];
// Historical reference distribution; only the presentation projection is exercised here.
const groups = Array.from({length:32},(_,i)=>({itemId:'variant-'+i,itemLabel:'Etapa '+i,protocolId:protocol.id,protocolLabel:protocol.name,rows:[{...base,itemId:'variant-'+i,itemKey:'variant-'+i,animalId:'a',identification:'V01',alreadyPlanned:i===1||i===2,plannedFor:i===1||i===2?'2026-11-09':null,canSelect:i===0,status:i>=3&&i<13?'insufficient_data':base.status,blockers:i>=13?['Restrição curatorial']:[],documentaryPending:false,documentaryPendingReasons:['Documento sintético'],warnings:['Aviso complementar'],reason:'Justificativa original '+i,precheck:{...base.precheck,missingExecutedHistory:i>=3&&i<13}}]}));
source.catalog.items.push(...groups.map(g=>({...item,id:g.itemId,logicalItemKey:g.itemId})));
createRoot(document.getElementById('root')).render(<MemoryRouter><main className="mx-auto max-w-5xl space-y-4 p-4">
<h1>Central Sanitária — fixture isolada</h1>
<SanitaryNeedsDiscoveryV2 source={source} target={{animalId:'a',lotId:''}} evaluatedAt="2026-11-08" groups={groups} onTargetChange={()=>{}} onDateChange={()=>{}} onChooseItem={()=>{}} onOpenSection={()=>{}}/>
</main></MemoryRouter>);
`;

process.env.VITE_SUPABASE_URL = "http://127.0.0.1:9";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fixture-unused";
process.env.VITE_SUPABASE_FUNCTIONS_URL = "http://127.0.0.1:9/functions/v1";
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, open: false },
  plugins: [{
    name: "sanitary-ux-fixture",
    enforce: "pre",
    resolveId(id) { if (id === entryPath) return entryId; },
    load(id) { if (id === entryId) return fixture; },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url !== "/__sanitary_ux") return next();
        const html = await vite.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="' + entryPath + '"></script></body></html>');
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const output = process.env.SANITARY_UX_SCREENSHOTS;
  if (output) await mkdir(output, { recursive: true });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/__sanitary_ux`);
    assert.equal(await page.locator("[data-evaluation-key]").count(), 32);
    assert.equal(await page.locator("[data-evaluation-key]:visible").count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (output) await page.screenshot({ path: path.join(output, `sanitary-ux-${width}-compact.png`) });
    await page.getByText("Informações insuficientes · 10 avaliações", { exact: true }).click();
    await page.getByText("Restrições e consulta técnica · 19 avaliações", { exact: true }).click();
    assert.equal(await page.locator("[data-evaluation-key]:visible").count(), 32);
    await page.getByText("Detalhes técnicos, versão e documentos", { exact: true }).first().click();
    await page.getByText("Documento sintético", { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    assert.deepEqual(errors, []);
    if (output) await page.screenshot({ path: path.join(output, `sanitary-ux-${width}.png`), fullPage: true });
    console.log(JSON.stringify({ width, evaluations: 32, overflow: false, pageErrors: errors.length }));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
