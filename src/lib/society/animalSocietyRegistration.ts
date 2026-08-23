import type {
  FarmRoleEnum,
  OperationInput,
  SociedadePecuaria,
} from "@/lib/offline/types";

export const canManageLivestockSociety = (
  role: FarmRoleEnum | null | undefined,
) => role === "owner" || role === "manager";

type ExistingSocietyInput = {
  kind: "existing";
  society: Pick<
    SociedadePecuaria,
    "id" | "fazenda_id" | "status" | "deleted_at"
  >;
};

type NewSocietyInput = {
  kind: "new";
  id: string;
  contraparteId: string;
  nome: string;
  percentualFazenda: number;
};

export type AnimalSocietyRegistrationInput = {
  role: FarmRoleEnum | null | undefined;
  fazendaId: string;
  animalId: string;
  animalOperation: OperationInput;
  linkId: string;
  dataEntrada: string;
  society: ExistingSocietyInput | NewSocietyInput;
  now: string;
};

export function buildAnimalSocietyRegistrationOps(
  input: AnimalSocietyRegistrationInput,
): OperationInput[] {
  if (!canManageLivestockSociety(input.role)) {
    throw new Error("SOCIETY_WRITE_FORBIDDEN");
  }

  if (!input.fazendaId || !input.animalId || !input.linkId) {
    throw new Error("SOCIETY_REGISTRATION_ID_REQUIRED");
  }

  if (
    input.animalOperation.table !== "animais" ||
    input.animalOperation.action !== "INSERT" ||
    input.animalOperation.record.id !== input.animalId ||
    input.animalOperation.record.fazenda_id !== input.fazendaId
  ) {
    throw new Error("SOCIETY_ANIMAL_OPERATION_MISMATCH");
  }

  const ops: OperationInput[] = [];
  let societyId: string;

  if (input.society.kind === "existing") {
    const { society } = input.society;
    if (
      society.fazenda_id !== input.fazendaId ||
      society.status !== "ativa" ||
      society.deleted_at
    ) {
      throw new Error("SOCIETY_NOT_ACTIVE_IN_FARM");
    }
    societyId = society.id;
  } else {
    const percentualFazenda = input.society.percentualFazenda;
    if (
      !input.society.id ||
      !input.society.contraparteId ||
      !input.society.nome.trim() ||
      !Number.isFinite(percentualFazenda) ||
      percentualFazenda < 0 ||
      percentualFazenda > 100
    ) {
      throw new Error("SOCIETY_NEW_DRAFT_INVALID");
    }

    societyId = input.society.id;
    ops.push({
      table: "sociedades_pecuarias",
      action: "INSERT",
      record: {
        id: societyId,
        fazenda_id: input.fazendaId,
        contraparte_id: input.society.contraparteId,
        nome: input.society.nome.trim(),
        status: "ativa",
        data_inicio: input.dataEntrada,
        data_fim: null,
        percentual_fazenda: percentualFazenda,
        percentual_parceiro: 100 - percentualFazenda,
        regra_custos: "proporcional",
        regra_perdas: "proporcional",
        regra_receita: "proporcional",
        observacoes: null,
        payload: {},
        created_at: input.now,
        updated_at: input.now,
        deleted_at: null,
      },
    });
  }

  ops.push(input.animalOperation, {
    table: "sociedade_animais",
    action: "INSERT",
    record: {
      id: input.linkId,
      fazenda_id: input.fazendaId,
      sociedade_id: societyId,
      animal_id: input.animalId,
      data_entrada: input.dataEntrada,
      data_saida: null,
      status: "ativo",
      motivo_saida: null,
      observacoes: null,
      payload: { tipo_acao: "cadastro_animal_societario" },
      created_at: input.now,
      updated_at: input.now,
      deleted_at: null,
    },
  });

  return ops;
}
