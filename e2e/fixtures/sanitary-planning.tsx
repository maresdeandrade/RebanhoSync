// Browser integration shell: real pages, AuthProvider, domain services and IndexedDB.
// Only identity and HTTP responses are synthetic; no remote environment is accessed.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "../../src/hooks/useAuth";
import { supabase } from "../../src/lib/supabase";
import { db } from "../../src/lib/offline/db";
import { establishLocalOwnership } from "../../src/lib/offline/ownership";
import ProtocolosSanitarios from "../../src/pages/ProtocolosSanitarios";
import SelectFazenda from "../../src/pages/SelectFazenda";
import "../../src/globals.css";
import { seedNormalizedFixture, seedNormalizedHistory, normalizedDraft, automaticItemKeys } from "../../src/lib/sanitario/agenda/__tests__/fixtures/sanitaryNormalizedFixtureV2";
import { saveSanitaryAutomationPlanV2 } from "../../src/lib/sanitario/agenda/sanitaryAutomationPlanV2";

const endpoint = new URL(import.meta.env.VITE_SUPABASE_URL);
if (endpoint.hostname !== "127.0.0.1" || endpoint.port !== "59997") {
  throw new Error("Fixture sanitária restrita ao ambiente local descartável.");
}

const user = { id: "00000000-0000-4000-8000-000000000001", email: "sintetico@example.invalid" };
Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session: { user } }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
});
await establishLocalOwnership({ user } as never);
const farm = "00000000-0000-4000-8000-000000000010";
const otherFarm = "00000000-0000-4000-8000-000000000020";
const protocol = "00000000-0000-4000-8000-000000000030";
const item = "00000000-0000-4000-8000-000000000040";
const now = "2026-07-04T12:00:00.000Z";
const stamp = { created_at: now, updated_at: now, deleted_at: null };
const integral = new URLSearchParams(location.search).has("integral");
if (!await db.state_animais.count() && !integral) {
  await db.state_lotes.put({ id: "lot-test", fazenda_id: farm, nome: "Bezerras de teste", ...stamp } as never);
  await db.state_fazenda_sanidade_config.put({ fazenda_id: farm, uf: "MG", ...stamp } as never);
  for (const [id, identification, farmId, sex] of [
    ["female-test", "Bezerra teste 101", farm, "F"],
    ["female-test-2", "Bezerra teste 102", farm, "F"],
    ["male-test", "Bezerro teste 201", farm, "M"],
    ["foreign-test", "Outra fazenda 301", otherFarm, "F"],
  ]) {
    await db.state_animais.put({ id, identificacao: identification, fazenda_id: farmId, sexo: sex,
      especie: "bovino", data_nascimento: "2026-03-01", status: "ativo", lote_id: farmId === farm ? "lot-test" : null, ...stamp } as never);
  }
  if (!new URLSearchParams(location.search).has("empty")) {
    await db.catalog_sanitario_protocolos_v2.put({ id: protocol, family_code: "brucelose_b19", name: "Brucelose B19 — teste",
      scope: "global", fazenda_id: null, species_scope: {}, jurisdiction_scope: {}, legal_status: "obrigatorio", version: 1,
      status: "active", approval_status: "approved", source_refs_snapshot: [], metadata: { requires_uf_context: true, excluded_ufs: [] }, ...stamp });
    await db.catalog_sanitario_protocolo_itens_versions_v2.put({ id: item, protocol_id: protocol, logical_item_key: "b19_femeas_3_8_meses",
      version: 1, item_status: "obrigatorio", action_type: "vacinacao", product_requirement_kind: "product_class", product_id: null,
      product_class: "vacina_brucelose_b19", product_class_group_id: null, eligibility_rule: { species: ["bovino"], sex: "femea", age_min_months: 3, age_max_months: 8 },
      operational_window_rule: {}, dose_rule: {}, route_rule: {}, booster_rule: {}, species_authorization: {},
      limitations: [], snapshot_template: {}, allows_agenda_auto: new URLSearchParams(location.search).has("approved"),
      source_refs_by_field: new URLSearchParams(location.search).has("approved") ? Object.fromEntries(
        ["eligibility_rule", "operational_window", "product_requirement"].map((field) => [field, [{
          kind: "norma_oficial", title: "Fixture explicitamente aprovada — teste local", strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field],
        }]]),
      ) : {}, requires_mv_responsavel: true, status: "active", ...stamp });
    await db.catalog_sanitario_produtos_v2.put({ id: "product-existing", nome_comercial: "Produto existente de teste", classe: "vacina_brucelose_b19", status_curatorial: "ativo", ...stamp } as never);
  }
}
if (integral && !await db.state_animais.count()) {
  await seedNormalizedFixture(farm);
  for (const key of automaticItemKeys) await seedNormalizedHistory(key, farm);
  await saveSanitaryAutomationPlanV2({ fazendaId: farm, actorId: user.id, expectedRevision: 0,
    draft: await normalizedDraft(farm), enabled: false, confirmed: false });
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AuthProvider><BrowserRouter>
    <nav className="p-4"><Link to="/select-fazenda">Trocar fazenda</Link></nav>
    <Routes>
      <Route path="/select-fazenda" element={<SelectFazenda />} />
      <Route path="/protocolos-sanitarios" element={<ProtocolosSanitarios />} />
      <Route path="/home" element={<Navigate to="/protocolos-sanitarios" replace />} />
      <Route path="*" element={<Navigate to="/select-fazenda" replace />} />
    </Routes><Toaster />
  </BrowserRouter></AuthProvider></React.StrictMode>,
);
