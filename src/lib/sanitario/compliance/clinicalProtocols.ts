import type { Evento, SanitarioCaso } from "@/lib/offline/types";
import {
  STANDARD_PROTOCOLS,
  type StandardProtocol,
} from "@/lib/sanitario/catalog/baseProtocols";

export const CLINICAL_PROTOCOL_PAYLOAD_KEY = "clinical_protocol";
export const CLINICAL_PROTOCOL_PAYLOAD_SCHEMA_VERSION = 1;

export type ClinicalProtocolPayloadSource = "registrar_query_prefill";

export type ClinicalProtocolRef = {
  protocolId: string | null;
  itemId: string | null;
};

export type ClinicalProtocolEventPayload = {
  schema_version: typeof CLINICAL_PROTOCOL_PAYLOAD_SCHEMA_VERSION;
  protocol_id: string | null;
  item_id: string | null;
  source: ClinicalProtocolPayloadSource;
};

export type ClinicalProtocolSupport = {
  protocolId: string;
  title: string;
  summary: string;
  reference: string | null;
  matchSource: "explicit" | "context";
  sourceLabel: string;
  guidanceItems: Array<{
    id: string;
    label: string;
    detail: string;
    note: string | null;
  }>;
  safetyNotes: string[];
};

export type ClinicalProtocolTimelineSummary = {
  protocolId: string;
  protocolTitle: string;
  itemId: string | null;
  itemLabel: string | null;
};

export type ClinicalProtocolLibraryGovernance = {
  capabilityId: "sanitario.historico";
  policyVersion: 1;
  scope: "clinical_support_read_model";
  inclusionCriteria: string[];
  prohibitedEffects: string[];
  requiredItemRules: string[];
};

const CLINICAL_PROTOCOL_MATCHERS = [
  {
    protocolId: "med-tpb",
    conditionCodes: ["tristeza_parasitaria_bovina", "babesiose", "anaplasmose"],
    tokens: [
      "tpb",
      "tristeza",
      "parasitaria",
      "babesia",
      "babesiose",
      "anaplasma",
      "anaplasmose",
      "carrapato",
    ],
  },
  {
    protocolId: "med-mastite-seca",
    conditionCodes: ["terapia_vaca_seca", "secagem_lactacao", "mastite"],
    tokens: ["mastite", "seca", "secagem", "lactacao", "intramamario"],
  },
  {
    protocolId: "med-diarreia-neonatal",
    conditionCodes: ["diarreia_neonatal", "diarreia_bezerro", "desidratacao"],
    tokens: [
      "diarreia",
      "neonatal",
      "bezerro",
      "bezerra",
      "desidratacao",
      "soro",
      "reidratacao",
    ],
  },
  {
    protocolId: "med-respiratorio-pneumonia",
    conditionCodes: ["sindrome_respiratoria", "pneumonia", "bronquite"],
    tokens: [
      "respiratorio",
      "pneumonia",
      "tosse",
      "secrecao",
      "nasal",
      "dispneia",
      "febre",
      "pulmao",
    ],
  },
  {
    protocolId: "med-ferida-miiase",
    conditionCodes: ["ferida_miiase", "miiase", "ferida", "abscesso"],
    tokens: [
      "ferida",
      "lesao",
      "miiase",
      "bicheira",
      "abscesso",
      "curativo",
      "larvicida",
    ],
  },
];

const CLINICAL_PROTOCOL_IDS = CLINICAL_PROTOCOL_MATCHERS.map(
  (matcher) => matcher.protocolId,
);

export const CLINICAL_PROTOCOL_LIBRARY_GOVERNANCE: ClinicalProtocolLibraryGovernance =
  {
    capabilityId: "sanitario.historico",
    policyVersion: 1,
    scope: "clinical_support_read_model",
    inclusionCriteria: [
      "Uso apenas para caso sanitario do tipo clinico.",
      "Condicao clinica reconhecida por codigo explicito, payload versionado ou contexto textual.",
      "Roteiro deve orientar conduta registrada manualmente, sem decidir tratamento automaticamente.",
    ],
    prohibitedEffects: [
      "Nao materializa agenda.",
      "Nao cria evento sem acao explicita do usuario.",
      "Nao prescreve tratamento automaticamente.",
      "Nao baixa estoque ou movimenta insumo.",
      "Nao substitui avaliacao veterinaria.",
    ],
    requiredItemRules: [
      "Todo item clinico deve manter gera_agenda=false.",
      "Todo item clinico deve usar calendario_base.mode=clinical_protocol.",
      "Todo item clinico deve declarar target_policy por animal.",
    ],
  };

