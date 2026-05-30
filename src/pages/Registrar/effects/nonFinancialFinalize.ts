import type { ReproductionEventData } from "@/components/events/ReproductionForm";
import { db } from "@/lib/offline/db";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { EventDomain, EventInput } from "@/lib/events/types";
import type {
  Animal,
  FinanceiroTipoEnum,
  OperationInput,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
  Insumo,
  InsumoLote,
} from "@/lib/offline/types";
import {
  buildClinicalProtocolEventPayload,
  type ClinicalProtocolRef,
} from "@/lib/sanitario/compliance/clinicalProtocols";
import {
  buildDryCowTherapyAnimalPayload,
  buildDryCowTherapyEventPayload,
  evaluateDryCowTherapyReadiness,
  isDryCowTherapyClinicalRef,
} from "@/lib/sanitario/compliance/dryCowTherapy";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import {
  buildRegistrarFallbackReproductionEventInput,
  buildRegistrarEventInput,
} from "@/pages/Registrar/helpers/eventInput";
import { parseRegistrarNumeric } from "@/pages/Registrar/helpers/financialContext";
import { resolveRegistrarReproducaoValidationIssue } from "@/pages/Registrar/helpers/reproducaoValidation";
import {
  runRegistrarReproductionFinalizeEffect,
  type RegistrarPostPartoRedirect,
} from "@/pages/Registrar/effects/reproductionFinalize";
import { resolveManualSanitaryAgendaCompletionOpsEffect } from "@/pages/Registrar/effects/sanitaryAgendaReconciliation";

type RegistrarNonFinancialDomain =
  | "sanitario"
  | "pesagem"
  | "movimentacao"
  | "nutricao"
  | "comercial"
  | "reproducao"
  | "ecc";

type NonFinancialSanitarioData = {
  tipo: SanitarioTipoEnum;
};

type NonFinancialMovimentacaoData = {
  toLoteId: string;
};

type NonFinancialNutricaoData = {
  alimentoNome: string;
  quantidadeKg: string;
};

type NonFinancialFinanceiroData = {
  natureza:
    | "compra"
    | "venda"
    | "sociedade_entrada"
    | "sociedade_saida"
    | "doacao_entrada"
    | "doacao_saida"
    | "arrendamento";
  valorTotal: string;
  contraparteId: string;
};

type NonFinancialComercialData = {
  operationType: "compra" | "venda" | "sociedade_entrada" | "sociedade_saida" | "doacao_entrada" | "doacao_saida" | "arrendamento";
  scope: "animal" | "lote" | "rebanho";
  quantidadeAnimais: number;
  pesoVivoTotal: number | null;
  pesoMedioDerivado: number | null;
  valorBruto: number | null;
  frete: number | null;
  comissao: number | null;
  descontos: number | null;
  taxasImpostos: number | null;
  valorLiquidoDerivado: number | null;
  contraparteId: string | null;
  contraparteNome: string | null;
  animalIds: string[] | null;
  loteId: string | null;
  financeTransactionId: string | null;
  snapshot: unknown | null;
  calculationStatus: "draft" | "calculated" | "user_override";
};

