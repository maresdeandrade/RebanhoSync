import { buildInventoryCostSnapshot } from "@/lib/inventory/costing";
import { db as defaultDb, type OfflineDB } from "@/lib/offline/db";
import type {
  Evento,
  EventoSanitario,
  InsumoMovimentacao,
  InsumoUnidadeBaseEnum,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
  SanitarioTipoEnum,
} from "@/lib/offline/types";

export type ExecuteSanitaryAgendaInputV2 = {
  fazendaId: string;
  agendaId: string;
  clientOpId: string;
  executedAt: string;
  responsibleName?: string;
  notes?: string;
  product?: {
    productId?: string;
    productName: string;
    productClass?: string | null;
    productClassGroupId?: string | null;
    inventoryLotId?: string | null;
    quantityConsumed?: number | null;
    unit?: string | null;
  };
  application?: {
    dose?: number | null;
    doseUnit?: string | null;
    route?: string | null;
  };
  confirmation: {
    userConfirmedExecution: true;
    userConfirmedStockMovement?: boolean;
    userConfirmedWithdrawal?: boolean;
  };
};

export type ExecuteSanitaryAgendaResultV2 = {
  eventId: string;
  agendaId: string;
  clientOpId: string;
  agendaStatus: "executed";
  createsEvent: true;
  createsStockMovement: boolean;
  createsActiveWithdrawal: boolean;
};

export type SanitaryAgendaExecutionDbV2 = Pick<
  OfflineDB,
  | "ops_sanitario_agenda_v2"
  | "ops_sanitario_agenda_animais_v2"
  | "event_eventos"
  | "event_eventos_sanitario"
  | "state_insumos"
  | "state_insumo_lotes"
  | "state_insumo_movimentacoes"
  | "catalog_sanitario_produto_carencia_rules_v2"
  | "catalog_sanitario_produtos_v2"
  | "transaction"
>;

type ProductRequirementKindV2 =
  | "specific_product"
  | "product_class"
  | "product_class_group"
  | "none"
  | string;

type WithdrawalResolutionV2 = {
  rule: SanitarioProdutoCarenciaRuleLocalV2 | null;
  carneDias: number | null;
  leiteDias: number | null;
  carneAte: string | null;
  leiteAte: string | null;
  createsActiveWithdrawal: boolean;
  reason: string;
};

const PRODUCT_REQUIRED_KINDS = new Set([
  "specific_product",
  "product_class",
  "product_class_group",
]);

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDateTime(value: string | undefined): string | null {
  if (!value) return null;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(value)?.[1];
  const candidate = dateOnly ? `${dateOnly}T12:00:00.000Z` : value;
  const date = new Date(candidate);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  if (dateOnly && iso.slice(0, 10) !== dateOnly) return null;
  return iso;
}

