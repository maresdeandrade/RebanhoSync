// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import {
  executeSanitaryAgendaV2,
  type ExecuteSanitaryAgendaInputV2,
} from "../sanitaryAgendaExecutionV2";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
import type { SanitarioAgendaLocalV2, Animal } from "@/lib/offline/types";
vi.mock("@/lib/offline/localReadBoundary", () => ({
  getCurrentLocalReadOwnership: vi.fn(async () => ({
    status: "OWNED",
    currentUserId: "owner",
  })),
}));
vi.mock("@/lib/env",()=>({env:{supabaseUrl:"http://127.0.0.1:56421"}}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const farm = crypto.randomUUID(),
  agendaId = crypto.randomUUID();
const products = [crypto.randomUUID(), crypto.randomUUID()];
const animals = Array.from({ length: 30 }, () => crypto.randomUUID());
const input = (
  ids: string[],
  dose = 2,
  productIndex = 0,
): ExecuteSanitaryAgendaInputV2 => ({
  fazendaId: farm,
  agendaId,
  animalIds: ids,
  clientOpId: crypto.randomUUID(),
  executedAt: "2026-10-30T14:37",
  registrationMode: "executed_fact",
  product: {
    productId: products[productIndex],
    productName: `Produto ${productIndex === 0 ? "A" : "B"}`,
  },
  application: { dose, doseUnit: "mL", route: "SC" },
  confirmation: { userConfirmedExecution: true },
  sync: { clientId: "v32-test", projectRef: "local" },
});
const tables = [
  db.local_sanitario_participacoes,
  db.ops_sanitario_agenda_v2,
  db.ops_sanitario_agenda_animais_v2,
  db.event_eventos,
  db.event_eventos_sanitario,
  db.event_eventos_animais,
  db.queue_ops,
  db.queue_gestures,
  db.sync_sanitario_v2_cutovers,
  db.local_ownership,
  db.state_animais,
  db.catalog_sanitario_produtos_v2,
];
beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:56421");
  vi.stubEnv("VITE_BACKEND_ENV", "development");
  await db.open();
  for (const table of tables) await table.clear();
  setSanitarioV2PushEnabled(true, "local");
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: "owner",
  });
  await db.sync_sanitario_v2_cutovers.put({
    key: `${farm}:3`,
    fazenda_id: farm,
    contract_version: 3,
    status: "APPLIED",
    prepared_at: new Date().toISOString(),
    applied_at: new Date().toISOString(),
  });
  await db.ops_sanitario_agenda_v2.put({
    id: agendaId,
    fazenda_id: farm,
    status: "programada",
    obrigacao_origem_agenda_id: agendaId,
    protocolo_id: "protocol",
    protocol_item_version_id: "item",
    protocol_item_snapshot: {
      logicalItemKey: "item",
      productRequirementKind: "none",
    },
    metadata: {},
    produto_snapshot: {},
    acao_sanitaria: "vacinacao",
    revision: 0,
  } as SanitarioAgendaLocalV2);
  for (const [i, id] of products.entries())
    await db.catalog_sanitario_produtos_v2.put({
      id,
      nome_comercial: `Produto ${i === 0 ? "A" : "B"}`,
      status_curatorial: "ativo",
      metadata: {},
      scope: "global",
      fazenda_id: null,
    } as never);
  for (const id of animals) {
    await db.state_animais.put({ id, fazenda_id: farm, sexo: "F" } as Animal);
    await db.ops_sanitario_agenda_animais_v2.put({
      agenda_id: agendaId,
      fazenda_id: farm,
      animal_id: id,
      obrigacao_origem_agenda_id: agendaId,
      planned_status: "planejado",
      execution_evento_id: null,
    });
  }
});
afterEach(async () => {
  try {
    for (const table of tables) await table.clear();
    setSanitarioV2PushEnabled(false, "local");
  } finally {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  }
});
it.each(["https://unauthorized.invalid", "https://localhost:56421"])(
  "rejects an unauthorized backend %s without weakening the production guard",
  async url => {
    vi.stubEnv("VITE_SUPABASE_URL", url);
    expect(() => setSanitarioV2PushEnabled(true, "local")).toThrow("SANITARIO_V2_STAGING_ONLY");
    await expect(executeSanitaryAgendaV2(input([animals[0]]))).rejects.toThrow("PUSH_DISABLED");
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  },
);
it("persists three independent subsets, keeps Agenda open and recovers immutable queue after restart", async () => {
  const groups = [
    input(animals.slice(0, 15)),
    input(animals.slice(15, 20), 5),
    input(animals.slice(20, 25), 2, 1),
  ];
  for (const g of groups)
    expect((await executeSanitaryAgendaV2(g)).agendaStatus).toBe("open");
  expect(await db.event_eventos.count()).toBe(3);
  expect(await db.event_eventos_animais.count()).toBe(25);
  expect(await db.queue_ops.count()).toBe(3);
  const details = await db.event_eventos_sanitario.toArray();
  expect(
    details.map((d) => [d.produto_nome_snapshot, d.dose_quantidade]).sort(),
  ).toEqual([
    ["Produto A", 2],
    ["Produto A", 5],
    ["Produto B", 2],
  ]);
  expect((await db.ops_sanitario_agenda_v2.get(agendaId))?.status).toBe(
    "programada",
  );
  const envelopes = await db.queue_ops.toArray();
  const originalEvents = await db.event_eventos.toArray();
  const sequences = envelopes.map(op => op.record.payload.event.payload.participation_sequence).sort();
  expect(sequences).toEqual([1, 2, 3]);
  expect(new Set(envelopes.map(op => op.record.payload.event.payload.participation_id)).size).toBe(1);

  db.close();
  await db.open();
  await executeSanitaryAgendaV2(groups[0]);
  expect(await db.queue_ops.toArray()).toEqual(envelopes);
  expect(await db.event_eventos.toArray()).toEqual(originalEvents);
  await expect(
    executeSanitaryAgendaV2({ ...groups[0], application: { dose: 9 } }),
  ).rejects.toThrow("IDENTITY_REUSE");
  expect(
    (await db.event_eventos.toArray()).every(
      (e) => e.sanitario_v3_confirmation === "pending",
    ),
  ).toBe(true);
  expect(
    (await db.ops_sanitario_agenda_animais_v2.toArray()).every(
      (a) => a.planned_status === "planejado",
    ),
  ).toBe(true);
});
it("preserves the selected instant and canonical São Paulo civil date", async () => {
  const request = input([animals[0]]);
  request.executedAt = "2026-10-30T23:37:00-03:00";
  const result = await executeSanitaryAgendaV2(request);
  expect(await db.event_eventos.get(result.eventId)).toMatchObject({
    occurred_at: "2026-10-31T02:37:00.000Z",
    occurred_on: "2026-10-30",
  });
});