export async function resolveRegistrarNonFinancialFinalizePlan(input: {
  tipoManejo: RegistrarNonFinancialDomain;
  fazendaId: string;
  occurredAt: string;
  sourceTaskId: string | null;
  targetAnimalIds: Array<string | null>;
  animalsMap: Map<string, Animal>;
  selectedLoteIsSemLote: boolean;
  selectedLoteIdNormalized: string | null;
  createdAnimalIds: string[];
  transitChecklistPayload: Record<string, unknown>;
  sanitaryProductName: string;
  sanitaryProductSelection: VeterinaryProductSelection | null;
  sanitaryProductMetadata: Record<string, unknown>;
  protocoloItem: ProtocoloSanitarioItem | null;
  sanitarioData: NonFinancialSanitarioData;
  sanitarioCasoId?: string | null;
  abrirCasoClinico?: boolean;
  clinicalProtocolRef?: ClinicalProtocolRef | null;
  pesagemData: Record<string, string>;
  eccData: Record<string, string>;
  eccObservacoes: Record<string, string>;
  movimentacaoData: NonFinancialMovimentacaoData;
  nutricaoData: NonFinancialNutricaoData;
  financeiroData: NonFinancialFinanceiroData;
  comercialData?: NonFinancialComercialData;
  sanitaryInventory?: {
    insumoId?: string | null;
    insumoLoteId?: string | null;
    insumoRef?: Insumo | null;
    loteRef?: InsumoLote | null;
    dose?: number | null;
    doseUnidade?: string | null;
    quantidadeConsumida?: number | null;
    quantidadeUnidade?: string | null;
    viaAplicacao?: string | null;
    custoUnitarioSnapshot?: number | null;
    gerarBaixaEstoque?: boolean;
  } | null;
  nutricaoInventory?: {
    insumoId?: string | null;
    insumoLoteId?: string | null;
    insumoRef?: Insumo | null;
    loteRef?: InsumoLote | null;
    quantidadeConsumida?: number | null;
    quantidadeUnidade?: string | null;
    custoUnitarioSnapshot?: number | null;
    gerarBaixaEstoque?: boolean;
  } | null;
  financeiroTipo: FinanceiroTipoEnum;
  reproducaoData: ReproductionEventData;
  farmLifecycleConfig: FarmLifecycleConfig;
  parseUserWeight: (value: string) => number | null;
  buildGesture?: (input: EventInput) => { eventId: string; ops: OperationInput[] };
  resolveManualSanitaryAgendaCompletionOps?: (input: {
    fazendaId: string;
    linkedEventId: string;
    animalId: string | null;
    sanitarioTipo: SanitarioTipoEnum;
    sanitaryProductName: string;
    protocoloItem: ProtocoloSanitarioItem | null;
  }) => Promise<OperationInput[]>;
}): Promise<
  | { issue: string; linkedEventId: null; postPartoRedirect: null; ops: [] }
  | {
      issue: null;
      linkedEventId: string | null;
      postPartoRedirect: RegistrarPostPartoRedirect | null;
      ops: OperationInput[];
    }
