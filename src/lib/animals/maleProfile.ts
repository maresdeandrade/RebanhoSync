import type {
  Animal,
  DestinoProdutivoAnimalEnum,
  ModoTransicaoEstagioEnum,
  PapelMachoEnum,
  StatusReprodutivoMachoEnum,
} from "@/lib/offline/types";

type AnimalPayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): AnimalPayloadRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as AnimalPayloadRecord;
}

function getLifecycleRecord(payload: AnimalPayloadRecord) {
  return asRecord(payload.lifecycle);
}

function getMaleProfileRecord(payload: AnimalPayloadRecord) {
  return asRecord(payload.male_profile);
}

function isDestinoProdutivo(value: unknown): value is DestinoProdutivoAnimalEnum {
  return (
    value === "reprodutor" ||
    value === "rufiao" ||
    value === "engorda" ||
    value === "abate" ||
    value === "venda" ||
    value === "descarte"
  );
}

function isStatusReprodutivo(
  value: unknown,
): value is StatusReprodutivoMachoEnum {
  return (
    value === "candidato" ||
    value === "apto" ||
    value === "suspenso" ||
    value === "inativo"
  );
}

function isModoTransicao(value: unknown): value is ModoTransicaoEstagioEnum {
  return value === "automatico" || value === "manual" || value === "hibrido";
}

export function isMaleBreedingDestination(
  destinoProdutivo: DestinoProdutivoAnimalEnum | null | undefined,
) {
  return destinoProdutivo === "reprodutor" || destinoProdutivo === "rufiao";
}

export function getAnimalProductiveDestination(
  animal: Pick<Animal, "payload" | "papel_macho">,
): DestinoProdutivoAnimalEnum | null {
  const payload = asRecord(animal.payload);
  const lifecycle = getLifecycleRecord(payload);
  const destino = lifecycle.destino_produtivo;

  if (isDestinoProdutivo(destino)) {
    return destino;
  }

  if (animal.papel_macho === "reprodutor" || animal.papel_macho === "rufiao") {
    return animal.papel_macho;
  }

  return null;
}

export function getAnimalTransitionMode(
  animal: Pick<Animal, "payload">,
): ModoTransicaoEstagioEnum | null {
  const payload = asRecord(animal.payload);
  const lifecycle = getLifecycleRecord(payload);
  const mode = lifecycle.modo_transicao;

  return isModoTransicao(mode) ? mode : null;
}

export function getMaleReproductiveStatus(
  animal: Pick<Animal, "payload" | "papel_macho" | "habilitado_monta">,
): StatusReprodutivoMachoEnum | null {
  const payload = asRecord(animal.payload);
  const maleProfile = getMaleProfileRecord(payload);
  const status = maleProfile.status_reprodutivo;

  if (isStatusReprodutivo(status)) {
    return status;
  }

  if (animal.papel_macho === "reprodutor" || animal.papel_macho === "rufiao") {
    return animal.habilitado_monta ? "apto" : "candidato";
  }

  if (animal.habilitado_monta) {
    return "apto";
  }

  return null;
}

export function isAnimalBreedingEligible(
  animal: Pick<Animal, "sexo" | "payload" | "papel_macho" | "habilitado_monta">,
) {
  if (animal.sexo !== "M") return false;

  return (
    getAnimalProductiveDestination(animal) === "reprodutor" &&
    getMaleReproductiveStatus(animal) === "apto"
  );
}

export function getLegacyMaleFields(profile: {
  sexo: Animal["sexo"];
  destinoProdutivo: DestinoProdutivoAnimalEnum | null;
  statusReprodutivoMacho: StatusReprodutivoMachoEnum | null;
}): {
  papel_macho: PapelMachoEnum | null;
  habilitado_monta: boolean;
} {
  if (profile.sexo !== "M") {
    return {
      papel_macho: null,
      habilitado_monta: false,
    };
  }

  const papelMacho =
    profile.destinoProdutivo === "reprodutor" ||
    profile.destinoProdutivo === "rufiao"
      ? profile.destinoProdutivo
      : null;

  return {
    papel_macho: papelMacho,
    habilitado_monta:
      papelMacho !== null && profile.statusReprodutivoMacho === "apto",
  };
}

export function buildAnimalClassificationPayload(
  currentPayload: Record<string, unknown> | null | undefined,
  profile: {
    sexo: Animal["sexo"];
    destinoProdutivo: DestinoProdutivoAnimalEnum | null;
    statusReprodutivoMacho: StatusReprodutivoMachoEnum | null;
    modoTransicao: ModoTransicaoEstagioEnum | null;
  },
) {
  const nextPayload = { ...asRecord(currentPayload) };
  const lifecycle = { ...getLifecycleRecord(nextPayload) };
  const maleProfile = { ...getMaleProfileRecord(nextPayload) };

  if (profile.sexo === "M" && profile.destinoProdutivo) {
    lifecycle.destino_produtivo = profile.destinoProdutivo;
  } else {
    delete lifecycle.destino_produtivo;
  }

  if (profile.modoTransicao) {
    lifecycle.modo_transicao = profile.modoTransicao;
  } else {
    delete lifecycle.modo_transicao;
  }

  if (Object.keys(lifecycle).length > 0) {
    nextPayload.lifecycle = lifecycle;
  } else {
    delete nextPayload.lifecycle;
  }

  if (profile.sexo === "M" && profile.statusReprodutivoMacho) {
    maleProfile.status_reprodutivo = profile.statusReprodutivoMacho;
  } else {
    delete maleProfile.status_reprodutivo;
  }

  if (Object.keys(maleProfile).length > 0) {
    nextPayload.male_profile = maleProfile;
  } else {
    delete nextPayload.male_profile;
  }

  return nextPayload;
}

export function getAnimalProductiveDestinationLabel(
  destinoProdutivo: DestinoProdutivoAnimalEnum | null | undefined,
) {
  switch (destinoProdutivo) {
    case "reprodutor":
      return "Destino: reprodutor";
    case "rufiao":
      return "Destino: rufiao";
    case "engorda":
      return "Destino: engorda";
    case "abate":
      return "Destino: abate";
    case "venda":
      return "Destino: venda";
    case "descarte":
      return "Destino: descarte";
    default:
      return null;
  }
}

export function getMaleReproductiveStatusLabel(
  status: StatusReprodutivoMachoEnum | null | undefined,
) {
  switch (status) {
    case "candidato":
      return "Status: candidato";
    case "apto":
      return "Status: apto";
    case "suspenso":
      return "Status: suspenso";
    case "inativo":
      return "Status: inativo";
    default:
      return null;
  }
}

export function getTransitionModeLabel(
  mode: ModoTransicaoEstagioEnum | null | undefined,
) {
  switch (mode) {
    case "automatico":
      return "Transicao automatica";
    case "manual":
      return "Transicao manual";
    case "hibrido":
      return "Transicao hibrida";
    default:
      return null;
  }
}
