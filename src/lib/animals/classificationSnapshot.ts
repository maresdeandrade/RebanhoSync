import type {
  Animal,
  CategoriaZootecnicaCanonicaEnum,
  FaseVeterinariaEnum,
  EstadoProdutivoReprodutivoEnum,
  AnimalLifeStageEnum,
} from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { readTaxonomyFactsRecord } from "@/lib/animals/taxonomyFactsContract";
import type { AnimalTaxonomyReproContext } from "@/lib/animals/taxonomy";

export interface AnimalClassificationInput {
  categoria_zootecnica?: string | null;
  sexo?: "M" | "F" | string | null;
  data_nascimento?: string | null;
  papel_macho?: "reprodutor" | "rufiao" | string | null;
  habilitado_monta?: boolean | null;
  destino_produtivo?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface AnimalClassificationOptions {
  referenceDate?: string | Date | null;
  config?: FarmLifecycleConfig;
  reproContext?: AnimalTaxonomyReproContext | null;
}

export interface AnimalClassificationSnapshot {
  categoriaZootecnica: CategoriaZootecnicaCanonicaEnum | "desconhecida";
  faseVeterinaria: FaseVeterinariaEnum | "desconhecida";
  estadoProdutivoReprodutivo: EstadoProdutivoReprodutivoEnum | "desconhecido";
  estagioVida: AnimalLifeStageEnum | "desconhecido";
  display: {
    categoriaZootecnica: string;
    faseVeterinaria: string;
    estadoProdutivoReprodutivo: string;
    estagioVida: string;
    summary: string;
  };
  source: "stored" | "inferred" | "mixed";
  limitations: string[];
}

// Helpers for date and age calculation
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length >= 10) {
      const date = new Date(`${trimmed.slice(0, 10)}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

function getAgeInDays(
  dataNascimento: string | null | undefined,
  referenceDate: string | Date | null | undefined,
): number | null {
  if (!dataNascimento || !referenceDate) return null;
  const birth = parseDate(dataNascimento);
  const ref = parseDate(referenceDate);
  if (!birth || !ref) return null;
  return Math.max(0, Math.floor((ref.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
}

function getDaysUntil(
  date: string | null | undefined,
  refDate: string | Date | null | undefined,
): number | null {
  if (!date || !refDate) return null;
  const target = parseDate(date);
  const ref = parseDate(refDate);
  if (!target || !ref) return null;
  return Math.ceil((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

// Normalizer for stored categories
function normalizeCategory(cat: unknown): CategoriaZootecnicaCanonicaEnum | null {
  if (typeof cat !== "string") return null;
  const s = cat.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("bezerra")) return "bezerra";
  if (s.includes("novilha")) return "novilha";
  if (s.includes("vaca")) return "vaca";
  if (s.includes("bezerro")) return "bezerro";
  if (s.includes("garrote") || s.includes("sobreano")) return "garrote";
  if (s.includes("boi") || s.includes("terminacao")) return "boi_terminacao";
  if (s.includes("touro")) return "touro";
  return null;
}

// Pure functions for conservative category and life stage inference
function inferCategoria(
  sexo: string | null | undefined,
  ageInDays: number | null,
  weight: number | null,
  weaned: boolean,
  castrado: boolean,
  papelMacho: string | null | undefined,
  destinoProdutivo: string | null | undefined,
  hasGivenBirth: boolean,
  cfg: FarmLifecycleConfig,
  useWeightBasis: boolean,
): CategoriaZootecnicaCanonicaEnum | "desconhecida" {
  if (sexo !== "M" && sexo !== "F") {
    return "desconhecida";
  }

  // If age, weight, and weaning are all missing/unknown, we cannot infer category safely without birth history
  if (ageInDays === null && weight === null && !weaned && !hasGivenBirth) {
    return "desconhecida";
  }

  if (sexo === "F") {
    if (hasGivenBirth) {
      return "vaca";
    }
    const isYoung = useWeightBasis
      ? (weight !== null && weight < cfg.weaning_weight_kg)
      : (ageInDays !== null && ageInDays < cfg.weaning_days);
    
    if (isYoung) return "bezerra";

    const isAdult = useWeightBasis
      ? (weight !== null && weight >= cfg.female_adult_weight_kg)
      : (ageInDays !== null && ageInDays >= cfg.female_adult_days);

    if (isAdult) return "vaca";
    return "novilha";
  }

  if (sexo === "M") {
    const isYoung = useWeightBasis
      ? (weight !== null && weight < cfg.weaning_weight_kg)
      : (ageInDays !== null && ageInDays < cfg.weaning_days);

    if (isYoung) return "bezerro";

    const isReprodutor = destinoProdutivo === "reprodutor" || papelMacho === "reprodutor";
    const isAdult = useWeightBasis
      ? (weight !== null && weight >= cfg.male_adult_weight_kg)
      : (ageInDays !== null && ageInDays >= cfg.male_adult_days);

    if (isReprodutor && isAdult) {
      return "touro";
    }

    if (castrado || destinoProdutivo === "abate" || destinoProdutivo === "engorda") {
      if (isAdult) return "boi_terminacao";
      return "garrote";
    }

    return "garrote";
  }

  return "desconhecida";
}

function inferLifeStage(
  sexo: string | null | undefined,
  ageInDays: number | null,
  weight: number | null,
  weaned: boolean,
  papelMacho: string | null | undefined,
  destinoProdutivo: string | null | undefined,
  castrado: boolean,
  hasGivenBirth: boolean,
  cfg: FarmLifecycleConfig,
  useWeightBasis: boolean,
): AnimalLifeStageEnum | "desconhecido" {
  if (sexo !== "M" && sexo !== "F") {
    return "desconhecido";
  }

  // If age, weight, and weaning are all missing/unknown, we cannot infer stage safely without birth history
  if (ageInDays === null && weight === null && !weaned && !hasGivenBirth) {
    return "desconhecido";
  }

  if (!weaned) {
    if (ageInDays !== null && ageInDays <= cfg.neonatal_days) {
      return "cria_neonatal";
    }
    if (useWeightBasis && weight !== null && weight < cfg.weaning_weight_kg) {
      return "cria_aleitamento";
    }
    if (!useWeightBasis && ageInDays !== null && ageInDays < cfg.weaning_days) {
      return "cria_aleitamento";
    }
  }

  if (sexo === "F") {
    if (hasGivenBirth) {
      return "vaca_adulta";
    }
    const isAdult = useWeightBasis
      ? (weight !== null && weight >= cfg.female_adult_weight_kg)
      : (ageInDays !== null && ageInDays >= cfg.female_adult_days);
    
    if (isAdult) return "vaca_adulta";
    if (weaned || (ageInDays !== null && ageInDays >= cfg.weaning_days) || (weight !== null && weight >= cfg.weaning_weight_kg)) {
      return "novilha";
    }
    return "desmamado";
  }

  if (sexo === "M") {
    const isReprodutor = destinoProdutivo === "reprodutor" || papelMacho === "reprodutor";
    const isAdult = useWeightBasis
      ? (weight !== null && weight >= cfg.male_adult_weight_kg)
      : (ageInDays !== null && ageInDays >= cfg.male_adult_days);
    
    if (isReprodutor) {
      if (isAdult) return "touro";
      return "garrote";
    }

    if (castrado || (destinoProdutivo && ["abate", "engorda", "venda", "descarte"].includes(destinoProdutivo))) {
      return isAdult ? "terminacao" : "recria";
    }

    if (isAdult) {
      return "boi_adulto";
    }

    const isBreedingCandidate = useWeightBasis
      ? (weight !== null && weight >= cfg.male_breeding_candidate_weight_kg)
      : (ageInDays !== null && ageInDays >= cfg.male_breeding_candidate_days);

    if (isBreedingCandidate) {
      return "garrote";
    }

    if (weaned || (ageInDays !== null && ageInDays >= cfg.weaning_days) || (weight !== null && weight >= cfg.weaning_weight_kg)) {
      return "recria";
    }

    return "desmamado";
  }

  return "desconhecido";
}

// Main Resolver Function
export function resolveAnimalClassificationSnapshot(
  input: AnimalClassificationInput,
  options?: AnimalClassificationOptions,
): AnimalClassificationSnapshot {
  const limitations: string[] = [];
  const cfg = options?.config || DEFAULT_FARM_LIFECYCLE_CONFIG;
  const refDate = options?.referenceDate || null;
  const reproContext = options?.reproContext || null;

  // 1. Validate referenceDate and calculate age
  let ageInDays: number | null = null;
  if (input.data_nascimento) {
    if (!refDate) {
      limitations.push("idade não calculável sem data de referência");
    } else {
      ageInDays = getAgeInDays(input.data_nascimento, refDate);
      if (ageInDays === null) {
        limitations.push("idade não calculável sem data de referência");
      }
    }
  } else {
    limitations.push("sem data de nascimento");
  }

  // Validate Sex
  if (!input.sexo) {
    limitations.push("sem sexo definido");
  } else if (input.sexo !== "M" && input.sexo !== "F") {
    limitations.push("sexo inválido");
  }

  // 2. Read explicit stored facts from taxonomy_facts
  const storedFacts = readTaxonomyFactsRecord(input.payload) || {};
  const castradoStored = typeof storedFacts.castrado === "boolean" ? storedFacts.castrado : null;
  const puberdadeConfirmada = typeof storedFacts.puberdade_confirmada === "boolean" ? storedFacts.puberdade_confirmada : null;
  const secagemRealizada = typeof storedFacts.secagem_realizada === "boolean" ? storedFacts.secagem_realizada : null;
  const emLactacao = typeof storedFacts.em_lactacao === "boolean" ? storedFacts.em_lactacao : null;
  const prenhezConfirmada = typeof storedFacts.prenhez_confirmada === "boolean" ? storedFacts.prenhez_confirmada : null;
  const dataPrevistaParto = typeof storedFacts.data_prevista_parto === "string" ? storedFacts.data_prevista_parto : null;
  const dataUltimoParto = typeof storedFacts.data_ultimo_parto === "string" ? storedFacts.data_ultimo_parto : null;

  const weaning = input.payload?.weaning || null;
  const weaned = weaning && typeof weaning.completed_at === "string";
  const metrics = input.payload?.metrics || null;
  const weight = metrics && typeof metrics.last_weight_kg === "number" ? metrics.last_weight_kg : null;
  const useWeightBasis = cfg.stage_classification_basis === "peso" && weight !== null;

  // Determine castrado state
  const castrado = castradoStored ?? (input.payload?.castrado === true);

  // Helper for pariu state
  const hasGivenBirth = Boolean(dataUltimoParto || reproContext?.dataUltimoParto);

  // Tracing sources for the 4 axes
  let srcCategoria: "stored" | "inferred" = "inferred";
  let srcFase: "stored" | "inferred" = "inferred";
  let srcEstado: "stored" | "inferred" = "inferred";
  let srcEstagio: "stored" | "inferred" = "inferred";

  // --- Axis 1: Categoria Zootécnica ---
  let categoria: CategoriaZootecnicaCanonicaEnum | "desconhecida" = "desconhecida";

  // Level 1: explicit facts in taxonomy_facts
  const explCat = normalizeCategory(input.categoria_zootecnica || storedFacts.categoria || storedFacts.categoria_zootecnica);
  if (explCat) {
    categoria = explCat;
    srcCategoria = "stored";
  } else if (hasGivenBirth && input.sexo === "F") {
    categoria = "vaca";
    srcCategoria = "stored";
  } else {
    // Level 2: Stored Stage of life
    const storedStage = input.payload?.lifecycle?.estagio_vida;
    if (typeof storedStage === "string" && input.sexo) {
      if (storedStage === "cria_neonatal" || storedStage === "cria_aleitamento" || storedStage === "desmamado") {
        categoria = input.sexo === "F" ? "bezerra" : "bezerro";
        srcCategoria = "stored";
      } else if (storedStage === "recria" || storedStage === "garrote") {
        categoria = input.sexo === "F" ? "novilha" : "garrote";
        srcCategoria = "stored";
      } else if (storedStage === "novilha") {
        categoria = "novilha";
        srcCategoria = "stored";
      } else if (storedStage === "vaca_adulta") {
        categoria = "vaca";
        srcCategoria = "stored";
      } else if (storedStage === "touro") {
        categoria = "touro";
        srcCategoria = "stored";
      } else if (storedStage === "boi_adulto" || storedStage === "terminacao") {
        categoria = input.sexo === "F" ? "novilha" : "boi_terminacao";
        srcCategoria = "stored";
      }
    }

    // Level 3 & 4: Inferência
    if (categoria === "desconhecida" && (input.sexo === "M" || input.sexo === "F")) {
      categoria = inferCategoria(
        input.sexo,
        ageInDays,
        weight,
        !!weaned,
        !!castrado,
        input.papel_macho,
        input.destino_produtivo,
        hasGivenBirth,
        cfg,
        useWeightBasis,
      );
      srcCategoria = "inferred";
    }
  }

  // --- Axis 2: Fase Veterinária ---
  let fase: FaseVeterinariaEnum | "desconhecida" = "desconhecida";

  // Level 1: explicit facts
  const isGestante = prenhezConfirmada === true || reproContext?.reproStatus?.status === "PRENHA";
  if (isGestante) {
    fase = "gestante";
    srcFase = "stored";
  } else if (hasGivenBirth && input.sexo === "F") {
    // Puerperio check if data_ultimo_parto and referenceDate are available
    const lastBirth = reproContext?.dataUltimoParto || dataUltimoParto;
    const daysSinceParto = getAgeInDays(lastBirth, refDate);
    if (daysSinceParto !== null && daysSinceParto <= 60) {
      fase = "puerperio";
      srcFase = "stored";
    }
  }

  if (fase === "desconhecida" && puberdadeConfirmada === true) {
    fase = "pubere";
    srcFase = "stored";
  } else if (fase === "desconhecida" && puberdadeConfirmada === false) {
    fase = "pre_pubere";
    srcFase = "stored";
  }

  // Level 2: Stored Stage of life
  if (fase === "desconhecida") {
    const storedStage = input.payload?.lifecycle?.estagio_vida;
    if (storedStage === "cria_neonatal") {
      fase = "neonatal";
      srcFase = "stored";
    } else if (storedStage === "cria_aleitamento") {
      fase = "pre_desmama";
      srcFase = "stored";
    } else if (storedStage === "desmamado") {
      fase = "pos_desmama";
      srcFase = "stored";
    }
  }

  // Level 3 & 4: Inferência
  if (fase === "desconhecida" && (input.sexo === "M" || input.sexo === "F")) {
    if (ageInDays !== null) {
      if (ageInDays <= cfg.neonatal_days) {
        fase = "neonatal";
      } else if (ageInDays < cfg.weaning_days && !weaned) {
        fase = "pre_desmama";
      } else {
        fase = "pos_desmama";
      }
    } else if (weaned) {
      fase = "pos_desmama";
    }
    srcFase = "inferred";
  }

  // --- Axis 4: Estágio de Vida ---
  let estagio: AnimalLifeStageEnum | "desconhecido" = "desconhecido";

  // Level 2: Stored Stage of life
  const storedStage = input.payload?.lifecycle?.estagio_vida;
  if (typeof storedStage === "string" && [
    "cria_neonatal",
    "cria_aleitamento",
    "desmamado",
    "recria",
    "garrote",
    "novilha",
    "vaca_adulta",
    "touro",
    "boi_adulto",
    "terminacao",
  ].includes(storedStage)) {
    estagio = storedStage as AnimalLifeStageEnum;
    srcEstagio = "stored";
  } else {
    // Level 3 & 4: Inferência
    if (input.sexo === "M" || input.sexo === "F") {
      estagio = inferLifeStage(
        input.sexo,
        ageInDays,
        weight,
        !!weaned,
        input.papel_macho,
        input.destino_produtivo,
        !!castrado,
        hasGivenBirth,
        cfg,
        useWeightBasis,
      );
      srcEstagio = "inferred";
    }
  }

  // --- Axis 3: Estado Produtivo/Reprodutivo ---
  let estado: EstadoProdutivoReprodutivoEnum | "desconhecido" = "desconhecido";

  // Level 1: explicit facts & reproduction context
  if (input.sexo === "F") {
    const lastBirth = reproContext?.dataUltimoParto || dataUltimoParto;
    const daysSinceParto = getAgeInDays(lastBirth, refDate);
    const previstoParto = reproContext?.dataPrevistaParto || dataPrevistaParto;
    const daysUntilParto = getDaysUntil(previstoParto, refDate);

    if (isGestante) {
      if (daysUntilParto !== null && daysUntilParto <= 30) {
        estado = "pre_parto_imediato";
      } else {
        estado = "prenhe";
      }
      srcEstado = "stored";
    } else if (secagemRealizada === true) {
      estado = "seca";
      srcEstado = "stored";
    } else if (daysSinceParto !== null && daysSinceParto <= 15) {
      estado = "recem_parida";
      srcEstado = "stored";
    } else if (emLactacao === true) {
      estado = "lactacao";
      srcEstado = "stored";
    } else if (prenhezConfirmada === false || reproContext?.reproStatus?.status === "VAZIA") {
      estado = "vazia";
      srcEstado = "stored";
    } else if (hasGivenBirth) {
      estado = "vazia";
      srcEstado = "stored";
    } else {
      // Conservative reproductive state resolution: No default reproductive state for female without explicit facts
      estado = "desconhecido";
      limitations.push("sem fato reprodutivo confirmado");
      srcEstado = "inferred";
    }
  } else if (input.sexo === "M") {
    const isReprodutor = input.destino_produtivo === "reprodutor" || input.papel_macho === "reprodutor" || input.habilitado_monta === true;
    if (isReprodutor) {
      estado = "reprodutor";
    } else if (estagio === "terminacao") {
      estado = "terminacao";
    } else if (castrado) {
      estado = "castrado";
    } else if (input.destino_produtivo === "abate" || input.destino_produtivo === "engorda") {
      estado = "terminacao";
    } else {
      estado = "inteiro";
    }
    srcEstado = "inferred";
  }

  // Calculate Overall Source
  // Combine only non-fallback resolved axes
  const activeSources: Array<"stored" | "inferred"> = [];
  if (categoria !== "desconhecida") activeSources.push(srcCategoria);
  if (fase !== "desconhecida") activeSources.push(srcFase);
  if (estado !== "desconhecido") activeSources.push(srcEstado);
  if (estagio !== "desconhecido") activeSources.push(srcEstagio);

  let overallSource: "stored" | "inferred" | "mixed" = "inferred";
  if (activeSources.length > 0) {
    const hasStored = activeSources.includes("stored");
    const hasInferred = activeSources.includes("inferred");
    if (hasStored && hasInferred) {
      overallSource = "mixed";
    } else if (hasStored) {
      overallSource = "stored";
    } else {
      overallSource = "inferred";
    }
  }

  return {
    categoriaZootecnica: categoria,
    faseVeterinaria: fase,
    estadoProdutivoReprodutivo: estado,
    estagioVida: estagio,
    display: {
      categoriaZootecnica: getCategoriaZootecnicaLabel(categoria),
      faseVeterinaria: getFaseVeterinariaLabel(fase),
      estadoProdutivoReprodutivo: getEstadoProdutivoReprodutivoLabel(estado),
      estagioVida: getAnimalLifeStageLabel(estagio),
      summary: getAnimalClassificationSummaryLabel({ categoriaZootecnica: categoria, estadoProdutivoReprodutivo: estado, estagioVida: estagio }),
    },
    source: overallSource,
    limitations,
  };
}

// Required helper functions for labels
export function getCategoriaZootecnicaLabel(
  categoria: CategoriaZootecnicaCanonicaEnum | "desconhecida",
): string {
  switch (categoria) {
    case "bezerra":
      return "Bezerra";
    case "novilha":
      return "Novilha";
    case "vaca":
      return "Vaca";
    case "bezerro":
      return "Bezerro";
    case "garrote":
      return "Garrote";
    case "boi_terminacao":
      return "Boi";
    case "touro":
      return "Touro";
    default:
      return "Categoria desconhecida";
  }
}

export function getFaseVeterinariaLabel(
  fase: FaseVeterinariaEnum | "desconhecida",
): string {
  switch (fase) {
    case "neonatal":
      return "Neonatal";
    case "pre_desmama":
      return "Pre-desmama";
    case "pos_desmama":
      return "Pos-desmama";
    case "pre_pubere":
      return "Pre-pubere";
    case "pubere":
      return "Pubere";
    case "gestante":
      return "Gestante";
    case "puerperio":
      return "Puerperio";
    default:
      return "Fase desconhecida";
  }
}

export function getEstadoProdutivoReprodutivoLabel(
  estado: EstadoProdutivoReprodutivoEnum | "desconhecido",
): string {
  switch (estado) {
    case "vazia":
      return "Vazia";
    case "prenhe":
      return "Prenhe";
    case "pre_parto_imediato":
      return "Pre-parto imediato";
    case "seca":
      return "Seca";
    case "recem_parida":
      return "Recem-parida";
    case "lactacao":
      return "Lactacao";
    case "inteiro":
      return "Inteiro";
    case "castrado":
      return "Castrado";
    case "reprodutor":
      return "Reprodutor";
    case "terminacao":
      return "Terminacao";
    default:
      return "Estado desconhecido";
  }
}

export function getAnimalLifeStageLabel(
  stage: AnimalLifeStageEnum | "desconhecido",
): string {
  switch (stage) {
    case "cria_neonatal":
      return "Cria neonatal";
    case "cria_aleitamento":
      return "Cria em aleitamento";
    case "desmamado":
      return "Desmamado";
    case "recria":
      return "Recria";
    case "garrote":
      return "Garrote";
    case "novilha":
      return "Novilha";
    case "vaca_adulta":
      return "Vaca adulta";
    case "touro":
      return "Touro";
    case "boi_adulto":
      return "Boi adulto";
    case "terminacao":
      return "Terminacao";
    default:
      return "Estágio desconhecido";
  }
}

export function getAnimalClassificationSummaryLabel(
  snapshot: {
    categoriaZootecnica: CategoriaZootecnicaCanonicaEnum | "desconhecida";
    estadoProdutivoReprodutivo: EstadoProdutivoReprodutivoEnum | "desconhecido";
    estagioVida: AnimalLifeStageEnum | "desconhecido";
  },
): string {
  const cat = getCategoriaZootecnicaLabel(snapshot.categoriaZootecnica);
  const est = getEstadoProdutivoReprodutivoLabel(snapshot.estadoProdutivoReprodutivo);
  const life = getAnimalLifeStageLabel(snapshot.estagioVida);
  return `${cat} · ${est} · ${life}`;
}