it("integra óbito local com bloqueio da execução posterior", async () => {
  const deathEventId = crypto.randomUUID();
  const death = buildEventGesture({ dominio: "obito", fazendaId: farm, animalId: animals[0], eventId: deathEventId, causa: "doenca" });
  await createGesture(farm, death.ops, { deathConsequences: { animalId: animals[0], eventId: deathEventId } });
  await expect(executeSanitaryAgendaV2(input([animals[0]]))).rejects.toThrow("SANITARIO_PARTICIPANT_DECEASED");
  expect(await db.event_eventos.get(deathEventId)).toMatchObject({ dominio: "obito" });
  expect(await db.queue_ops.filter((operation) => operation.record.command === "death_participant").count()).toBe(1);
  expect((await executeSanitaryAgendaV2(input([animals[1]]))).agendaStatus).toBe("open");
});

it("não executa participante dispensado por óbito nem afeta os demais", async () => {
  const deathEventId = crypto.randomUUID();
  await db.ops_sanitario_agenda_animais_v2.update([agendaId, animals[0]], {
    planned_status: "nao_executado", not_executed_reason: `obito:${deathEventId}`,
  });
  await expect(executeSanitaryAgendaV2(input([animals[0]]))).rejects.toThrow("SANITARIO_PARTICIPANT_DECEASED");
  expect(await db.event_eventos.count()).toBe(0);
  expect(await db.queue_ops.count()).toBe(0);
  expect((await executeSanitaryAgendaV2(input([animals[1]]))).agendaStatus).toBe("open");
});