function addDays(dateTime: string, days: number | null): string | null {
  if (!days || days <= 0) return null;
  const [year, month, day] = dateTime.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventIdFor(input: Pick<ExecuteSanitaryAgendaInputV2, "agendaId" | "clientOpId">) {
  return `sanitary-agenda-execution-v2:${input.agendaId}:${input.clientOpId}`;
}

function productRequirementKind(agenda: SanitarioAgendaLocalV2): ProductRequirementKindV2 {
  return (
    readString(
      agenda.metadata.productRequirementKind,
      agenda.protocol_item_snapshot.productRequirementKind,
      agenda.protocol_item_snapshot.product_requirement_kind,
    ) ?? "none"
  );
}

function expectedProductClass(agenda: SanitarioAgendaLocalV2): string | null {
  return readString(
    agenda.produto_classe,
    agenda.metadata.productClass,
    agenda.protocol_item_snapshot.productClass,
    agenda.protocol_item_snapshot.product_class,
  );
}

function expectedProductId(agenda: SanitarioAgendaLocalV2): string | null {
  const productSnapshot = readRecord(agenda.produto_snapshot);
  return readString(
    agenda.produto_veterinario_id,
    productSnapshot.productId,
    productSnapshot.plannedProductId,
    agenda.protocol_item_snapshot.productId,
    agenda.protocol_item_snapshot.product_id,
  );
}

function itemKey(agenda: SanitarioAgendaLocalV2): string | null {
  return readString(
    agenda.metadata.itemKey,
    agenda.protocol_item_snapshot.itemKey,
    agenda.protocol_item_snapshot.logicalItemKey,
    agenda.protocol_item_snapshot.logical_item_key,
  );
}

function actionTypeToSanitaryType(actionType: string | null): SanitarioTipoEnum {
  if (actionType === "vermifugacao") return "vermifugacao";
  if (actionType === "medicamento" || actionType === "tratamento" || actionType === "exame") {
    return "medicamento";
  }
  return "vacinacao";
}

function actionType(agenda: SanitarioAgendaLocalV2): string | null {
  return readString(
    agenda.protocol_item_snapshot.actionType,
    agenda.protocol_item_snapshot.action_type,
    agenda.acao_sanitaria,
  );
}

function targetAnimalIds(entries: SanitarioAgendaAnimalLocalV2[], agenda: SanitarioAgendaLocalV2) {
  const metadata = readRecord(agenda.metadata);
  const target = readRecord(metadata.target);
  const targetAnimalIds = Array.isArray(metadata.targetAnimalIds)
    ? metadata.targetAnimalIds.filter((entry): entry is string => typeof entry === "string")
    : [];
  const directAnimal =
    target.scope === "animal" && typeof target.id === "string" ? [target.id] : [];
  return Array.from(
    new Set([...entries.map((entry) => entry.animal_id), ...targetAnimalIds, ...directAnimal]),
  ).filter(Boolean).sort();
}

function validateExecutionInput(input: ExecuteSanitaryAgendaInputV2) {
  const rejected: string[] = [];
  const executedAt = normalizeDateTime(input.executedAt);
  if (!input.fazendaId) rejected.push("missing_fazenda_id");
  if (!input.agendaId) rejected.push("missing_agenda_id");
  if (!input.clientOpId) rejected.push("missing_client_op_id");
  if (!input.confirmation?.userConfirmedExecution) rejected.push("missing_confirmation");
  if (!input.executedAt) rejected.push("missing_executed_at");
  if (input.executedAt && !executedAt) rejected.push("invalid_executed_at");
  return { ok: rejected.length === 0, rejected, executedAt };
}

function validateAgainstAgenda(input: {
  agenda: SanitarioAgendaLocalV2;
  agendaAnimals: SanitarioAgendaAnimalLocalV2[];
  request: ExecuteSanitaryAgendaInputV2;
}) {
  const { agenda, agendaAnimals, request } = input;
  const rejected: string[] = [];
  const requirement = productRequirementKind(agenda);
  const requiresProduct = PRODUCT_REQUIRED_KINDS.has(requirement);
  const realProductName = request.product?.productName?.trim();
  const dose = request.application?.dose ?? null;
  const doseUnit = request.application?.doseUnit?.trim();
  const route = request.application?.route?.trim();
  const animals = targetAnimalIds(agendaAnimals, agenda);
  const metadata = readRecord(agenda.metadata);

  if (agenda.fazenda_id !== request.fazendaId || agenda.deleted_at) {
    rejected.push("agenda_not_found");
  }
  if (!agenda.protocolo_id || !itemKey(agenda)) rejected.push("missing_protocol_item");
  if (!agenda.lote_id && animals.length === 0) rejected.push("missing_target");
  if (
    metadata.source === "sanitary_precheck_preview_v2" &&
    metadata.targetAnimalScope !== "lote_sem_animais_explicitos" &&
    animals.length === 0
  ) {
    rejected.push("missing_target_animals");
  }
  if (agenda.status !== "programada") rejected.push("agenda_not_executable");
  if (requiresProduct && (!request.product?.productId || !realProductName)) {
    rejected.push("missing_registered_product");
  }
  if ((requiresProduct || realProductName) && (!dose || dose <= 0)) rejected.push("missing_dose");
  if ((requiresProduct || realProductName) && !doseUnit) rejected.push("missing_dose_unit");
  if ((requiresProduct || realProductName) && !route) rejected.push("missing_route");

  const plannedProductId = expectedProductId(agenda);
  if (
    requirement === "specific_product" &&
    plannedProductId &&
    request.product?.productId &&
    request.product.productId !== plannedProductId
  ) {
    rejected.push("product_mismatch");
  }

  const plannedClass = expectedProductClass(agenda);
  if (
    requirement === "product_class" &&
    plannedClass &&
    request.product?.productClass &&
    request.product.productClass !== plannedClass
  ) {
    rejected.push("product_class_mismatch");
  }

  return { ok: rejected.length === 0, rejected, targetAnimalIds: animals };
}

async function findExistingExecution(
  db: SanitaryAgendaExecutionDbV2,
  input: ExecuteSanitaryAgendaInputV2,
) {
  const eventId = eventIdFor(input);
  const byId = await db.event_eventos.get(eventId);
  if (byId && byId.fazenda_id === input.fazendaId && !byId.deleted_at) return byId;
  return db.event_eventos
    .where("fazenda_id")
    .equals(input.fazendaId)
    .filter(
      (event) =>
        event.source_task_id === input.agendaId &&
        event.source_client_op_id === input.clientOpId &&
        !event.deleted_at,
    )
    .first();
}

function explicitWithdrawalRule(
  rules: SanitarioProdutoCarenciaRuleLocalV2[],
  input: ExecuteSanitaryAgendaInputV2,
  executedAt: string,
): WithdrawalResolutionV2 {
  if (!input.product?.productId) {
    return {
      rule: null,
      carneDias: null,
      leiteDias: null,
      carneAte: null,
      leiteAte: null,
      createsActiveWithdrawal: false,
      reason: "missing_product_id",
    };
  }
  const route = input.application?.route?.trim();
  const dateKey = executedAt.slice(0, 10);
  const candidates = rules.filter((rule) => {
    if (rule.deleted_at || rule.status_curatorial !== "ativo") return false;
    if (rule.applicability !== "period" && rule.applicability !== "zero") return false;
    if (rule.valid_from && rule.valid_from > dateKey) return false;
    if (rule.valid_until && rule.valid_until < dateKey) return false;
    if (rule.route && route && rule.route !== route) return false;
    return true;
  });
  if (candidates.length !== 1) {
    return {
      rule: null,
      carneDias: null,
      leiteDias: null,
      carneAte: null,
      leiteAte: null,
      createsActiveWithdrawal: false,
      reason: candidates.length === 0 ? "missing_explicit_rule" : "ambiguous_rule",
    };
  }

  const rule = candidates[0];
  const leiteDias =
    rule.milk_days ?? (rule.milk_hours ? Math.ceil(rule.milk_hours / 24) : null);
  const carneAte = addDays(executedAt, rule.meat_days);
  const leiteAte = addDays(executedAt, leiteDias);
  return {
    rule,
    carneDias: rule.meat_days,
    leiteDias,
    carneAte,
    leiteAte,
    createsActiveWithdrawal: Boolean(carneAte || leiteAte),
    reason: "explicit_product_rule",
  };
}

function syncMeta(input: ExecuteSanitaryAgendaInputV2, now: string) {
  return {
    client_id: "sanitary-agenda-execution-v2",
    client_op_id: input.clientOpId,
    client_tx_id: null,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function buildRecords(input: {
  request: ExecuteSanitaryAgendaInputV2;
  agenda: SanitarioAgendaLocalV2;
  agendaAnimals: SanitarioAgendaAnimalLocalV2[];
  executedAt: string;
  targetAnimalIds: string[];
  withdrawal: WithdrawalResolutionV2;
  inventory?: {
    insumoId: string;
    inventoryLotId: string;
    unit: InsumoUnidadeBaseEnum;
    costUnit: number | null;
    costTotal: number | null;
  } | null;
}) {
  const { request, agenda, executedAt, targetAnimalIds, withdrawal, inventory } = input;
  const now = new Date().toISOString();
  const meta = syncMeta(request, now);
  const eventId = eventIdFor(request);
  const productName = request.product?.productName.trim() || "Produto não informado";
  const productSnapshot = {
    productId: request.product?.productId ?? null,
    productName,
    productClass: request.product?.productClass ?? null,
    productClassGroupId:
      request.product?.productClassGroupId ??
      readString(agenda.metadata.productClassGroupId, agenda.protocol_item_snapshot.productClassGroupId),
    dose: request.application?.dose ?? null,
    doseUnit: request.application?.doseUnit ?? null,
    route: request.application?.route ?? null,
  };
  const payload = {
    schema: "sanitary_agenda_execution_v2",
    agenda_id: agenda.id,
    client_op_id: request.clientOpId,
    creates_event: true,
    creates_stock_movement: Boolean(inventory),
    creates_active_withdrawal: withdrawal.createsActiveWithdrawal,
    animal_ids: targetAnimalIds,
    target_animal_ids: targetAnimalIds,
    produto_veterinario_id: request.product?.productId ?? null,
    product: productSnapshot,
    withdrawal: {
      reason: withdrawal.reason,
      rule_snapshot: withdrawal.rule,
      source_evento_id: eventId,
    },
    warnings: [
      ...(request.product && !request.product.inventoryLotId
        ? ["Produto informado sem baixa de estoque."]
        : []),
      ...(productRequirementKind(agenda) === "product_class_group"
        ? [
            "Grupo técnico não define dose nem carência. A carência só será calculada se houver regra explícita para o produto executado.",
          ]
        : []),
    ],
  };

  const event: Evento = {
    id: eventId,
    fazenda_id: request.fazendaId,
    dominio: "sanitario",
    occurred_at: executedAt,
    occurred_on: executedAt.slice(0, 10),
    animal_id: targetAnimalIds.length === 1 ? targetAnimalIds[0] : null,
    lote_id: agenda.lote_id,
    source_task_id: agenda.id,
    source_tx_id: null,
    source_client_op_id: request.clientOpId,
    corrige_evento_id: null,
    sanitario_caso_id: null,
    observacoes: request.notes?.trim() || null,
    payload,
    ...meta,
  };

  const detail: EventoSanitario = {
    evento_id: eventId,
    fazenda_id: request.fazendaId,
    tipo: actionTypeToSanitaryType(actionType(agenda)),
    produto: productName,
    produto_veterinario_id: request.product?.productId ?? expectedProductId(agenda),
    produto_nome_snapshot: productName,
    estoque_lote_id: request.product?.inventoryLotId ?? null,
    estoque_lote_codigo_snapshot: request.product?.inventoryLotId ?? null,
    lote_fabricante: null,
    validade_produto: null,
    dose_quantidade: request.application?.dose ?? null,
    dose_unidade: request.application?.doseUnit ?? null,
    via_aplicacao: request.application?.route ?? null,
    responsavel_nome: request.responsibleName?.trim() || null,
    responsavel_tipo: request.responsibleName?.trim() ? "informado" : null,
    carencia_carne_dias: withdrawal.carneDias,
    carencia_leite_dias: withdrawal.leiteDias,
    carencia_carne_ate: withdrawal.carneAte,
    carencia_leite_ate: withdrawal.leiteAte,
    custo_unitario_snapshot: inventory?.costUnit ?? null,
    custo_total_snapshot: inventory?.costTotal ?? null,
    protocol_item_version_id: agenda.protocol_item_version_id,
    protocol_item_logical_key: itemKey(agenda),
    protocol_item_version: readNumber(agenda.protocol_item_snapshot.version),
    protocol_item_snapshot: agenda.protocol_item_snapshot,
    payload,
    ...meta,
  };

  const movement: InsumoMovimentacao | null = inventory
    ? {
        id: eventId,
        fazenda_id: request.fazendaId,
        insumo_id: inventory.insumoId,
        insumo_lote_id: inventory.inventoryLotId,
        tipo: "consumo_sanitario",
        quantidade_base: request.product?.quantityConsumed ?? 0,
        unidade_base: inventory.unit,
        occurred_at: executedAt,
        source_evento_id: eventId,
        source_evento_dominio: "sanitario",
        animal_id: targetAnimalIds.length === 1 ? targetAnimalIds[0] : null,
        rebanho_lote_id: agenda.lote_id,
        pasto_id: null,
        observacoes: request.notes?.trim() || null,
        custo_unitario_snapshot: inventory.costUnit,
        custo_total_snapshot: inventory.costTotal,
        payload: {
          origem_movimentacao: "baixa_automatica_evento",
          source_evento_id: eventId,
          source: "sanitary_agenda_execution_v2",
        },
        ...meta,
      }
    : null;

  return { event, detail, movement, now };
}

export async function executeSanitaryAgendaV2(
  input: ExecuteSanitaryAgendaInputV2,
  localDb: SanitaryAgendaExecutionDbV2 = defaultDb,
): Promise<ExecuteSanitaryAgendaResultV2> {
  const basicValidation = validateExecutionInput(input);
  if (!basicValidation.ok || !basicValidation.executedAt) {
    throw new Error(`SANITARY_AGENDA_EXECUTION_REJECTED:${basicValidation.rejected.join(",")}`);
  }

  const existing = await findExistingExecution(localDb, input);
  if (existing) {
    return {
      eventId: existing.id,
      agendaId: input.agendaId,
      clientOpId: input.clientOpId,
      agendaStatus: "executed",
      createsEvent: true,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    };
  }

  const agenda = await localDb.ops_sanitario_agenda_v2.get(input.agendaId);
  if (!agenda) {
    throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:agenda_not_found");
  }
  if (agenda.execution_evento_id) {
    return {
      eventId: agenda.execution_evento_id,
      agendaId: agenda.id,
      clientOpId: input.clientOpId,
      agendaStatus: "executed",
      createsEvent: true,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    };
  }

  const agendaAnimals = await localDb.ops_sanitario_agenda_animais_v2
    .where("agenda_id")
    .equals(input.agendaId)
    .toArray();
  const agendaValidation = validateAgainstAgenda({ agenda, agendaAnimals, request: input });
  if (!agendaValidation.ok) {
    throw new Error(`SANITARY_AGENDA_EXECUTION_REJECTED:${agendaValidation.rejected.join(",")}`);
  }

  const withdrawalRules = input.product?.productId
    ? await localDb.catalog_sanitario_produto_carencia_rules_v2
        .where("product_id")
        .equals(input.product.productId)
        .toArray()
    : [];
  const withdrawal = explicitWithdrawalRule(withdrawalRules, input, basicValidation.executedAt);

  let inventory: {
    insumoId: string;
    inventoryLotId: string;
    unit: InsumoUnidadeBaseEnum;
    costUnit: number | null;
    costTotal: number | null;
  } | null = null;
  if (input.product?.inventoryLotId) {
    if (!input.confirmation.userConfirmedStockMovement) {
      throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:missing_stock_confirmation");
    }
    if (!input.product.quantityConsumed || input.product.quantityConsumed <= 0) {
      throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:missing_stock_quantity");
    }
    const lot = await localDb.state_insumo_lotes.get(input.product.inventoryLotId);
    if (!lot || lot.fazenda_id !== input.fazendaId || lot.deleted_at) {
      throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:inventory_lot_not_found");
    }
    const cost = buildInventoryCostSnapshot({
      lot,
      quantidadeBase: input.product.quantityConsumed,
    });
    inventory = {
      insumoId: lot.insumo_id,
      inventoryLotId: lot.id,
      unit: (input.product.unit || lot.unidade_base) as InsumoUnidadeBaseEnum,
      costUnit: cost.custo_unitario_snapshot,
      costTotal: cost.custo_total_snapshot,
    };
  }

  const records = buildRecords({
    request: input,
    agenda,
    agendaAnimals,
    executedAt: basicValidation.executedAt,
    targetAnimalIds: agendaValidation.targetAnimalIds,
    withdrawal,
    inventory,
  });

  await localDb.transaction(
    "rw",
    [
      localDb.ops_sanitario_agenda_v2,
      localDb.ops_sanitario_agenda_animais_v2,
      localDb.event_eventos,
      localDb.event_eventos_sanitario,
      localDb.state_insumo_lotes,
      localDb.state_insumo_movimentacoes,
    ],
    async () => {
      const current = await localDb.ops_sanitario_agenda_v2.get(input.agendaId);
      if (!current || current.deleted_at || current.fazenda_id !== input.fazendaId) {
        throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:agenda_not_found");
      }
      if (current.execution_evento_id) return;
      if (current.status !== "programada") {
        throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:agenda_not_executable");
      }

      await localDb.event_eventos.add(records.event);
      await localDb.event_eventos_sanitario.add(records.detail);
      if (records.movement) {
        const lot = await localDb.state_insumo_lotes.get(records.movement.insumo_lote_id);
        if (!lot || lot.fazenda_id !== input.fazendaId || lot.deleted_at) {
          throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:inventory_lot_not_found");
        }
        if (lot.saldo_atual_base < records.movement.quantidade_base) {
          throw new Error("SANITARY_AGENDA_EXECUTION_REJECTED:insufficient_stock_balance");
        }
        await localDb.state_insumo_movimentacoes.put(records.movement);
        await localDb.state_insumo_lotes.update(lot.id, {
          saldo_atual_base: lot.saldo_atual_base - records.movement.quantidade_base,
          updated_at: records.now,
        });
      }
      await localDb.ops_sanitario_agenda_v2.update(input.agendaId, {
        status: "executada",
        execution_evento_id: records.event.id,
        updated_at: records.now,
        metadata: {
          ...agenda.metadata,
          execution: {
            status: "executed",
            eventId: records.event.id,
            executedAt: basicValidation.executedAt,
            clientOpId: input.clientOpId,
          },
        },
      });
      await localDb.ops_sanitario_agenda_animais_v2.bulkPut(
        agendaAnimals.map((entry) => ({
          ...entry,
          planned_status: "executado",
          execution_evento_id: records.event.id,
          updated_at: records.now,
        })),
      );
    },
  );

  return {
    eventId: records.event.id,
    agendaId: agenda.id,
    clientOpId: input.clientOpId,
    agendaStatus: "executed",
    createsEvent: true,
    createsStockMovement: Boolean(records.movement),
    createsActiveWithdrawal: withdrawal.createsActiveWithdrawal,
  };
}
