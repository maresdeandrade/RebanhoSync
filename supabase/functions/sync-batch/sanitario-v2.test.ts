import { describe, expect, it, vi } from "vitest";
import {
  type ApplyFactualCoreOperation,
  buildSanitarioSyncV2RpcCall,
  type CloseAgendaOperation,
  type CreateAgendaOperation,
  executeSanitarioSyncV2Operation,
  type ReplaceAgendaAnimalsOperation,
  type SanitarioSyncV2Context,
  type SanitarioSyncV2Dependencies,
  type SanitarioSyncV2Gate,
  validateSanitarioSyncV2Envelope,
  validateSanitarioSyncV2Operation,
} from "./sanitario-v2";

const ids = {
  actor: "11111111-1111-4111-8111-111111111111",
  farm: "22222222-2222-4222-8222-222222222222",
  tx: "33333333-3333-4333-8333-333333333333",
  op: "44444444-4444-4444-8444-444444444444",
  domainOp: "55555555-5555-4555-8555-555555555555",
  agenda: "66666666-6666-4666-8666-666666666666",
  animal: "77777777-7777-4777-8777-777777777777",
  relation: "88888888-8888-4888-8888-888888888888",
  event: "99999999-9999-4999-8999-999999999999",
  closure: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const context: SanitarioSyncV2Context = {
  actorUserId: ids.actor,
  fazendaId: ids.farm,
  clientId: "client-test",
  clientTxId: ids.tx,
  membershipRole: "owner",
  now: new Date("2026-07-28T12:00:00.000Z"),
};

const enabledGate: SanitarioSyncV2Gate = {
  enabled: true,
  minimum_contract_version: 2,
  maximum_contract_version: 2,
  allowed_user_ids: [],
  allowed_client_ids: [],
  rollout_percentage: 100,
  valid_from: null,
  valid_until: null,
};

function createAgendaOperation(overrides: Record<string, unknown> = {}) {
  return {
    domain: "sanitario_v2",
    command: "create_agenda",
    contract_version: 2,
    client_tx_id: ids.tx,
    client_op_id: ids.op,
    domain_op_id: ids.domainOp,
    payload: {
      agenda: {
        id: ids.agenda,
        data_programada: "2026-08-01",
      },
      animal_ids: [ids.animal],
    },
    ...overrides,
  };
}

function dependencies(options?: {
  gate?: SanitarioSyncV2Gate | null;
  gateError?: { code?: string; message?: string };
  rpcData?: unknown;
  rpcError?: { code?: string; message?: string };
  order?: string[];
}): SanitarioSyncV2Dependencies {
  return {
    loadGate: vi.fn(async () => {
      options?.order?.push("gate");
      return {
        data: options && "gate" in options ? options.gate ?? null : enabledGate,
        error: options?.gateError ?? null,
      };
    }),
    callRpc: vi.fn(async () => {
      options?.order?.push("rpc");
      return {
        data: options && "rpcData" in options ? options.rpcData : {
          agenda_id: ids.agenda,
          status: "programada",
          revision: 0,
          replayed: false,
        },
        error: options?.rpcError ?? null,
      };
    }),
  };
}

describe("sync-batch sanitario v2: envelope e autorização", () => {
  it("valida fazenda, client e transação do envelope confiável", () => {
    expect(validateSanitarioSyncV2Envelope(context)).toBeNull();
    expect(
      validateSanitarioSyncV2Envelope({ ...context, fazendaId: "invalid" }),
    ).toBe(
      "SANITARIO_FAZENDA_CONTEXT_INVALID",
    );
    expect(validateSanitarioSyncV2Envelope({ ...context, clientId: "" })).toBe(
      "SANITARIO_CLIENT_CONTEXT_INVALID",
    );
    expect(
      validateSanitarioSyncV2Envelope({ ...context, clientTxId: "invalid" }),
    ).toBe(
      "SANITARIO_CLIENT_TX_CONTEXT_INVALID",
    );
  });

  it("rejeita comando desconhecido antes de consultar gate ou RPC", async () => {
    const deps = dependencies();
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation({ command: "unknown_command" }),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_COMMAND_NOT_ALLOWLISTED",
    });
    expect(deps.loadGate).not.toHaveBeenCalled();
    expect(deps.callRpc).not.toHaveBeenCalled();
  });

  it("rejeita ator informado e divergência de fazenda no payload", () => {
    const actor = validateSanitarioSyncV2Operation(
      createAgendaOperation({ actor_user_id: ids.actor }),
      context,
    );
    const farm = validateSanitarioSyncV2Operation(
      createAgendaOperation({
        payload: {
          agenda: { id: ids.agenda, fazenda_id: ids.actor },
          animal_ids: [ids.animal],
        },
      }),
      context,
    );

    expect(actor.ok).toBe(false);
    if (!actor.ok) {
      expect(actor.result.reason_code).toBe(
        "SANITARIO_ACTOR_MUST_COME_FROM_JWT",
      );
    }
    expect(farm.ok).toBe(false);
    if (!farm.ok) {
      expect(farm.result.reason_code).toBe(
        "SANITARIO_FAZENDA_CONTEXT_MISMATCH",
      );
    }
  });

  it("rejeita papel insuficiente antes do gate", async () => {
    const deps = dependencies();
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      { ...context, membershipRole: "cowboy" },
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_ROLE_NOT_ALLOWED",
    });
    expect(deps.loadGate).not.toHaveBeenCalled();
  });

  it("rejeita gate ausente ou desligado sem chamar RPC", async () => {
    for (const gate of [null, { ...enabledGate, enabled: false }]) {
      const deps = dependencies({ gate });
      const result = await executeSanitarioSyncV2Operation(
        createAgendaOperation(),
        context,
        deps,
      );

      expect(result).toMatchObject({
        status: "REJECTED",
        reason_code: "SANITARIO_SYNC_DISABLED",
      });
      expect(deps.callRpc).not.toHaveBeenCalled();
    }
  });

  it("consulta gate antes de validar a faixa contratual e antes da RPC", async () => {
    const order: string[] = [];
    const deps = dependencies({ order });
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation({ contract_version: 3 }),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_CLIENT_CONTRACT_OUTDATED",
    });
    expect(order).toEqual(["gate"]);
  });

  it("exige expected_revision nos comandos que alteram agenda existente", async () => {
    const deps = dependencies();
    const result = await executeSanitarioSyncV2Operation(
      {
        ...createAgendaOperation(),
        command: "replace_agenda_animals",
        payload: { agenda_id: ids.agenda, animal_ids: [ids.animal] },
      },
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_EXPECTED_REVISION_REQUIRED",
    });
    expect(deps.loadGate).toHaveBeenCalledOnce();
    expect(deps.callRpc).not.toHaveBeenCalled();
  });

  it("mantém gate fail-closed antes dos limites do payload", async () => {
    const deps = dependencies({ gate: null });
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation({
        payload: { agenda: { id: ids.agenda }, animal_ids: [] },
      }),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_SYNC_DISABLED",
    });
    expect(deps.callRpc).not.toHaveBeenCalled();
  });
});

