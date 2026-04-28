import type { ReproductionEventData } from "@/components/events/ReproductionForm";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { EventDomain, EventInput } from "@/lib/events/types";
import type {
  Animal,
  FinanceiroTipoEnum,
  OperationInput,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
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

type RegistrarNonFinancialDomain =
  | "sanitario"
  | "pesagem"
  | "movimentacao"
  | "nutricao"
  | "financeiro"
  | "reproducao";

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
  pesagemData: Record<string, string>;
  movimentacaoData: NonFinancialMovimentacaoData;
  nutricaoData: NonFinancialNutricaoData;
  financeiroData: NonFinancialFinanceiroData;
  financeiroTipo: FinanceiroTipoEnum;
  reproducaoData: ReproductionEventData;
  farmLifecycleConfig: FarmLifecycleConfig;
  parseUserWeight: (value: string) => number | null;
  buildGesture?: (input: EventInput) => { eventId: string; ops: OperationInput[] };
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
  const ops: OperationInput[] = [];
  let linkedEventId: string | null = null;
  let postPartoRedirect: RegistrarPostPartoRedirect | null = null;

  for (const animalId of input.targetAnimalIds) {
    const animal = animalId ? input.animalsMap.get(animalId) : null;
    if (animalId && !animal) continue;
    const targetLoteId = animal?.lote_id ?? input.selectedLoteIdNormalized;

    let eventInput: EventInput;

    if (
      input.tipoManejo === "sanitario" ||
      input.tipoManejo === "pesagem" ||
      input.tipoManejo === "movimentacao" ||
      input.tipoManejo === "nutricao" ||
      input.tipoManejo === "financeiro"
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
        sanitario:
          input.tipoManejo === "sanitario"
            ? {
                tipo: input.sanitarioData.tipo,
                produto: input.sanitaryProductName,
                protocoloItem: input.protocoloItem,
                produtoRef: input.sanitaryProductSelection,
                payload: input.sanitaryProductMetadata,
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
