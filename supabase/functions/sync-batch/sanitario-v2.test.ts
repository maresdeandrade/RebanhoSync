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
  validateSanitaryCorrectionSourceConsistency,
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

function externalHistoryOperation(input: {
  source?: "external_declared" | "external_documented";
  evidenceReference?: string | null;
  evidenceCoveredFields?: string[];
  event?: Record<string, unknown>;
  detail?: Record<string, unknown>;
} = {}) {
  const source = input.source ?? "external_documented";
  return {
    domain: "sanitario_v2",
    command: "apply_factual_core",
    contract_version: 2,
    client_tx_id: ids.tx,
    client_op_id: ids.op,
    domain_op_id: ids.domainOp,
    payload: {
      event: {
        id: ids.event,
        natureza: "standalone_fact",
        occurred_at: "2026-07-28T12:00:00.000Z",
        animal_id: ids.animal,
        source_sanitario_agenda_v2_id: null,
        corrige_evento_id: null,
        payload: {
          entry_history_source: source,
          evidence_class: source === "external_documented"
            ? "documented"
            : "declared",
          evidence_reference: input.evidenceReference ??
            (source === "external_documented" ? "certificado-b19-2024" : null),
          evidence_covered_fields: input.evidenceCoveredFields ??
            (source === "external_documented"
              ? ["protocol_item_completion"]
              : []),
          creates_agenda: false,
          creates_local_execution: false,
          creates_stock_movement: false,
          creates_active_withdrawal: false,
        },
        ...input.event,
      },
      detail: {
        tipo: "vacinacao",
        produto_sanitario_v2_id: null,
        insumo_id: null,
        estoque_lote_id: null,
        carencia_carne_dias: null,
        carencia_leite_dias: null,
        carencia_carne_ate: null,
        carencia_leite_ate: null,
        payload: {},
        ...input.detail,
      },
      event_animals: [{ id: ids.relation, animal_id: ids.animal }],
    },
  };
}

function correctionOperation(overrides: {
  event?: Record<string, unknown>;
  detail?: Record<string, unknown>;
  correction?: Record<string, unknown>;
} = {}) {
  return {
    domain: "sanitario_v2",
    command: "apply_factual_core",
    contract_version: 2,
    client_tx_id: ids.tx,
    client_op_id: ids.op,
    domain_op_id: ids.domainOp,
    payload: {
      event: {
        id: ids.event,
        natureza: "correction",
        occurred_at: "2026-07-28T12:00:00.000Z",
        animal_id: ids.animal,
        lote_id: null,
        source_sanitario_agenda_v2_id: null,
        corrige_evento_id: ids.agenda,
        observacoes: "Custo conferido.",
        payload: {
          schema: "sanitary_correction_v2",
          creates_active_withdrawal: false,
          sanitary_correction: {
            schema_version: 1,
            evento_origem_id: ids.agenda,
            corrige_evento_id: ids.agenda,
            tipo_correcao: "correcao_custo",
            motivo: "Custo conferido.",
            payload_original_snapshot: { event: {}, detail: {} },
            payload_correcao: {
              custo_unitario_snapshot: 6,
              custo_total_snapshot: 12,
            },
            created_by: ids.actor,
            created_at: "2026-07-28T12:00:00.000Z",
            fazenda_id: ids.farm,
            idempotency_key: ids.event,
            request_fingerprint: "fnv1a32:12345678",
            technical_correction: false,
            ...overrides.correction,
          },
        },
        ...overrides.event,
      },
      detail: {
        tipo: "vacinacao",
        produto_sanitario_v2_id: ids.closure,
        insumo_id: null,
        estoque_lote_id: null,
        produto_nome_snapshot: "Vacina A",
        produto_snapshot: { eventId: ids.agenda },
        dose_quantidade: 2,
        dose_unidade: "ml",
        via_aplicacao: "subcutanea",
        custo_unitario_snapshot: 6,
        custo_total_snapshot: 12,
        carencia_carne_dias: null,
        carencia_leite_dias: null,
        carencia_carne_ate: null,
        carencia_leite_ate: null,
        payload: {},
        ...overrides.detail,
      },
      event_animals: [{ id: ids.relation, animal_id: ids.animal }],
    },
  };
}