describe("sync-batch sanitario v2: RPC e resultado canônico", () => {
  it("deriva ator, fazenda, client e transação do contexto confiável", () => {
    const validation = validateSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
    );
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const call = buildSanitarioSyncV2RpcCall(validation.operation, context);
    expect(call).toEqual({
      functionName: "internal_sanitario_sync_v2_create_agenda",
      args: expect.objectContaining({
        actor_user_id: ids.actor,
        fazenda_id: ids.farm,
        contract_version: 2,
        client_op_id: ids.op,
        domain_op_id: ids.domainOp,
        payload: expect.objectContaining({
          id: ids.agenda,
          client_id: context.clientId,
          client_tx_id: context.clientTxId,
        }),
      }),
    });
  });

  it("mapeia os quatro comandos para as quatro RPCs internas", () => {
    const operations = [
      createAgendaOperation(),
      {
        ...createAgendaOperation(),
        command: "replace_agenda_animals",
        expected_revision: 1,
        payload: { agenda_id: ids.agenda, animal_ids: [ids.animal] },
      },
      {
        ...createAgendaOperation(),
        command: "apply_factual_core",
        expected_revision: 1,
        payload: {
          event: {
            id: ids.event,
            natureza: "primary_execution",
            occurred_at: "2026-07-28T12:00:00.000Z",
            source_sanitario_agenda_v2_id: ids.agenda,
          },
          detail: { tipo: "vacinacao" },
          event_animals: [{ id: ids.relation, animal_id: ids.animal }],
        },
      },
      {
        ...createAgendaOperation(),
        command: "close_agenda",
        expected_revision: 1,
        payload: {
          closure: {
            id: ids.closure,
            agenda_id: ids.agenda,
            closure_type: "cancelled",
          },
        },
      },
    ];

    const functionNames = operations.map((operation) => {
      const validation = validateSanitarioSyncV2Operation(operation, context);
      expect(validation.ok).toBe(true);
      if (!validation.ok) throw new Error(validation.result.reason_code);
      return buildSanitarioSyncV2RpcCall(validation.operation, context)
        .functionName;
    });

    expect(functionNames).toEqual([
      "internal_sanitario_sync_v2_create_agenda",
      "internal_sanitario_sync_v2_replace_agenda_animals",
      "internal_sanitario_sync_v2_apply_factual_core",
      "internal_sanitario_sync_v2_close_agenda",
    ]);
  });

  it("retorna APPLIED com registro canônico em replay válido", async () => {
    const deps = dependencies({
      rpcData: {
        agenda_id: ids.agenda,
        status: "programada",
        revision: 0,
        animal_ids: [ids.animal],
        replayed: false,
      },
    });

    const first = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      deps,
    );
    const replay = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      deps,
    );

    expect(first).toMatchObject({
      status: "APPLIED",
      canonical_entity_id: ids.agenda,
      current_revision: 0,
      canonical_status: "programada",
      retryable: false,
    });
    expect(replay).toEqual(first);
  });

  it("classifica revision divergente como CONFLICT com revisão atual", async () => {
    const deps = dependencies({
      rpcError: {
        code: "40001",
        message: "SANITARIO_AGENDA_REVISION_CONFLICT current_revision=7",
      },
    });
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      reason_code: "SANITARIO_AGENDA_REVISION_CONFLICT",
      current_revision: 7,
      retryable: false,
    });
  });

  it("não converte 23505 não idempotente em APPLIED", async () => {
    const deps = dependencies({
      rpcError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "CONFLICT",
      reason_code: "SANITARIO_DATABASE_CONFLICT",
    });
  });

  it("classifica timeout como RETRYABLE e dependência ausente como BLOCKED_DEPENDENCY", async () => {
    const timeout = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      dependencies({
        rpcError: { code: "57014", message: "statement timeout" },
      }),
    );
    const dependency = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      dependencies({
        rpcError: { code: "42883", message: "function does not exist" },
      }),
    );

    expect(timeout).toMatchObject({ status: "RETRYABLE", retryable: true });
    expect(dependency).toMatchObject({
      status: "BLOCKED_DEPENDENCY",
      reason_code: "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
      retryable: false,
    });
  });

  it("mantém erro cross-farm como REJECTED", async () => {
    const result = await executeSanitarioSyncV2Operation(
      createAgendaOperation(),
      context,
      dependencies({
        rpcError: {
          code: "23503",
          message: "SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING",
        },
      }),
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING",
    });
  });
});

