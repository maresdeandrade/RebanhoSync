import type { OperationInput, InsumoUnidadeBaseEnum } from "@/lib/offline/types";
import type { EventGestureBuildResult, EventInput } from "./types";
import { assertValidEventInput } from "./validators";
import { buildVeterinaryProductMetadata } from "@/lib/sanitario/catalog/products";
import { buildProdutoInsumoSnapshot } from "@/lib/inventory/snapshotBuilder";
import { buildConsumoMovimentacaoOp } from "@/lib/inventory/consumoGesture";

const toIsoDate = (value: string): string => {
  return value.split("T")[0];
};

const addDaysToDate = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
};

const buildWithdrawalEndDate = (
  occurredAt: string,
  days: number | null | undefined,
): string | null => {
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    return null;
  }

  return addDaysToDate(toIsoDate(occurredAt), days);
};

const buildBaseEventOp = (
  input: EventInput,
  eventId: string,
  occurredAt: string,
  sanitarioCasoId?: string | null,
): OperationInput => {
  return {
    table: "eventos",
    action: "INSERT",
    record: {
      id: eventId,
      dominio: input.dominio,
      occurred_at: occurredAt,
      animal_id: input.animalId ?? null,
      lote_id: input.loteId ?? null,
      source_task_id: input.sourceTaskId ?? null,
      corrige_evento_id: input.corrigeEventoId ?? null,
      sanitario_caso_id: sanitarioCasoId ?? null,
      observacoes: input.observacoes ?? null,
      payload: input.payload ?? {},
    },
  };
};

const resolveSanitarioCasoId = (input: EventInput): string | null => {
  if (
    (input.dominio !== "sanitario" && input.dominio !== "alerta_sanitario") ||
    !input.sanitarioCaso
  ) {
    return null;
  }

  return input.sanitarioCaso.action === "open"
    ? crypto.randomUUID()
    : input.sanitarioCaso.id;
};