function dependencies(options?: {
  gate?: SanitarioSyncV2Gate | null;
  gateError?: { code?: string; message?: string };
  rpcData?: unknown;
  rpcError?: { code?: string; message?: string };
  evidenceReason?: string | null;
  evidenceError?: { code?: string; message?: string };
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
    validateProductEvidence: vi.fn(async () => ({
      reasonCode: options?.evidenceReason ?? null,
      error: options?.evidenceError ?? null,
    })),
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

describe("sync-batch sanitario v2: histórico externo/documental", () => {
  it("aceita documentado com referência/cobertura e declaração fail-closed", () => {
    const documented = validateSanitarioSyncV2Operation(
      externalHistoryOperation(),
      context,
    );
    const declared = validateSanitarioSyncV2Operation(
      externalHistoryOperation({ source: "external_declared" }),
      context,
    );

    expect(documented.ok).toBe(true);
    expect(declared.ok).toBe(true);
    if (documented.ok) {
      expect(buildSanitarioSyncV2RpcCall(documented.operation, context))
        .toMatchObject({
          functionName: "internal_sanitario_sync_v2_apply_factual_core",
          args: {
            expected_revision: null,
            event_payload: {
              natureza: "standalone_fact",
              animal_id: ids.animal,
            },
            event_animals: [{ id: ids.relation, animal_id: ids.animal }],
          },
        });
    }
  });

  it("preserva referência, cobertura e snapshots críticos enviados ao fingerprint remoto", () => {
    const raw = externalHistoryOperation({
      event: {
        payload: {
          entry_history_source: "external_documented",
          evidence_class: "documented",
          evidence_reference: "certificado-b19-revisao-2",
          evidence_covered_fields: [
            "protocol_item_completion",
            "product_class",
          ],
          protocol_snapshot: { id: "protocol-b19", version: 3 },
          creates_agenda: false,
          creates_local_execution: false,
          creates_stock_movement: false,
          creates_active_withdrawal: false,
        },
      },
      detail: {
        produto_snapshot: {
          product_class: "vacina_b19",
          evidence_covered_fields: ["product_class"],
        },
      },
    });
    const validation = validateSanitarioSyncV2Operation(raw, context);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(buildSanitarioSyncV2RpcCall(validation.operation, context).args)
      .toMatchObject({
        event_payload: {
          payload: {
            evidence_reference: "certificado-b19-revisao-2",
            evidence_covered_fields: [
              "protocol_item_completion",
              "product_class",
            ],
            protocol_snapshot: { id: "protocol-b19", version: 3 },
          },
        },
        detail_payload: {
          produto_snapshot: {
            product_class: "vacina_b19",
            evidence_covered_fields: ["product_class"],
          },
        },
      });
  });

  it("rejeita documentado sem referência antes da RPC", async () => {
    const deps = dependencies();
    const result = await executeSanitarioSyncV2Operation(
      externalHistoryOperation({ evidenceReference: " " }),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      reason_code: "SANITARIO_EXTERNAL_DOCUMENT_REFERENCE_REQUIRED",
    });
    expect(deps.callRpc).not.toHaveBeenCalled();
  });

  it("rejeita evidência técnica inválida antes da RPC sem promover falha parcial a sucesso", async () => {
    const deps = dependencies({
      evidenceReason: "SANITARIO_PRODUCT_FIELD_COVERAGE_MISMATCH",
    });
    const result = await executeSanitarioSyncV2Operation(
      externalHistoryOperation(),
      context,
      deps,
    );

    expect(result).toMatchObject({
      status: "REJECTED",
      retryable: false,
      reason_code: "SANITARIO_PRODUCT_FIELD_COVERAGE_MISMATCH",
    });
    expect(deps.callRpc).not.toHaveBeenCalled();
  });

  it("rejeita Agenda, execução primária, estoque e carência no histórico externo", () => {
    const agenda = validateSanitarioSyncV2Operation(
      externalHistoryOperation({
        event: {
          natureza: "primary_execution",
          source_sanitario_agenda_v2_id: ids.agenda,
        },
      }),
      context,
    );
    const stock = validateSanitarioSyncV2Operation(
      externalHistoryOperation({ detail: { estoque_lote_id: ids.agenda } }),
      context,
    );
    const withdrawal = validateSanitarioSyncV2Operation(
      externalHistoryOperation({ detail: { carencia_carne_dias: 30 } }),
      context,
    );

    expect(agenda.ok).toBe(false);
    if (!agenda.ok) {
      expect(agenda.result.reason_code).toBe(
        "SANITARIO_EXTERNAL_HISTORY_MUST_BE_STANDALONE_FACT",
      );
    }
    for (const validation of [stock, withdrawal]) {
      expect(validation.ok).toBe(false);
      if (!validation.ok) {
        expect(validation.result.reason_code).toBe(
          "SANITARIO_EXTERNAL_HISTORY_FORBIDDEN_EFFECT",
        );
      }
    }
  });

  it("mantém replay idempotente e conflito de conteúdo divergente explícitos", async () => {
    const replayDependencies = dependencies({
      rpcData: {
        evento_id: ids.event,
        animal_ids: [ids.animal],
        replayed: true,
      },
    });
    const operation = externalHistoryOperation();
    const first = await executeSanitarioSyncV2Operation(
      operation,
      context,
      replayDependencies,
    );
    const replay = await executeSanitarioSyncV2Operation(
      operation,
      context,
      replayDependencies,
    );
    const conflict = await executeSanitarioSyncV2Operation(
      operation,
      context,
      dependencies({
        rpcError: {
          code: "23505",
          message: "SANITARIO_IDEMPOTENCY_PAYLOAD_MISMATCH",
        },
      }),
    );

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      status: "APPLIED",
      canonical_entity_id: ids.event,
    });
    expect(conflict).toMatchObject({
      status: "CONFLICT",
      reason_code: "SANITARIO_IDEMPOTENCY_PAYLOAD_MISMATCH",
    });
  });
});