> {
  const buildGesture = input.buildGesture ?? buildEventGesture;
  const resolveManualSanitaryAgendaCompletionOps =
    input.resolveManualSanitaryAgendaCompletionOps ??
    resolveManualSanitaryAgendaCompletionOpsEffect;
  const ops: OperationInput[] = [];
  let linkedEventId: string | null = null;
  let postPartoRedirect: RegistrarPostPartoRedirect | null = null;
  const clinicalProtocolPayload = buildClinicalProtocolEventPayload(
    input.clinicalProtocolRef,
  );
  const isDryCowTherapy = isDryCowTherapyClinicalRef(input.clinicalProtocolRef);

  if (
    input.tipoManejo === "sanitario" &&
    input.sanitarioCasoId &&
    input.targetAnimalIds.filter(Boolean).length !== 1
  ) {
    return {
      issue: "Selecione apenas um animal para vincular um caso clinico existente.",
      linkedEventId: null,
      postPartoRedirect: null,
      ops: [],
    };
  }

  for (const animalId of input.targetAnimalIds) {
    if (input.tipoManejo === "ecc" && animalId) {
      const eccVal = input.eccData[animalId];
      if (!eccVal || eccVal.trim() === "") {
        // Skip this animal as it wasn't evaluated
        continue;
      }
    }

    const animal = animalId ? input.animalsMap.get(animalId) : null;
    if (animalId && !animal) continue;
    const targetLoteId = animal?.lote_id ?? input.selectedLoteIdNormalized;

    let eventInput: EventInput;

    if (
      input.tipoManejo === "sanitario" ||
      input.tipoManejo === "pesagem" ||
      input.tipoManejo === "movimentacao" ||
      input.tipoManejo === "nutricao" ||
      input.tipoManejo === "financeiro" ||
      input.tipoManejo === "comercial" ||
      input.tipoManejo === "ecc"
    ) {
      eventInput = buildRegistrarEventInput({
        tipoManejo: input.tipoManejo,
        fazendaId: input.fazendaId,
        occurredAt: input.occurredAt,
        sourceTaskId: input.sourceTaskId,
        animalId: animalId ?? null,
        targetLoteId,
        selectedLoteIsSemLote: input.selectedLoteIsSemLote,
        createdAnimalIds: input.createdAnimalIds,
        transitChecklistPayload: input.transitChecklistPayload,
        comercial: input.comercialData,
        sanitario:
          input.tipoManejo === "sanitario"
            ? {
                tipo: input.sanitarioData.tipo,
                produto: input.sanitaryProductName,
                protocoloItem: input.protocoloItem,
                produtoRef: input.sanitaryProductSelection,
                sanitarioCaso: input.abrirCasoClinico
                  ? {
                      action: "open",
                      tipo: "clinico",
                      status: "em_acompanhamento",
                      observacoes: null,
                      payload: {
                        source: "registrar",
                        sanitario_tipo: input.sanitarioData.tipo,
                        produto: input.sanitaryProductName,
                        protocolo_item_id: input.protocoloItem?.id ?? null,
                        ...clinicalProtocolPayload,
                      },
                    }
                  : input.sanitarioCasoId
                    ? { action: "link", id: input.sanitarioCasoId }
                    : undefined,
                insumoId: input.sanitaryInventory?.insumoId,
                insumoLoteId: input.sanitaryInventory?.insumoLoteId,
                insumoRef: input.sanitaryInventory?.insumoRef,
                loteRef: input.sanitaryInventory?.loteRef,
                dose: input.sanitaryInventory?.dose,
                doseUnidade: input.sanitaryInventory?.doseUnidade,
                quantidadeConsumida: input.sanitaryInventory?.quantidadeConsumida,
                quantidadeUnidade: input.sanitaryInventory?.quantidadeUnidade,
                viaAplicacao: input.sanitaryInventory?.viaAplicacao,
                custoUnitarioSnapshot: input.sanitaryInventory?.custoUnitarioSnapshot,
                gerarBaixaEstoque: input.sanitaryInventory?.gerarBaixaEstoque,
                payload: {
                  ...input.sanitaryProductMetadata,
                  ...clinicalProtocolPayload,
                  ...(isDryCowTherapy && animalId && animal
                    ? buildDryCowTherapyEventPayload({
                        animalId,
                        performedAt: input.occurredAt,
                        readiness: evaluateDryCowTherapyReadiness({
                          animal,
                          referenceDate: input.occurredAt.slice(0, 10),
                        }),
                      })
                    : {}),
                },
              }
            : undefined,
        pesagem:
          input.tipoManejo === "pesagem"
            ? {
                pesoKg: input.parseUserWeight(
                  animalId ? input.pesagemData[animalId] || "" : "",
                ),
              }
            : undefined,
        ecc:
          input.tipoManejo === "ecc" && animalId
            ? {
                ecc: Number(input.eccData[animalId]),
                escalaMin: 1.00,
                escalaMax: 5.00,
                escalaPasso: 0.25,
                observacoes: input.eccObservacoes[animalId] || null,
              }
            : undefined,
        movimentacao:
          input.tipoManejo === "movimentacao"
            ? {
                toLoteId: input.movimentacaoData.toLoteId || null,
              }
            : undefined,
        nutricao:
          input.tipoManejo === "nutricao"
            ? {
                alimentoNome: input.nutricaoData.alimentoNome,
                quantidadeKg: parseRegistrarNumeric(input.nutricaoData.quantidadeKg),
                insumoId: input.nutricaoInventory?.insumoId,
                insumoLoteId: input.nutricaoInventory?.insumoLoteId,
                insumoRef: input.nutricaoInventory?.insumoRef,
                loteRef: input.nutricaoInventory?.loteRef,
                quantidadeConsumida: input.nutricaoInventory?.quantidadeConsumida,
                quantidadeUnidade: input.nutricaoInventory?.quantidadeUnidade,
                custoUnitarioSnapshot: input.nutricaoInventory?.custoUnitarioSnapshot,
                gerarBaixaEstoque: input.nutricaoInventory?.gerarBaixaEstoque,
              }
            : undefined,
        financeiro:
          input.tipoManejo === "financeiro"
            ? {
                natureza: input.financeiroData.natureza,
                tipo: input.financeiroTipo,
                valorTotal: parseRegistrarNumeric(input.financeiroData.valorTotal),
                contraparteId:
                  input.financeiroData.contraparteId !== "none"
                    ? input.financeiroData.contraparteId
                    : null,
              }
            : undefined,
      });
    } else if (input.tipoManejo === "reproducao" && animalId && animal) {
      const reproPlan = await runRegistrarReproductionFinalizeEffect({
        fazendaId: input.fazendaId,
        animalId,
        animal,
        occurredAt: input.occurredAt,
        sourceTaskId: input.sourceTaskId,
        targetLoteId,
        reproducaoData: input.reproducaoData,
        farmLifecycleConfig: input.farmLifecycleConfig,
      });

      if (reproPlan.issue) {
        return {
          issue: reproPlan.issue,
          linkedEventId: null,
          postPartoRedirect: null,
          ops: [],
        };
      }

      if (!linkedEventId) {
        linkedEventId = reproPlan.eventId;
      }
      if (reproPlan.postPartoRedirect) {
        postPartoRedirect = reproPlan.postPartoRedirect;
      }
      ops.push(...reproPlan.ops);
      continue;
    } else if (input.tipoManejo === "reproducao") {
      const reproducaoIssue = resolveRegistrarReproducaoValidationIssue(
        input.reproducaoData,
      );
      if (reproducaoIssue) {
        return {
          issue: reproducaoIssue,
          linkedEventId: null,
          postPartoRedirect: null,
          ops: [],
        };
      }

      eventInput = buildRegistrarFallbackReproductionEventInput({
        fazendaId: input.fazendaId,
        occurredAt: input.occurredAt,
        sourceTaskId: input.sourceTaskId,
        animalId: animalId ?? null,
        reproducaoData: input.reproducaoData,
      });
    } else {
      continue;
    }

    const built = buildGesture(eventInput);
    if (!linkedEventId) {
      linkedEventId = built.eventId;
    }
    ops.push(...built.ops);

    if (input.tipoManejo === "sanitario" && isDryCowTherapy && animalId && animal) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          payload: buildDryCowTherapyAnimalPayload({
            animal,
            performedAt: input.occurredAt,
          }),
        },
      });
    }

    if (input.tipoManejo === "sanitario" && !input.sourceTaskId) {
      ops.push(
        ...(await resolveManualSanitaryAgendaCompletionOps({
          fazendaId: input.fazendaId,
          linkedEventId: built.eventId,
          animalId: animalId ?? null,
          sanitarioTipo: input.sanitarioData.tipo,
          sanitaryProductName: input.sanitaryProductName,
          protocoloItem: input.protocoloItem,
        })),
      );
    }
    
    if (input.tipoManejo === "comercial" && input.comercialData?.operationType === "venda" && animalId) {
      const activeLinks = await db.state_sociedade_animais
        .where("animal_id")
        .equals(animalId)
        .toArray();
      const link = activeLinks.find(l => l.status === "ativo");
      if (link) {
        ops.push({
          table: "sociedade_animais",
          action: "UPDATE",
          record: {
            id: link.id,
            status: "encerrado",
            motivo_saida: "venda",
            payload: {
              ...(link.payload || {}),
              encerradoPor: "venda_comercial",
              eventoComercialId: built.eventId,
              clientOpId: input.sourceTaskId
            }
          }
        });
      }
    }
  }

  return {
    issue: null,
    linkedEventId,
    postPartoRedirect,
    ops,
  };
}

export function isRegistrarFinancialFlow(input: {
  tipoManejo: EventDomain;
  isFinanceiroSociedade: boolean;
}) {
  return input.tipoManejo === "financeiro" && !input.isFinanceiroSociedade;
}
