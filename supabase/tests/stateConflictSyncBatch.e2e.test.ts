import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;
const enabled = Boolean(apiUrl && anonKey && serviceRoleKey && databaseUrl);
const describeLocal = enabled ? describe.sequential : describe.skip;

const userId = crypto.randomUUID();
const farmA = crypto.randomUUID();
const farmB = crypto.randomUUID();
const animalA = crypto.randomUUID();
const animalB = crypto.randomUUID();
const email = `f24-4c-${userId}@example.test`;
const password = `F24.4C-${crypto.randomUUID()}-Aa1!`;
let admin: SupabaseClient;
let database: Client;
let accessToken: string;

type SyncOp = {
  client_op_id: string;
  table: "animais";
  action: "UPDATE";
  expected_revision?: number;
  record: { id: string; observacoes: string };
};

function operation(input: {
  animalId?: string;
  expectedRevision?: number;
  note: string;
}): SyncOp {
  return {
    client_op_id: crypto.randomUUID(),
    table: "animais",
    action: "UPDATE",
    expected_revision: input.expectedRevision,
    record: {
      id: input.animalId ?? animalA,
      observacoes: input.note,
    },
  };
}

async function invoke(input: {
  farmId?: string;
  txId: string;
  op: SyncOp;
}) {
  const response = await fetch(`${apiUrl}/functions/v1/sync-batch`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: anonKey!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: "f24-4c-e2e",
      client_tx_id: input.txId,
      fazenda_id: input.farmId ?? farmA,
      ops: [
        {
          ...input.op,
          record: {
            ...input.op.record,
            client_id: "f24-4c-e2e",
            client_op_id: input.op.client_op_id,
            client_tx_id: input.txId,
          },
        },
      ],
    }),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      results?: Array<Record<string, unknown>>;
      error?: string;
    },
  };
}

describeLocal("F24.4C sync-batch state conflict E2E local", () => {
  beforeAll(async () => {
    admin = createClient(apiUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: userError } = await admin.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw userError;
    database = new Client({ connectionString: databaseUrl });
    await database.connect();
    await database.query(
      "insert into public.fazendas (id, nome) values ($1, 'F24.4C E2E A'), ($2, 'F24.4C E2E B')",
      [farmA, farmB],
    );
    await database.query(
      `insert into public.user_fazendas
        (user_id, fazenda_id, role, is_primary, accepted_at)
       values ($1, $2, 'owner', true, now())`,
      [userId, farmA],
    );
    await database.query(
      `insert into public.animais
        (id, fazenda_id, identificacao, sexo, observacoes)
       values
        ($1, $2, 'F24-4C-E2E', 'F', 'baseline'),
        ($3, $4, 'F24-4C-E2E', 'F', 'baseline')`,
      [animalA, farmA, animalB, farmB],
    );

    const auth = createClient(apiUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error: signInError } = await auth.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.session) {
      throw signInError ?? new Error("F24_4C_TEST_SESSION_MISSING");
    }
    accessToken = data.session.access_token;
  });

  afterAll(async () => {
    if (!admin) return;
    if (database) {
      await database.query("delete from public.animais where id = any($1::uuid[])", [
        [animalA, animalB],
      ]);
      await database.query("delete from public.user_fazendas where user_id = $1", [
        userId,
      ]);
      await database.query("delete from public.fazendas where id = any($1::uuid[])", [
        [farmA, farmB],
      ]);
      await database.end();
    }
    await admin.auth.admin.deleteUser(userId);
  });

  it("impede lost update, preserva replay e aceita sequência após pull", async () => {
    const opA = operation({ expectedRevision: 1, note: "device-a" });
    const opB = operation({ expectedRevision: 1, note: "device-b" });
    const txA = crypto.randomUUID();
    const txB = crypto.randomUUID();
    const concurrent = await Promise.all([
      invoke({ txId: txA, op: opA }),
      invoke({ txId: txB, op: opB }),
    ]);

    expect(concurrent.map((result) => result.status)).toEqual([200, 200]);
    const resultByStatus = concurrent
      .flatMap((result) => result.body.results ?? [])
      .sort((left, right) => String(left.status).localeCompare(String(right.status)));
    expect(resultByStatus.map((result) => result.status)).toEqual([
      "APPLIED",
      "CONFLICT",
    ]);
    expect(resultByStatus[1]).toMatchObject({
      retryable: false,
      reason_code: "STATE_REVISION_CONFLICT",
      current_revision: 2,
    });

    const appliedOp = resultByStatus[0]?.op_id === opA.client_op_id ? opA : opB;
    const appliedTx = appliedOp === opA ? txA : txB;
    expect(await invoke({ txId: appliedTx, op: appliedOp })).toMatchObject({
      status: 200,
      body: { results: [{ status: "APPLIED" }] },
    });

    const sequential = await invoke({
      txId: crypto.randomUUID(),
      op: operation({ expectedRevision: 2, note: "after-pull" }),
    });
    expect(sequential).toMatchObject({
      status: 200,
      body: { results: [{ status: "APPLIED" }] },
    });
  });

  it("rejeita stale offline, cliente legado, cross-farm e ownership inválido", async () => {
    expect(
      await invoke({
        txId: crypto.randomUUID(),
        op: operation({ expectedRevision: 1, note: "offline-stale" }),
      }),
    ).toMatchObject({
      status: 200,
      body: {
        results: [
          {
            status: "CONFLICT",
            retryable: false,
            reason_code: "STATE_REVISION_CONFLICT",
            current_revision: 3,
          },
        ],
      },
    });

    expect(
      await invoke({
        txId: crypto.randomUUID(),
        op: operation({ note: "legacy-without-revision" }),
      }),
    ).toMatchObject({
      status: 200,
      body: {
        results: [
          { status: "REJECTED", reason_code: "STATE_EXPECTED_REVISION_REQUIRED" },
        ],
      },
    });

    expect(
      await invoke({
        txId: crypto.randomUUID(),
        op: operation({
          animalId: animalB,
          expectedRevision: 1,
          note: "cross-farm",
        }),
      }),
    ).toMatchObject({
      status: 200,
      body: {
        results: [
          {
            status: "REJECTED",
            reason_code: "STATE_TARGET_NOT_FOUND_OR_FORBIDDEN",
          },
        ],
      },
    });

    const ownership = await invoke({
      farmId: farmB,
      txId: crypto.randomUUID(),
      op: operation({
        animalId: animalB,
        expectedRevision: 1,
        note: "ownership",
      }),
    });
    expect(ownership.status).toBe(403);
  });
});