it("rejects empty, duplicate, cross farm and outside obligation subsets without any persistence", async () => {
  for (const ids of [[], [animals[0], animals[0]], [crypto.randomUUID()]])
    await expect(executeSanitaryAgendaV2(input(ids))).rejects.toThrow();
  await expect(
    executeSanitaryAgendaV2({
      ...input([animals[0]]),
      fazendaId: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  expect(await db.event_eventos.count()).toBe(0);
  expect(await db.queue_ops.count()).toBe(0);
});

it("does not persist on farm-switch, lost ownership or gate OFF", async () => {
  await expect(
    executeSanitaryAgendaV2({
      ...input([animals[0]]),
      assertCurrentContext: () => {
        throw new Error("FARM_CHANGED");
      },
    }),
  ).rejects.toThrow("FARM_CHANGED");
  await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, {
    owner_user_id: "other",
  });
  await expect(executeSanitaryAgendaV2(input([animals[0]]))).rejects.toThrow(
    "OWNERSHIP_CHANGED",
  );
  await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, {
    owner_user_id: "owner",
  });
  setSanitarioV2PushEnabled(false, "local");
  await expect(executeSanitaryAgendaV2(input([animals[0]]))).rejects.toThrow(
    "PUSH_DISABLED",
  );
  expect(await db.event_eventos.count()).toBe(0);
  expect(await db.queue_ops.count()).toBe(0);
});

it("replays after canonical pull removed the legacy source fields",async()=>{
  const request=input([animals[0]]);const result=await executeSanitaryAgendaV2(request);
  await db.event_eventos.update(result.eventId,{source_task_id:null,source_client_op_id:null,sanitario_v3_confirmation:"confirmed"});
  await db.queue_ops.clear();await db.queue_gestures.clear();db.close();await db.open();
  const replay=await executeSanitaryAgendaV2(request);expect(replay.eventId).toBe(result.eventId);
  expect(await db.event_eventos.count()).toBe(1);expect(await db.queue_ops.count()).toBe(0);
});

it("uses the local contract when the browser resolves sync on loopback",async()=>{
  const request=input([animals[0]]);delete request.sync;
  expect((await executeSanitaryAgendaV2(request)).agendaStatus).toBe("open");
  expect(await db.queue_ops.count()).toBe(1);
});

it("queues a stocked progressive group without embedding conflicting client context",async()=>{
  const supply=crypto.randomUUID(),stock=crypto.randomUUID();
  await db.state_insumos.put({id:supply,fazenda_id:farm,nome:"Fixture",tipo:"sanitario",unidade_base:"ml",produto_veterinario_id:products[0],ativo:true,payload:{}} as never);
  await db.state_insumo_lotes.put({id:stock,fazenda_id:farm,insumo_id:supply,unidade_base:"ml",saldo_atual_base:100,quantidade_inicial_base:100,status:"ativo",payload:{}} as never);
  const request=input([animals[0]]);request.product={...request.product!,inventoryLotId:stock,quantityConsumed:2,unit:"ml"};request.confirmation.userConfirmedStockMovement=true;
  await executeSanitaryAgendaV2(request);
  expect(await db.queue_ops.count()).toBe(1);expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  const queued=(await db.queue_ops.toArray())[0];expect(queued.record.payload.event.payload.inventory_movement).toMatchObject({insumo_lote_id:stock,quantidade_base:2});
  expect(queued.record.payload.event.payload.inventory_movement).not.toHaveProperty("client_id");
});
