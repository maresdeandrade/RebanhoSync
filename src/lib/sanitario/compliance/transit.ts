import type { FazendaSanidadeConfig, EstadoUFEnum } from "@/lib/offline/types";

export type TransitChecklistPurpose =
  | "movimentacao"
  | "venda"
  | "reproducao"
  | "evento"
  | "abate";

export interface TransitChecklistDraft {
  enabled: boolean;
  purpose: TransitChecklistPurpose;
  isInterstate: boolean;
  destinationUf: EstadoUFEnum | null;
  gtaChecked: boolean;
  gtaNumber: string;
  reproductionDocsChecked: boolean;
  brucellosisExamDate: string;
  tuberculosisExamDate: string;
  notes: string;
}

const REPRODUCTION_INTERSTATE_VALIDITY_DAYS = 60;

export const DEFAULT_TRANSIT_CHECKLIST_DRAFT: TransitChecklistDraft = {
  enabled: false,
  purpose: "movimentacao",
  isInterstate: false,
  destinationUf: null,
  gtaChecked: false,
  gtaNumber: "",
  reproductionDocsChecked: false,
  brucellosisExamDate: "",
  tuberculosisExamDate: "",
  notes: "",
};

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(
  payload: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = payload?.[key];
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is string => typeof entry === "string");
}

function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function hasOfficialTransitChecklistEnabled(
  config: FazendaSanidadeConfig | null | undefined,
) {
  const slugs = readStringArray(config?.payload, "activated_template_slugs");
  return slugs.includes("transito-gta-precheck");
}

export function validateTransitChecklist(
  draft: TransitChecklistDraft,
  asOfDate: string,
) {
  const issues: string[] = [];

  if (!draft.enabled) return issues;

  if (!draft.gtaChecked) {
    issues.push("Checklist GTA/e-GTA nao confirmado; confira a documentacao oficial antes do transito.");
  }

  if (draft.gtaChecked && !trimOrNull(draft.gtaNumber)) {
    issues.push("Numero/protocolo GTA/e-GTA nao informado; confira a guia oficial.");
  }

  if (draft.isInterstate && !draft.destinationUf) {
    issues.push("UF de destino nao informada; confira os requisitos interestaduais.");
  }

  if (draft.purpose === "reproducao") {
    issues.push(
      "Reproducao: confira exigencias PNCEBT conforme UF, categoria, idade e certificacao de origem; o checklist nao valida aptidao.",
    );
  }

  if (draft.purpose === "reproducao" && draft.isInterstate) {
    if (!draft.reproductionDocsChecked) {
      issues.push(
        "Reproducao interestadual: verifique os atestados PNCEBT aplicaveis e eventuais dispensas.",
      );
    }

    if (!draft.brucellosisExamDate || !draft.tuberculosisExamDate) {
      issues.push(
        "Datas dos atestados PNCEBT nao informadas; verifique sua aplicabilidade no caso concreto.",
      );
      return issues;
    }

    const brucellosisAgeDays = daysBetween(draft.brucellosisExamDate, asOfDate);
    if (!Number.isFinite(brucellosisAgeDays) || brucellosisAgeDays < 0) {
      issues.push("Brucelose: data invalida ou futura; confira a referencia de coleta.");
    } else if (brucellosisAgeDays > REPRODUCTION_INTERSTATE_VALIDITY_DAYS) {
      issues.push(
        "Brucelose: data informada supera 60 dias; confira a data de coleta e eventuais dispensas.",
      );
    }

    const tuberculosisAgeDays = daysBetween(draft.tuberculosisExamDate, asOfDate);
    if (!Number.isFinite(tuberculosisAgeDays) || tuberculosisAgeDays < 0) {
      issues.push("Tuberculose: data invalida ou futura; confira a referencia de inoculacao.");
    } else if (tuberculosisAgeDays > REPRODUCTION_INTERSTATE_VALIDITY_DAYS) {
      issues.push(
        "Tuberculose: data informada supera 60 dias; confira a data de inoculacao e eventuais dispensas.",
      );
    }
  }

  return issues;
}

export function buildTransitChecklistPayload(
  draft: TransitChecklistDraft,
  context: {
    officialPackEnabled: boolean;
  },
) {
  if (!draft.enabled) return {};

  return {
    transito_sanitario: {
      enabled: true,
      purpose: draft.purpose,
      is_interstate: draft.isInterstate,
      destination_uf: draft.destinationUf,
      gta_required: true,
      gta_checked: draft.gtaChecked,
      gta_number: trimOrNull(draft.gtaNumber),
      reproduction_docs_checked:
        draft.purpose === "reproducao" && draft.isInterstate
          ? draft.reproductionDocsChecked
          : false,
      brucellosis_exam_date:
        draft.purpose === "reproducao" && draft.isInterstate
          ? trimOrNull(draft.brucellosisExamDate)
          : null,
      tuberculosis_exam_date:
        draft.purpose === "reproducao" && draft.isInterstate
          ? trimOrNull(draft.tuberculosisExamDate)
          : null,
      notes: trimOrNull(draft.notes),
      source: context.officialPackEnabled
        ? "pack_oficial_transito"
        : "checklist_operacional_manual",
    },
  };
}
