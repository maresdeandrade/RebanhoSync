import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const occurredAt = "2026-08-13T12:00:00.000Z";
const cleanupEvents = new Set<string>();
const cleanupAnimals = new Set<string>();
const cleanupLots = new Set<string>();
let farmId: string;
let userId: string;
let admin: Client;

function purchaseCommand(input: {
  operationId: string;
  transactionId: string;
  animalId: string;
  identification: string;
  value: number;
}) {
  const animal = {
    id: input.animalId,
    fazenda_id: farmId,
    identificacao: input.identification,
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2025-01-01",
    data_entrada: "2026-08-13",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: "compra",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  const event = {
    id: input.operationId,
    fazenda_id: farmId,
    dominio: "comercial",
    occurred_at: occurredAt,
    animal_id: input.animalId,
    lote_id: null,
    payload: { kind: "commercial_operation_v2" },
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  const detail = {
    evento_id: input.operationId,
    fazenda_id: farmId,
    operation_type: "compra",
    scope: "animal",
    occurred_at: occurredAt,
    quantidade_animais: 1,
    peso_vivo_total: null,
    peso_medio_derivado: null,
    valor_bruto: input.value,
    frete: 0,
    comissao: 0,
    descontos: 0,
    taxas_impostos: 0,
    valor_liquido_derivado: input.value,
    contraparte_id: null,
    contraparte_nome: "Fornecedor concorrente",
    animal_ids: [input.animalId],
    lote_id: null,
    finance_transaction_id: null,
    snapshot: { contract_version: 2 },
    calculation_status: "partial",
    issues: [],
    limitations: [],
    observacoes: null,
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  return {
    domain: "commercial_operation_v2",
    command: "apply_commercial_operation",
    contract_version: 2,
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    operation_id: input.operationId,
    operation_type: "compra",
    scope: "animal",
    fazenda_id: farmId,
    occurred_at: occurredAt,
    animal_ids: [input.animalId],
    animals: [animal],
    event,
    detail,
  };
}

function saleCommand(input: {
  operationId: string;
  transactionId: string;
  animalId: string;
}) {
  const purchase = purchaseCommand({
    ...input,
    identification: "unused",
    value: 1000,
  });
  return {
    ...purchase,
    operation_type: "venda" as const,
    animals: [
      {
        ...purchase.animals[0],
        status: "vendido",
        origem: "compra",
        data_saida: occurredAt.slice(0, 10),
      },
    ],
    event: {
      ...purchase.event,
      payload: { kind: "commercial_operation_v2" },
    },
    detail: {
      ...purchase.detail,
      operation_type: "venda",
      contraparte_nome: "Comprador concorrente",
    },
  };
}

async function authenticatedClient() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ]);
  await client.query("set role authenticated");
  return client;
}

async function apply(
  client: Client,
  command: ReturnType<typeof purchaseCommand>,
) {
  const result = await client.query<{ result: Record<string, unknown> }>(
    "select public.apply_commercial_operation_v2($1::uuid, $2::uuid, $3::uuid, $4::jsonb) as result",
    [
      farmId,
      command.client_op_id,
      command.client_tx_id,
      JSON.stringify(command),
    ],
  );
  return result.rows[0]!.result;
}

beforeAll(async () => {
  admin = new Client({ connectionString });
  await admin.connect();
  const membership = await admin.query<{ user_id: string; fazenda_id: string }>(
    "select user_id, fazenda_id from public.user_fazendas where deleted_at is null order by created_at limit 1",
  );
  userId = membership.rows[0]!.user_id;
  farmId = membership.rows[0]!.fazenda_id;
});

afterAll(async () => {
  await admin.query(
    "delete from public.eventos_comercial where evento_id = any($1::uuid[])",
    [[...cleanupEvents]],
  );
  await admin.query("delete from public.eventos where id = any($1::uuid[])", [
    [...cleanupEvents],
  ]);
  await admin.query("delete from public.animais where id = any($1::uuid[])", [
    [...cleanupAnimals],
  ]);
  await admin.query("delete from public.lotes where id = any($1::uuid[])", [
    [...cleanupLots],
  ]);
  await admin.end();
});

