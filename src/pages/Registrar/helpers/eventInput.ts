import type {
  FinanceiroTipoEnum,
  ProtocoloSanitarioItem,
  ReproTipoEnum,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import type { EventInput } from "@/lib/events/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/products";
import { buildRegistrarFinanceiroPayloadBase } from "@/pages/Registrar/helpers/payload";

type RegistrarEventDomain =
  | "sanitario"
  | "pesagem"
  | "movimentacao"
  | "nutricao"
  | "financeiro";

type ReproducaoFallbackData = {
  tipo: ReproTipoEnum;
  machoId?: string | null;
  observacoes?: string;
  resultadoDiagnostico?: string;
  dataPrevistaParto?: string;
  dataParto?: string;
  numeroCrias?: number;
  tecnicaLivre?: string;
  reprodutorTag?: string;
  loteSemen?: string;
  doseSemenRef?: string;
  episodeEventoId?: string | null;
  episodeLinkMethod?: "manual" | "auto_last_open_service" | "unlinked";
};

type BuildRegistrarEventInputParams = {
  tipoManejo: RegistrarEventDomain;
  fazendaId: string;
  occurredAt: string;
  sourceTaskId: string | null;
  animalId: string | null;
  targetLoteId: string | null;
  selectedLoteIsSemLote?: boolean;
  createdAnimalIds?: string[];
  transitChecklistPayload?: Record<string, unknown>;
  sanitario?: {
    tipo: SanitarioTipoEnum;
    produto: string;
    protocoloItem: ProtocoloSanitarioItem | null;
    produtoRef: VeterinaryProductSelection | null;
    payload: Record<string, unknown>;
  };
  pesagem?: {
    pesoKg: number | null;
  };
  movimentacao?: {
    toLoteId: string | null;
  };
  nutricao?: {
    alimentoNome: string;
    quantidadeKg: number;
  };
  financeiro?: {
    natureza: "compra" | "venda" | "sociedade_entrada" | "sociedade_saida";
    tipo: FinanceiroTipoEnum;
    valorTotal: number;
    contraparteId: string | null;
  };
};

export function buildRegistrarEventInput(
  params: BuildRegistrarEventInputParams,
): EventInput {
  const base = {
    fazendaId: params.fazendaId,
    occurredAt: params.occurredAt,
    sourceTaskId: params.sourceTaskId,
    animalId: params.animalId,
    loteId: params.targetLoteId,
  };

  if (params.tipoManejo === "sanitario") {
    return {
      dominio: "sanitario",
      ...base,
      tipo: params.sanitario?.tipo ?? "vacinacao",
      produto: params.sanitario?.produto ?? "",
      protocoloItem: params.sanitario?.protocoloItem
        ? {
            id: params.sanitario.protocoloItem.id,
            intervalDays: params.sanitario.protocoloItem.intervalo_dias,
            doseNum: params.sanitario.protocoloItem.dose_num,
            geraAgenda: params.sanitario.protocoloItem.gera_agenda,
          }
        : undefined,
      produtoRef: params.sanitario?.produtoRef ?? undefined,
      payload: params.sanitario?.payload ?? {},
    };
  }

  if (params.tipoManejo === "pesagem") {
    return {
      dominio: "pesagem",
      ...base,
      pesoKg: params.pesagem?.pesoKg ?? 0,
    };
  }

  if (params.tipoManejo === "movimentacao") {
    return {
      dominio: "movimentacao",
      ...base,
      fromLoteId: params.targetLoteId,
      toLoteId: params.movimentacao?.toLoteId ?? null,
      payload: params.transitChecklistPayload ?? {},
    };
  }

  if (params.tipoManejo === "nutricao") {
    return {
      dominio: "nutricao",
      ...base,
      alimentoNome: params.nutricao?.alimentoNome ?? "",
      quantidadeKg: params.nutricao?.quantidadeKg ?? 0,
    };
  }

  const natureza = params.financeiro?.natureza ?? "compra";
  const selectedLoteIsSemLote = params.selectedLoteIsSemLote === true;
  const createdAnimalIds = params.createdAnimalIds ?? [];
  const financialAnimalId =
    params.animalId ??
    (natureza === "compra" && selectedLoteIsSemLote
      ? createdAnimalIds[0] ?? null
      : null);

  return {
    dominio: "financeiro",
    ...base,
    animalId: financialAnimalId,
    tipo: params.financeiro?.tipo ?? "compra",
    valorTotal: params.financeiro?.valorTotal ?? 0,
    contraparteId: params.financeiro?.contraparteId ?? null,
    applyAnimalStateUpdate: natureza === "venda" && Boolean(params.animalId),
    clearAnimalLoteOnSale: natureza === "venda" && Boolean(params.animalId),
    payload: {
      ...buildRegistrarFinanceiroPayloadBase({
        natureza,
        hasAnimalId: Boolean(params.animalId),
        createdAnimalIds,
      }),
      ...(params.transitChecklistPayload ?? {}),
    },
  };
}

type BuildRegistrarFallbackReproductionEventInputParams = {
  fazendaId: string;
  occurredAt: string;
  sourceTaskId: string | null;
  animalId: string | null;
  reproducaoData: ReproducaoFallbackData;
};

export function buildRegistrarFallbackReproductionEventInput(
  params: BuildRegistrarFallbackReproductionEventInputParams,
): EventInput {
  return {
    dominio: "reproducao",
    fazendaId: params.fazendaId,
    occurredAt: params.occurredAt,
    sourceTaskId: params.sourceTaskId,
    animalId: params.animalId,
    tipo: params.reproducaoData.tipo,
    machoId: params.reproducaoData.machoId,
    observacoes: params.reproducaoData.observacoes,
    payloadData: {
      schema_version: 1,
      episode_evento_id: params.reproducaoData.episodeEventoId || undefined,
      episode_link_method: params.reproducaoData.episodeLinkMethod || undefined,
      tecnica_livre: params.reproducaoData.tecnicaLivre,
      reprodutor_tag: params.reproducaoData.reprodutorTag,
      resultado: params.reproducaoData.resultadoDiagnostico,
      data_prevista_parto: params.reproducaoData.dataPrevistaParto,
      data_parto_real: params.reproducaoData.dataParto,
      numero_crias: params.reproducaoData.numeroCrias,
      lote_semen: params.reproducaoData.loteSemen,
      dose_semen_ref: params.reproducaoData.doseSemenRef,
    },
  };
}