describe("sync-batch sanitario v2: correção append-only", () => {
  it("aceita correção factual vinculada com motivo e taxonomia ativa", () => {
    const validation = validateSanitarioSyncV2Operation(
      correctionOperation(),
      context,
    );
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(buildSanitarioSyncV2RpcCall(validation.operation, context))
      .toMatchObject({
        functionName: "internal_sanitario_sync_v2_apply_factual_core",
        args: {
          event_payload: {
            natureza: "correction",
            corrige_evento_id: ids.agenda,
            observacoes: "Custo conferido.",
          },
        },
      });
  });

  it("rejeita motivo ausente, autorreferência, Agenda e campo fora da taxonomia", () => {
    const cases = [
      correctionOperation({
        event: { observacoes: "" },
        correction: { motivo: "" },
      }),
      correctionOperation({
        event: { corrige_evento_id: ids.event },
        correction: { corrige_evento_id: ids.event },
      }),
      correctionOperation({
        event: { source_sanitario_agenda_v2_id: ids.agenda },
      }),
      correctionOperation({
        correction: { payload_correcao: { via_aplicacao: "oral" } },
      }),
    ];
    const reasons = cases.map((operation) => {
      const result = validateSanitarioSyncV2Operation(operation, context);
      expect(result.ok).toBe(false);
      return result.ok ? null : result.result.reason_code;
    });
    expect(reasons).toEqual([
      "SANITARIO_CORRECTION_PAYLOAD_INVALID",
      "SANITARIO_CORRECTION_REFERENCE_INVALID",
      "SANITARIO_CORRECTION_REFERENCE_INVALID",
      "SANITARIO_CORRECTION_FIELDS_UNSUPPORTED",
    ]);
  });

  it("rejeita carência e mudança técnica disfarçada de correção de custo", () => {
    for (
      const operation of [
        correctionOperation({ detail: { carencia_carne_dias: 30 } }),
        correctionOperation({ correction: { technical_correction: true } }),
      ]
    ) {
      const result = validateSanitarioSyncV2Operation(operation, context);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.result.status).toBe("REJECTED");
    }
  });

  it("compara detalhe e animais ao fato corrigido e expõe conflito divergente", () => {
    const validation = validateSanitarioSyncV2Operation(
      correctionOperation(),
      context,
    );
    expect(validation.ok).toBe(true);
    if (
      !validation.ok || validation.operation.command !== "apply_factual_core"
    ) return;
    const sourceDetail = {
      tipo: "vacinacao",
      produto_sanitario_v2_id: ids.closure,
      insumo_id: null,
      estoque_lote_id: null,
      produto_nome_snapshot: "Vacina A",
      produto_snapshot: { eventId: ids.agenda },
      estoque_lote_codigo_snapshot: null,
      lote_fabricante: null,
      validade_produto: null,
      dose_quantidade: 2,
      dose_unidade: "ml",
      via_aplicacao: "subcutanea",
      responsavel_nome: null,
      responsavel_tipo: null,
      custo_unitario_snapshot: 5,
      custo_total_snapshot: 10,
    };
    const base = {
      operation: validation.operation,
      sourceEvent: { id: ids.agenda, animal_id: ids.animal, lote_id: null },
      sourceDetail,
      sourceAnimalIds: [ids.animal],
    };
    expect(validateSanitaryCorrectionSourceConsistency(base)).toBeNull();
    expect(validateSanitaryCorrectionSourceConsistency({
      ...base,
      sourceAnimalIds: [ids.actor],
    })).toBe("SANITARIO_CORRECTION_ANIMALS_MISMATCH");

    const divergent = validateSanitarioSyncV2Operation(
      correctionOperation({ detail: { via_aplicacao: "oral" } }),
      context,
    );
    expect(divergent.ok).toBe(true);
    if (!divergent.ok || divergent.operation.command !== "apply_factual_core") {
      return;
    }
    expect(validateSanitaryCorrectionSourceConsistency({
      ...base,
      operation: divergent.operation,
    })).toBe("SANITARIO_CORRECTION_UNDECLARED_CHANGE");

    const technical = validateSanitarioSyncV2Operation(
      correctionOperation({
        correction: {
          tipo_correcao: "complemento_rastreabilidade",
          payload_correcao: { dose_quantidade: 3 },
          technical_correction: true,
        },
        detail: {
          dose_quantidade: 3,
          custo_unitario_snapshot: 5,
          custo_total_snapshot: 10,
          produto_snapshot: { eventId: ids.event },
        },
      }),
      context,
    );
    expect(technical.ok).toBe(true);
    if (!technical.ok || technical.operation.command !== "apply_factual_core") {
      return;
    }
    expect(validateSanitaryCorrectionSourceConsistency({
      ...base,
      operation: technical.operation,
    })).toBeNull();
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