describe.sequential("commercial_operation_v2 PostgreSQL concurrency", () => {
  it("applies identical concurrent purchases once and replays the other", async () => {
    const operationId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const animalId = crypto.randomUUID();
    cleanupEvents.add(operationId);
    cleanupAnimals.add(animalId);
    const command = purchaseCommand({
      operationId,
      transactionId,
      animalId,
      identification: `CONC-${animalId}`,
      value: 1000,
    });
    const clients = await Promise.all([
      authenticatedClient(),
      authenticatedClient(),
    ]);
    try {
      const results = await Promise.all(
        clients.map((client) => apply(client, command)),
      );
      expect(results.map((result) => result.status)).toEqual([
        "APPLIED",
        "APPLIED",
      ]);
      expect(results.map((result) => result.replay).sort()).toEqual([
        false,
        true,
      ]);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("allows only one factual version for divergent concurrent purchases", async () => {
    const operationId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const animalId = crypto.randomUUID();
    cleanupEvents.add(operationId);
    cleanupAnimals.add(animalId);
    const base = purchaseCommand({
      operationId,
      transactionId,
      animalId,
      identification: `DIV-${animalId}`,
      value: 1000,
    });
    const clients = await Promise.all([
      authenticatedClient(),
      authenticatedClient(),
    ]);
    try {
      const results = await Promise.all([
        apply(clients[0]!, base),
        apply(clients[1]!, {
          ...base,
          detail: { ...base.detail, valor_bruto: 2000 },
        }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([
        "APPLIED",
        "CONFLICT",
      ]);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("allows only one concurrent sale of the same animal", async () => {
    const animalId = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();
    const purchaseTx = crypto.randomUUID();
    cleanupAnimals.add(animalId);
    cleanupEvents.add(purchaseId);
    const setupClient = await authenticatedClient();
    await apply(
      setupClient,
      purchaseCommand({
        operationId: purchaseId,
        transactionId: purchaseTx,
        animalId,
        identification: `SALE-${animalId}`,
        value: 1000,
      }),
    );
    await setupClient.end();

    const saleA = saleCommand({
      operationId: crypto.randomUUID(),
      transactionId: crypto.randomUUID(),
      animalId,
    });
    const saleB = saleCommand({
      operationId: crypto.randomUUID(),
      transactionId: crypto.randomUUID(),
      animalId,
    });
    cleanupEvents.add(saleA.operation_id);
    cleanupEvents.add(saleB.operation_id);
    const clients = await Promise.all([
      authenticatedClient(),
      authenticatedClient(),
    ]);
    try {
      const results = await Promise.all([
        apply(clients[0]!, saleA),
        apply(clients[1]!, saleB),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([
        "APPLIED",
        "CONFLICT",
      ]);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("applies one atomic lot fact and rejects a changed lot snapshot", async () => {
    const lotId = crypto.randomUUID();
    const animalA = crypto.randomUUID();
    const animalB = crypto.randomUUID();
    const addedAnimal = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();
    const purchaseTx = crypto.randomUUID();
    cleanupLots.add(lotId);
    [animalA, animalB, addedAnimal].forEach((id) => cleanupAnimals.add(id));
    cleanupEvents.add(purchaseId);
    await admin.query(
      "insert into public.lotes (id, fazenda_id, nome) values ($1, $2, 'Concurrency lot')",
      [lotId, farmId],
    );
    const seed = purchaseCommand({
      operationId: purchaseId,
      transactionId: purchaseTx,
      animalId: animalA,
      identification: `LOT-A-${animalA}`,
      value: 2000,
    });
    const secondAnimal = {
      ...seed.animals[0],
      id: animalB,
      identificacao: `LOT-B-${animalB}`,
      client_op_id: crypto.randomUUID(),
      lote_id: lotId,
    };
    const purchaseAnimals = [
      { ...seed.animals[0], lote_id: lotId },
      secondAnimal,
    ].sort((a, b) => a.id.localeCompare(b.id));
    const lotAnimalIds = purchaseAnimals.map((animal) => animal.id);
    const purchase = {
      ...seed,
      scope: "lote" as const,
      animal_ids: lotAnimalIds,
      animals: purchaseAnimals,
      event: { ...seed.event, animal_id: null, lote_id: lotId },
      detail: {
        ...seed.detail,
        scope: "lote",
        quantidade_animais: 2,
        animal_ids: lotAnimalIds,
        lote_id: lotId,
      },
    };
    const purchaseClients = await Promise.all([
      authenticatedClient(),
      authenticatedClient(),
    ]);
    const purchaseResults = await Promise.all(
      purchaseClients.map((client) => apply(client, purchase)),
    );
    expect(purchaseResults.map((result) => result.status)).toEqual([
      "APPLIED",
      "APPLIED",
    ]);
    expect(purchaseResults.map((result) => result.replay).sort()).toEqual([
      false,
      true,
    ]);
    await Promise.all(purchaseClients.map((client) => client.end()));
    expect(
      (
        await admin.query<{ count: string }>(
          "select count(*) from public.animais where id = any($1::uuid[])",
          [[animalA, animalB]],
        )
      ).rows[0]!.count,
    ).toBe("2");

    await admin.query(
      "insert into public.animais (id, fazenda_id, identificacao, sexo, lote_id) values ($1, $2, $3, 'F', $4)",
      [addedAnimal, farmId, `LOT-NEW-${addedAnimal}`, lotId],
    );
    const saleId = crypto.randomUUID();
    const saleTx = crypto.randomUUID();
    cleanupEvents.add(saleId);
    const sale = {
      ...purchase,
      client_op_id: saleId,
      client_tx_id: saleTx,
      operation_id: saleId,
      operation_type: "venda" as const,
      animals: purchase.animals.map((animal) => ({
        ...animal,
        status: "vendido",
        lote_id: null,
        data_saida: occurredAt.slice(0, 10),
        client_tx_id: saleTx,
      })),
      event: {
        ...purchase.event,
        id: saleId,
        client_op_id: saleId,
        client_tx_id: saleTx,
      },
      detail: {
        ...purchase.detail,
        evento_id: saleId,
        operation_type: "venda",
        client_op_id: saleId,
        client_tx_id: saleTx,
      },
    };
    const validationClient = await authenticatedClient();
    expect((await apply(validationClient, sale)).status).toBe("CONFLICT");
    expect(
      (
        await admin.query<{ count: string }>(
          "select count(*) from public.animais where id = any($1::uuid[]) and status::text = 'ativo'",
          [[animalA, animalB]],
        )
      ).rows[0]!.count,
    ).toBe("2");
    await admin.query("delete from public.animais where id = $1", [
      addedAnimal,
    ]);
    await validationClient.end();
    const saleClients = await Promise.all([
      authenticatedClient(),
      authenticatedClient(),
    ]);
    const saleResults = await Promise.all(
      saleClients.map((client) => apply(client, sale)),
    );
    expect(saleResults.map((result) => result.status)).toEqual([
      "APPLIED",
      "APPLIED",
    ]);
    expect(saleResults.map((result) => result.replay).sort()).toEqual([
      false,
      true,
    ]);
    await Promise.all(saleClients.map((client) => client.end()));
    expect(
      (
        await admin.query<{ count: string }>(
          "select count(*) from public.animais where id = any($1::uuid[]) and status::text = 'vendido'",
          [[animalA, animalB]],
        )
      ).rows[0]!.count,
    ).toBe("2");
    expect(
      (
        await admin.query<{ count: string }>(
          "select count(*) from public.eventos_comercial where evento_id = $1 and cardinality(animal_ids) = 2",
          [saleId],
        )
      ).rows[0]!.count,
    ).toBe("1");
  });
});