export const buildEventGesture = (input: EventInput): EventGestureBuildResult => {
  assertValidEventInput(input);

  const eventId = crypto.randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const sanitarioCasoId = resolveSanitarioCasoId(input);
  const ops: OperationInput[] = [];

  if (
    (input.dominio === "sanitario" || input.dominio === "alerta_sanitario") &&
    input.sanitarioCaso?.action === "open"
  ) {
    ops.push({
      table: "sanitario_casos",
      action: "INSERT",
      record: {
        id: sanitarioCasoId,
        animal_id: input.animalId,
        tipo: input.sanitarioCaso.tipo,
        status: input.sanitarioCaso.status ?? "aberto",
        opened_at: occurredAt,
        closed_at: null,
        disease_code: input.sanitarioCaso.diseaseCode ?? null,
        disease_name: input.sanitarioCaso.diseaseName ?? null,
        notification_type: input.sanitarioCaso.notificationType ?? null,
        requires_immediate_notification:
          input.sanitarioCaso.requiresImmediateNotification ?? false,
        movement_blocked: input.sanitarioCaso.movementBlocked ?? false,
        source_alert_evento_id: null,
        closure_reason: null,
        observacoes: input.sanitarioCaso.observacoes ?? null,
        payload: input.sanitarioCaso.payload ?? {},
      },
    });
  }

  // F9: When correcting an event, mark original with superseded_by metadata
  if (input.corrigeEventoId) {
    ops.push({
      table: "eventos",
      action: "UPDATE",
      record: {
        id: input.corrigeEventoId,
        payload: {
          superseded_by: eventId,
          superseded_at: occurredAt,
        },
      },
    });
  }

  ops.push(buildBaseEventOp(input, eventId, occurredAt, sanitarioCasoId));

  if (input.dominio === "sanitario") {
    const insumoSnapshot = buildProdutoInsumoSnapshot({
      produtoNome: input.produto,
      insumo: input.insumoRef,
      lote: input.loteRef,
      dose: input.dose,
      doseUnidade: input.doseUnidade,
      quantidadeConsumida: input.quantidadeConsumida,
      quantidadeUnidade: input.quantidadeUnidade,
      viaAplicacao: input.viaAplicacao,
    });
    const carenciaCarneDias = input.insumoRef?.carencia_carne_dias ?? null;
    const carenciaLeiteDias = input.insumoRef?.carencia_leite_dias ?? null;
    const custoUnitarioSnapshot =
      input.custoUnitarioSnapshot ?? insumoSnapshot.custo_unitario_snapshot ?? null;
    const custoTotalSnapshot =
      insumoSnapshot.custo_total_snapshot ??
      (typeof custoUnitarioSnapshot === "number" &&
      typeof input.quantidadeConsumida === "number"
        ? Number((custoUnitarioSnapshot * input.quantidadeConsumida).toFixed(2))
        : null);

    ops.push({
      table: "eventos_sanitario",
      action: "INSERT",
      record: {
        evento_id: eventId,
        tipo: input.tipo,
        produto: input.produto.trim(),
        produto_veterinario_id:
          input.produtoRef?.id ?? input.insumoRef?.produto_veterinario_id ?? null,
        produto_nome_snapshot: insumoSnapshot.produto_nome_snapshot,
        estoque_lote_id: input.insumoLoteId ?? insumoSnapshot.insumo_lote_id ?? null,
        estoque_lote_codigo_snapshot:
          insumoSnapshot.estoque_lote_codigo_snapshot ?? null,
        lote_fabricante: insumoSnapshot.lote_fabricante ?? null,
        validade_produto: insumoSnapshot.validade_produto ?? null,
        dose_quantidade: input.dose ?? null,
        dose_unidade: input.doseUnidade ?? null,
        via_aplicacao: input.viaAplicacao ?? null,
        responsavel_nome: input.responsavelNome ?? null,
        responsavel_tipo: input.responsavelTipo ?? null,
        carencia_carne_dias: carenciaCarneDias,
        carencia_leite_dias: carenciaLeiteDias,
        carencia_carne_ate: buildWithdrawalEndDate(occurredAt, carenciaCarneDias),
        carencia_leite_ate: buildWithdrawalEndDate(occurredAt, carenciaLeiteDias),
        custo_unitario_snapshot: custoUnitarioSnapshot,
        custo_total_snapshot: custoTotalSnapshot,
        protocol_item_version_id: input.protocoloItem?.id ?? null,
        protocol_item_logical_key: input.protocoloItem?.logicalItemKey ?? null,
        protocol_item_version: input.protocoloItem?.version ?? null,
        protocol_item_snapshot: input.protocoloItem?.snapshot ?? null,
        payload: {
          ...buildVeterinaryProductMetadata({
            selectedProduct: input.produtoRef,
            typedName: input.produto,
          }),
          insumo_snapshot: insumoSnapshot,
          protocol_item_version_id: input.protocoloItem?.id ?? null,
          protocol_item_logical_key: input.protocoloItem?.logicalItemKey ?? null,
          protocol_item_version: input.protocoloItem?.version ?? null,
          protocol_item_code: input.protocoloItem?.itemCode ?? null,
          protocol_item_snapshot: input.protocoloItem?.snapshot ?? null,
        },
      },
    });

    if (
      input.gerarBaixaEstoque &&
      input.insumoId &&
      input.insumoLoteId &&
      input.quantidadeConsumida
    ) {
      ops.push(
        buildConsumoMovimentacaoOp({
          eventId,
          dominio: "sanitario",
          insumoId: input.insumoId,
          insumoLoteId: input.insumoLoteId,
          quantidadeBase: input.quantidadeConsumida,
          unidadeBase: (input.loteRef?.unidade_base || "ml") as InsumoUnidadeBaseEnum,
          occurredAt,
          lotRef: input.loteRef,
          animalId: input.animalId,
          loteId: input.loteId,
          observacoes: input.observacoes,
        })
      );
    }
  } else if (input.dominio === "alerta_sanitario") {
    if (input.sanitarioCaso?.action === "close") {
      const caseClosed =
        input.sanitarioCaso.status === "encerrado" ||
        input.sanitarioCaso.status === "cancelado";

      ops.push({
        table: "sanitario_casos",
        action: "UPDATE",
        record: {
          id: input.sanitarioCaso.id,
          status: input.sanitarioCaso.status,
          closed_at: caseClosed ? occurredAt : null,
          closure_reason: input.sanitarioCaso.closureReason ?? null,
          observacoes: input.sanitarioCaso.observacoes ?? null,
          movement_blocked: input.sanitarioCaso.movementBlocked ?? false,
        },
      });
    }

    if (input.animalId) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          payload: input.animalPayload,
        },
      });
    }
  } else if (input.dominio === "conformidade") {
    // Compliance overlays live entirely in the base event payload for now.
  } else if (input.dominio === "comercial") {
    const titularidadeSnapshot = {
      animal_status: input.animalStatusSnapshot ?? null,
      sociedade_ativa:
        input.sociedadeSnapshot && input.sociedadeSnapshot.length > 0
          ? input.sociedadeSnapshot
          : null,
      signals: input.commercialSignals ?? [],
    };

    ops.push({
      table: "eventos_comercial",
      action: "INSERT",
      record: {
        evento_id: eventId,
        operation_type: input.operationType,
        scope: input.scope,
        occurred_at: occurredAt,
        quantidade_animais: input.quantidadeAnimais,
        peso_vivo_total: input.pesoVivoTotal ?? null,
        peso_medio_derivado: input.pesoMedioDerivado ?? null,
        valor_bruto: input.valorBruto ?? null,
        frete: input.frete ?? null,
        comissao: input.comissao ?? null,
        descontos: input.descontos ?? null,
        taxas_impostos: input.taxasImpostos ?? null,
        valor_liquido_derivado: input.valorLiquidoDerivado ?? null,
        contraparte_id: input.contraparteId ?? null,
        contraparte_nome: input.contraparteNome ?? null,
        animal_ids: input.animalIds ?? null,
        lote_id: input.loteId ?? null,
        finance_transaction_id: input.financeTransactionId ?? null,
        titularidade_snapshot: titularidadeSnapshot,
        sociedade_snapshot: input.sociedadeSnapshot ?? null,
        commercial_signals: input.commercialSignals ?? [],
        snapshot: {
          ...(input.snapshot ?? {}),
          titularidade: titularidadeSnapshot,
        },
        calculation_status: input.calculationStatus ?? "partial",
        issues: input.issues ?? [],
        limitations: input.limitations ?? [],
        observacoes: input.observacoes ?? null,
      },
    });

    if (
      input.operationType === "venda" &&
      input.scope === "animal" &&
      input.animalId
    ) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          status: "vendido",
          data_saida: toIsoDate(occurredAt),
          lote_id: null,
        },
      });
    }
  } else if (input.dominio === "pesagem") {
    ops.push({
      table: "eventos_pesagem",
      action: "INSERT",
      record: {
        evento_id: eventId,
        peso_kg: input.pesoKg,
        payload: {},
      },
    });
  } else if (input.dominio === "movimentacao") {
    ops.push({
      table: "eventos_movimentacao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        from_lote_id: input.fromLoteId ?? null,
        to_lote_id: input.toLoteId ?? null,
        from_pasto_id: input.fromPastoId ?? null,
        to_pasto_id: input.toPastoId ?? null,
        payload: input.payload ?? {},
      },
    });

    // Animal lote update (movimentação de animal entre lotes)
    if (
      input.applyAnimalStateUpdate !== false &&
      input.animalId &&
      input.toLoteId !== undefined
    ) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          lote_id: input.toLoteId,
        },
      });
    }

    // Lote pasto update (movimentação de lote entre pastos).
    // Requer opt-in explícito: applyLoteStateUpdate === true && movementKind === "lote_pasto".
    if (
      input.applyLoteStateUpdate === true &&
      input.movementKind === "lote_pasto" &&
      input.loteId
    ) {
      ops.push({
        table: "lotes",
        action: "UPDATE",
        record: {
          id: input.loteId,
          pasto_id: input.toPastoId ?? null,
        },
      });
    }
  } else if (input.dominio === "nutricao") {
    const insumoSnapshot = buildProdutoInsumoSnapshot({
      produtoNome: input.alimentoNome,
      insumo: input.insumoRef,
      lote: input.loteRef,
      quantidadeConsumida: input.quantidadeConsumida || input.quantidadeKg,
      quantidadeUnidade: input.quantidadeUnidade || "kg",
    });

    ops.push({
      table: "eventos_nutricao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        alimento_nome: input.alimentoNome.trim(),
        quantidade_kg: input.quantidadeKg,
        payload: {
          insumo_snapshot: insumoSnapshot,
        },
      },
    });

    if (
      input.gerarBaixaEstoque &&
      input.insumoId &&
      input.insumoLoteId &&
      (input.quantidadeConsumida || input.quantidadeKg)
    ) {
      ops.push(
        buildConsumoMovimentacaoOp({
          eventId,
          dominio: "nutricao",
          insumoId: input.insumoId,
          insumoLoteId: input.insumoLoteId,
          quantidadeBase: input.quantidadeConsumida || input.quantidadeKg,
          unidadeBase: (input.loteRef?.unidade_base || "kg") as InsumoUnidadeBaseEnum,
          occurredAt,
          lotRef: input.loteRef,
          loteId: input.loteId,
          observacoes: input.observacoes,
        })
      );
    }
  } else if (input.dominio === "pastagem") {
    ops.push({
      table: "eventos_pasto_avaliacao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        fazenda_id: input.fazendaId,
        pasto_id: input.pastoId,
        lote_id: input.loteId ?? null,
        ocupacao_id: input.ocupacaoId ?? null,
        momento: input.momento,
        altura_cm: input.alturaCm ?? null,
        cobertura_solo: input.coberturaSolo ?? null,
        invasoras_nivel: input.invasorasNivel ?? null,
        ecc_lote_medio: input.eccLoteMedio ?? null,
        ecc_escala: input.eccEscala ?? "1_5",
        fezes_score: input.fezesScore ?? null,
        agua_status: input.aguaStatus ?? null,
        suplemento_tipo: input.suplementoTipo?.trim() || null,
        suplemento_quantidade: input.suplementoQuantidade ?? null,
        suplemento_unidade: input.suplementoUnidade ?? null,
        observacoes: input.observacoes ?? null,
        payload: input.payload ?? {},
      },
    });
  } else if (input.dominio === "financeiro") {
    ops.push({
      table: "eventos_financeiro",
      action: "INSERT",
      record: {
        evento_id: eventId,
        tipo: input.tipo,
        valor_total: input.valorTotal,
        contraparte_id: input.contraparteId ?? null,
        payload: {},
      },
    });

    if (
      input.tipo === "venda" &&
      input.animalId &&
      input.applyAnimalStateUpdate !== false
    ) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          status: input.animalSaleStatus ?? "vendido",
          data_saida: toIsoDate(occurredAt),
          ...(input.clearAnimalLoteOnSale !== false ? { lote_id: null } : {}),
        },
      });
    }
  } else if (input.dominio === "reproducao") {
    ops.push({
      table: "eventos_reproducao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        fazenda_id: input.fazendaId,
        tipo: input.tipo,
        macho_id: input.machoId ?? null,
        payload: input.payloadData ?? {},
      },
    });
  } else if (input.dominio === "ecc") {
    ops.push({
      table: "eventos_ecc",
      action: "INSERT",
      record: {
        event_id: eventId,
        fazenda_id: input.fazendaId,
        animal_id: input.animalId,
        ecc: input.ecc,
        escala_min: input.escalaMin ?? 1.00,
        escala_max: input.escalaMax ?? 5.00,
        escala_passo: input.escalaPasso ?? 0.25,
        observacoes: input.observacoes ?? null,
        payload: input.payload ?? {},
      },
    });
  } else if (input.dominio === "obito") {
    // Note: óbito is stored in the base 'eventos' table with payload including causa.
    // We add an UPDATE to the animal record to mark it as dead.
    if (input.animalId) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          status: "morto",
          data_saida: toIsoDate(input.dataObito ?? occurredAt),
          lote_id: null, // Clear lote on death
        },
      });

      // Automatic agenda cancellation
      if (input.cancelAgendaIds && input.cancelAgendaIds.length > 0) {
        input.cancelAgendaIds.forEach((taskId) => {
          ops.push({
            table: "state_agenda_itens",
            action: "UPDATE",
            record: {
              id: taskId,
              status: "cancelado",
            },
          });
        });
      }
    }
  }

  return { eventId, ops };
};
