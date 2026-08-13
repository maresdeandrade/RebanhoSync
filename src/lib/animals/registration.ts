import type { AnimalBreedEnum } from "@/lib/animals/catalogs";
import type { AnimalSpeciesEnum } from "@/lib/animals/species";
import {
  buildAnimalClassificationPayload,
  getLegacyMaleFields,
} from "@/lib/animals/maleProfile";
import {
  buildAnimalLifecyclePayload,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";

export interface AnimalRegistrationDraft {
  id?: string;
  identificacao: string;
  sexo: "M" | "F";
  especie?: AnimalSpeciesEnum | null;
  raca?: AnimalBreedEnum | null;
  dataNascimento?: string | null;
  dataEntrada?: string | null;
  loteId?: string | null;
  nome?: string | null;
  rfid?: string | null;
  paiId?: string | null;
  maeId?: string | null;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
  papelMacho?: "reprodutor" | "rufiao" | null;
  habilitadoMonta?: boolean;
  preparedPayload?: boolean;
}

export function validateAnimalRegistrationDraft(
  draft: AnimalRegistrationDraft,
  referenceDate = new Date(),
): string | null {
  if (!draft.identificacao.trim()) return "Identificação é obrigatória.";
  if (draft.sexo !== "M" && draft.sexo !== "F") return "Sexo inválido.";
  for (const [label, value] of [
    ["Data de nascimento", draft.dataNascimento],
    ["Data de entrada", draft.dataEntrada],
  ] as const) {
    if (!value) continue;
    const parsed = new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed > referenceDate) {
      return `${label} não pode ser inválida ou futura.`;
    }
  }
  return null;
}

export function buildAnimalRegistrationRecord(input: {
  fazendaId: string;
  draft: AnimalRegistrationDraft;
  origem:
    | "nascimento"
    | "compra"
    | "doacao"
    | "arrendamento"
    | "sociedade"
    | null;
  lifecycleConfig: FarmLifecycleConfig;
}) {
  const issue = validateAnimalRegistrationDraft(input.draft);
  if (issue) throw new Error(issue);

  const draft = input.draft;
  const legacy = getLegacyMaleFields({
    sexo: draft.sexo,
    destinoProdutivo: null,
    statusReprodutivoMacho: null,
  });
  const papel_macho =
    draft.papelMacho !== undefined ? draft.papelMacho : legacy.papel_macho;
  const habilitado_monta = draft.habilitadoMonta ?? legacy.habilitado_monta;
  let payload = draft.preparedPayload
    ? (draft.payload ?? {})
    : buildAnimalClassificationPayload(draft.payload ?? {}, {
        sexo: draft.sexo,
        destinoProdutivo: null,
        statusReprodutivoMacho: null,
        modoTransicao: null,
      });
  payload = draft.preparedPayload
    ? payload
    : buildAnimalTaxonomyFactsPayload(payload, {
        castrado: null,
        puberdade_confirmada: null,
        em_lactacao: null,
        secagem_realizada: null,
      });
  const lifecycle = resolveAnimalLifecycleSnapshot(
    {
      sexo: draft.sexo,
      data_nascimento: draft.dataNascimento || null,
      payload,
      papel_macho,
      habilitado_monta,
    },
    input.lifecycleConfig,
  );
  payload = draft.preparedPayload
    ? payload
    : buildAnimalLifecyclePayload(payload, lifecycle.targetStage, "manual");

  return {
    id: draft.id ?? crypto.randomUUID(),
    fazenda_id: input.fazendaId,
    identificacao: draft.identificacao.trim(),
    sexo: draft.sexo,
    status: "ativo" as const,
    lote_id: draft.loteId ?? null,
    data_nascimento: draft.dataNascimento || null,
    data_entrada: draft.dataEntrada || null,
    data_saida: null,
    pai_id: draft.paiId ?? null,
    mae_id: draft.maeId ?? null,
    nome: draft.nome?.trim() || null,
    rfid: draft.rfid?.trim() || null,
    especie: draft.especie ?? null,
    origem: input.origem,
    raca: draft.raca ?? null,
    papel_macho,
    habilitado_monta,
    observacoes: draft.observacoes?.trim() || null,
    payload,
  };
}