const EXPLICIT_PROTOCOL_KEYS = [
  "clinical_protocol_id",
  "clinicalProtocolId",
  "protocolo_clinico_id",
  "protocoloClinicoId",
  "protocol_id",
  "protocolId",
];

export function isClinicalSupportProtocol(protocolId: string | null | undefined) {
  return Boolean(protocolId && CLINICAL_PROTOCOL_IDS.includes(protocolId));
}

export function validateClinicalProtocolLibraryGovernance(
  protocols: StandardProtocol[] = STANDARD_PROTOCOLS,
): string[] {
  return protocols
    .filter((protocol) => isClinicalSupportProtocol(protocol.id))
    .flatMap((protocol) => {
      const violations: string[] = [];

      if (protocol.categoria !== "medicamentos") {
        violations.push(`${protocol.id}: categoria deve ser medicamentos`);
      }

      if (protocol.calendario_base.profile !== "terapeutico") {
        violations.push(`${protocol.id}: profile deve ser terapeutico`);
      }

      for (const item of protocol.itens) {
        if (item.gera_agenda) {
          violations.push(`${protocol.id}/${item.item_code}: nao pode gerar agenda`);
        }

        if (item.calendario_base.mode !== "clinical_protocol") {
          violations.push(
            `${protocol.id}/${item.item_code}: calendario deve ser clinical_protocol`,
          );
        }

        if (item.target_policy?.target_scope !== "animal") {
          violations.push(`${protocol.id}/${item.item_code}: alvo deve ser animal`);
        }
      }

      return violations;
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeProtocolId(value: unknown): string | null {
  const normalized = normalizeSearchText(value).replace(/_/g, "-");
  if (!normalized) return null;

  const directMatch = CLINICAL_PROTOCOL_MATCHERS.find(
    (candidate) => candidate.protocolId === normalized,
  );
  if (directMatch) return directMatch.protocolId;

  const conditionMatch = CLINICAL_PROTOCOL_MATCHERS.find((candidate) =>
    candidate.conditionCodes.some(
      (code) => normalizeSearchText(code).replace(/_/g, "-") === normalized,
    ),
  );

  return conditionMatch?.protocolId ?? null;
}

function readExplicitProtocolId(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;

  const clinicalPayload = readClinicalProtocolEventPayload(payload);
  if (clinicalPayload?.protocol_id) return clinicalPayload.protocol_id;

  for (const key of EXPLICIT_PROTOCOL_KEYS) {
    const protocolId = normalizeProtocolId(payload[key]);
    if (protocolId) return protocolId;
  }

  return null;
}

export function buildClinicalProtocolEventPayload(
  ref: ClinicalProtocolRef | null | undefined,
): Record<string, ClinicalProtocolEventPayload> | Record<string, never> {
  if (!ref?.protocolId && !ref?.itemId) return {};

  return {
    [CLINICAL_PROTOCOL_PAYLOAD_KEY]: {
      schema_version: CLINICAL_PROTOCOL_PAYLOAD_SCHEMA_VERSION,
      protocol_id: ref.protocolId,
      item_id: ref.itemId,
      source: "registrar_query_prefill",
    },
  };
}

export function readClinicalProtocolEventPayload(
  payload: Record<string, unknown> | null | undefined,
): ClinicalProtocolEventPayload | null {
  if (!payload) return null;

  const clinicalPayload = payload[CLINICAL_PROTOCOL_PAYLOAD_KEY];
  if (!isRecord(clinicalPayload)) return null;

  const protocolId =
    typeof clinicalPayload.protocol_id === "string"
      ? normalizeProtocolId(clinicalPayload.protocol_id)
      : null;
  const itemId =
    typeof clinicalPayload.item_id === "string" && clinicalPayload.item_id.trim()
      ? clinicalPayload.item_id.trim()
      : null;

  if (!protocolId && !itemId) return null;

  return {
    schema_version: CLINICAL_PROTOCOL_PAYLOAD_SCHEMA_VERSION,
    protocol_id: protocolId,
    item_id: itemId,
    source: "registrar_query_prefill",
  };
}

export function buildClinicalProtocolTimelineSummary(
  payload: Record<string, unknown> | null | undefined,
): ClinicalProtocolTimelineSummary | null {
  const clinicalPayload = readClinicalProtocolEventPayload(payload);
  if (!clinicalPayload) return null;

  const protocol =
    STANDARD_PROTOCOLS.find(
      (entry) => entry.id === clinicalPayload.protocol_id,
    ) ??
    STANDARD_PROTOCOLS.find((entry) =>
      entry.itens.some((item) => item.item_code === clinicalPayload.item_id),
    ) ??
    null;
  if (!protocol) return null;

  const protocolItem =
    clinicalPayload.item_id === null
      ? null
      : (protocol.itens.find(
          (item) => item.item_code === clinicalPayload.item_id,
        ) ?? null);

  return {
    protocolId: protocol.id,
    protocolTitle: protocol.nome,
    itemId: clinicalPayload.item_id,
    itemLabel: protocolItem?.produto ?? null,
  };
}

function collectPayloadText(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return "";

  return Object.values(payload)
    .map((value) => {
      if (Array.isArray(value)) return value.join(" ");
      if (value && typeof value === "object") return JSON.stringify(value);
      return String(value ?? "");
    })
    .join(" ");
}

function resolveExplicitProtocolId(input: {
  caseRecord: SanitarioCaso;
  events: Pick<Evento, "observacoes" | "payload">[];
}): string | null {
  return (
    normalizeProtocolId(input.caseRecord.disease_code) ??
    readExplicitProtocolId(input.caseRecord.payload) ??
    input.events
      .map((event) => readExplicitProtocolId(event.payload))
      .find((protocolId): protocolId is string => Boolean(protocolId)) ??
    null
  );
}

function buildClinicalCaseSearchText(input: {
  caseRecord: SanitarioCaso;
  events: Pick<Evento, "observacoes" | "payload">[];
}) {
  return normalizeSearchText(
    [
      input.caseRecord.disease_code,
      input.caseRecord.disease_name,
      input.caseRecord.closure_reason,
      input.caseRecord.observacoes,
      collectPayloadText(input.caseRecord.payload),
      ...input.events.flatMap((event) => [
        event.observacoes,
        collectPayloadText(event.payload),
      ]),
    ].join(" "),
  );
}

export function buildClinicalProtocolSupport(input: {
  caseRecord: SanitarioCaso;
  events?: Pick<Evento, "observacoes" | "payload">[];
}): ClinicalProtocolSupport | null {
  if (input.caseRecord.tipo !== "clinico") return null;

  const context = {
    caseRecord: input.caseRecord,
    events: input.events ?? [],
  };
  const explicitProtocolId = resolveExplicitProtocolId(context);
  const searchText = buildClinicalCaseSearchText(context);
  const contextMatch = CLINICAL_PROTOCOL_MATCHERS.find((candidate) =>
    candidate.tokens.some((token) => searchText.includes(token)),
  );
  const protocolId = explicitProtocolId ?? contextMatch?.protocolId ?? null;
  if (!protocolId) return null;

  const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === protocolId);
  if (!protocol) return null;

  const matchSource = explicitProtocolId ? "explicit" : "context";

  return {
    protocolId: protocol.id,
    title: protocol.nome,
    summary: protocol.descricao,
    reference: protocol.referencia ?? null,
    matchSource,
    sourceLabel: matchSource === "explicit" ? "Selecionado" : "Contexto",
    guidanceItems: protocol.itens.map((item) => ({
      id: item.item_code,
      label: item.produto,
      detail: item.indicacao,
      note: item.observacoes ?? null,
    })),
    safetyNotes: [
      "Apoio clinico informativo; nao gera agenda, evento ou baixa de estoque.",
      "Registrar apenas condutas realmente executadas no fluxo de manejo sanitario.",
      "Este roteiro nao substitui avaliacao veterinaria.",
    ],
  };
}
