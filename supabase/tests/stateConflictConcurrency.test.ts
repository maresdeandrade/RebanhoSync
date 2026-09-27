import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.REBANHOSYNC_TEST_DB_URL;
const farmA = crypto.randomUUID();
const farmB = crypto.randomUUID();
const animalA = crypto.randomUUID();
const animalB = crypto.randomUUID();
let admin: Client;

const describeDatabase = connectionString ? describe.sequential : describe.skip;

async function updateWithExpectedRevision(
  client: Client,
  input: {
    animalId: string;
    farmId: string;
    expectedRevision: number;
    note: string;
  },
) {
  return client.query<{ revision: string }>(
    `update public.animais
       set observacoes = $1
     where id = $2
       and fazenda_id = $3
       and revision = $4
     returning revision`,
    [input.note, input.animalId, input.farmId, input.expectedRevision],
  );
}

describeDatabase("F24.4C animais state revision PostgreSQL concurrency", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(
      "insert into public.fazendas (id, nome) values ($1, 'F24.4C A'), ($2, 'F24.4C B')",
      [farmA, farmB],
    );
    await admin.query(
      `insert into public.animais
        (id, fazenda_id, identificacao, sexo, observacoes)
       values
        ($1, $2, 'STATE-CAS', 'F', 'baseline'),
        ($3, $4, 'STATE-CAS', 'F', 'baseline')`,
      [animalA, farmA, animalB, farmB],
    );
  });

  afterAll(async () => {
    await admin.query("delete from public.animais where id = any($1::uuid[])", [
      [animalA, animalB],
    ]);
    await admin.query("delete from public.fazendas where id = any($1::uuid[])", [
      [farmA, farmB],
    ]);
    await admin.end();
  });

  it("aplica somente um de dois UPDATEs concorrentes com a mesma revisão", async () => {
    const clients = [
      new Client({ connectionString }),
      new Client({ connectionString }),
    ];
    await Promise.all(clients.map((client) => client.connect()));
    try {
      const results = await Promise.all([
        updateWithExpectedRevision(clients[0]!, {
          animalId: animalA,
          farmId: farmA,
          expectedRevision: 1,
          note: "device-a",
        }),
        updateWithExpectedRevision(clients[1]!, {
          animalId: animalA,
          farmId: farmA,
          expectedRevision: 1,
          note: "device-b",
        }),
      ]);

      expect(results.map((result) => result.rowCount).sort()).toEqual([0, 1]);
      expect(
        (await admin.query<{ revision: string }>(
          "select revision from public.animais where id = $1 and fazenda_id = $2",
          [animalA, farmA],
        )).rows[0]?.revision,
      ).toBe("2");
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("rejeita stale offline e aceita a atualização sequencial com revisão nova", async () => {
    const stale = await updateWithExpectedRevision(admin, {
      animalId: animalA,
      farmId: farmA,
      expectedRevision: 1,
      note: "offline-stale",
    });
    expect(stale.rowCount).toBe(0);

    const sequential = await updateWithExpectedRevision(admin, {
      animalId: animalA,
      farmId: farmA,
      expectedRevision: 2,
      note: "sequential",
    });
    expect(sequential.rows[0]?.revision).toBe("3");
  });

  it("mantém revisão isolada por fazenda e ignora revisão fabricada pelo cliente", async () => {
    const wrongFarm = await updateWithExpectedRevision(admin, {
      animalId: animalB,
      farmId: farmA,
      expectedRevision: 1,
      note: "cross-farm",
    });
    expect(wrongFarm.rowCount).toBe(0);

    const authoritative = await admin.query<{ revision: string }>(
      `update public.animais
          set observacoes = 'server-authoritative', revision = 999
        where id = $1 and fazenda_id = $2 and revision = 1
        returning revision`,
      [animalB, farmB],
    );
    expect(authoritative.rows[0]?.revision).toBe("2");
  });
});