describe("sync-batch sanitario v2: serialização estrita", () => {
  it("serializa os quatro comandos removendo contexto não confiável", () => {
    const operationBase = {
      domain: "sanitario_v2" as const,
      contract_version: 2,
      client_tx_id: ids.tx,
      client_op_id: ids.op,
      domain_op_id: ids.domainOp,
    };
    const untrustedContext = {
      actor_user_id: "payload-actor",
      fazenda_id: "payload-farm",
      client_id: "payload-client",
      client_tx_id: "payload-tx",
    };

    const agenda = { id: ids.agenda, ...untrustedContext };
    const event = {
      id: ids.event,
      natureza: "primary_execution" as const,
      occurred_at: "2026-07-28T12:00:00.000Z",
      ...untrustedContext,
    };
    const detail = { tipo: "vacinacao", ...untrustedContext };
    const closure = {
      id: ids.closure,
      agenda_id: ids.agenda,
      closure_type: "cancelled" as const,
      ...untrustedContext,
    };

    const operations: [
      CreateAgendaOperation,
      ReplaceAgendaAnimalsOperation,
      ApplyFactualCoreOperation,
      CloseAgendaOperation,
    ] = [
      {
        ...operationBase,
        command: "create_agenda",
        payload: { agenda, animal_ids: [ids.animal] },
      },
      {
        ...operationBase,
        command: "replace_agenda_animals",
        expected_revision: 1,
        payload: { agenda_id: ids.agenda, animal_ids: [ids.animal] },
      },
      {
        ...operationBase,
        command: "apply_factual_core",
        expected_revision: null,
        payload: {
          event,
          detail,
          event_animals: [{ id: ids.relation, animal_id: ids.animal }],
        },
      },
      {
        ...operationBase,
        command: "close_agenda",
        expected_revision: 1,
        payload: { closure },
      },
    ];

    const [createCall, replaceCall, factualCall, closeCall] = operations.map(
      (operation) => buildSanitarioSyncV2RpcCall(operation, context),
    );

    expect(createCall.args).toMatchObject({
      actor_user_id: ids.actor,
      fazenda_id: ids.farm,
      payload: {
        id: ids.agenda,
        client_id: context.clientId,
        client_tx_id: context.clientTxId,
      },
    });
    expect(replaceCall.args).toMatchObject({
      client_id: context.clientId,
      agenda_id: ids.agenda,
    });
    expect(factualCall.args).toMatchObject({
      event_payload: {
        id: ids.event,
        natureza: "primary_execution",
        occurred_at: "2026-07-28T12:00:00.000Z",
        client_id: context.clientId,
        client_tx_id: context.clientTxId,
      },
      detail_payload: { tipo: "vacinacao" },
    });
    expect(closeCall.args).toMatchObject({
      payload: {
        id: ids.closure,
        agenda_id: ids.agenda,
        closure_type: "cancelled",
        client_id: context.clientId,
        client_tx_id: context.clientTxId,
      },
    });

    for (
      const payload of [
        createCall.args.payload,
        factualCall.args.event_payload,
        factualCall.args.detail_payload,
        closeCall.args.payload,
      ]
    ) {
      expect(payload).not.toHaveProperty("actor_user_id");
      expect(payload).not.toHaveProperty("fazenda_id");
    }
    expect(factualCall.args.detail_payload).not.toHaveProperty("client_id");
    expect(factualCall.args.detail_payload).not.toHaveProperty("client_tx_id");
  });
});
