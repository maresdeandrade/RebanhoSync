import type { SanitarioTipoEnum } from "@/lib/offline/types";
import {
  buildSanitaryBaseCalendarPayload,
  type SanitaryBaseCalendarRule,
} from "@/lib/sanitario/engine/calendar";
import {
  buildSanitaryRegimenPayload,
  inferSanitaryRegimenMilestone,
} from "@/lib/sanitario/engine/regimen";

export type StandardProtocolCategory =
  | "vacinas"
  | "vermifugacao"
  | "medicamentos";

export type StandardProtocolLegalStatus = "recomendado" | "boa_pratica";
export type StandardProtocolScope = "fazenda";
export type StandardProtocolActivationMode = "materializar_protocolo";

export type StandardProtocolFamilyCode =
  | "raiva_herbivoros"
  | "clostridioses"
  | "reprodutiva"
  | "controle_estrategico_parasitas"
  | "vermifugacao_desmama"
  | "cura_umbigo"
  | "tristeza_parasitaria_bovina"
  | "terapia_vaca_seca";

export type StandardProtocolScheduleKind =
  | "calendar_base"
  | "after_previous_completion"
  | "rolling_from_last_completion";

export interface StandardProtocolAgendaActivation {
  mode: "risk_config_explicit";
  explicit: true;
  risk_field: "zona_raiva_risco";
  risk_values: ["medio", "alto"];
  unknown_history_policy?: "start_from_d1";
}

export interface StandardProtocolDependsOn {
  milestone_code: string;
  interval_days: number;
}

export interface StandardProtocolItem {
  tipo: SanitarioTipoEnum;
  produto: string;
  intervalo_dias: number;
  dose_num: number;
  gera_agenda: boolean;
  indicacao: string;
  sexo_alvo?: "M" | "F" | "todos";
  idade_min_dias?: number;
  idade_max_dias?: number;
  observacoes?: string;
  dedup_template?: string;
  item_code: string;
  depends_on_item_code?: string;
  schedule_kind?: StandardProtocolScheduleKind;
  depends_on?: StandardProtocolDependsOn;
  agenda_activation?: StandardProtocolAgendaActivation;
  calendario_base: SanitaryBaseCalendarRule;
}

export interface StandardProtocol {
  id: string;
  canonical_key: string;
  family_code: StandardProtocolFamilyCode;
  nome: string;
  descricao: string;
  categoria: StandardProtocolCategory;
  scope: StandardProtocolScope;
  status_legal: StandardProtocolLegalStatus;
  source_origin: "biblioteca_canonica_fazenda";
  activation_mode: StandardProtocolActivationMode;
  obrigatorio?: boolean;
  referencia?: string;
  calendario_base: {
    profile:
      | "campanha_oficial"
      | "preventivo_anual"
      | "preventivo_sazonal"
      | "janela_etaria"
      | "procedimento_imediato"
      | "terapeutico";
    label: string;
  };
  itens: StandardProtocolItem[];
}

export const STANDARD_PROTOCOL_LIBRARY_VERSION = 1;

const RABIES_OPERATIONAL_AGENDA_ACTIVATION = {
  mode: "risk_config_explicit",
  explicit: true,
  risk_field: "zona_raiva_risco",
  risk_values: ["medio", "alto"],
} satisfies StandardProtocolAgendaActivation;

export const STANDARD_PROTOCOLS: StandardProtocol[] = [
  {
    id: "vac-raiva-herbivoros",
    canonical_key: "raiva_herbivoros",
    family_code: "raiva_herbivoros",
    nome: "Raiva dos Herbivoros (D1/D2/Anual)",
    descricao:
      "Protocolo tecnico operacional condicionado a risco medio/alto e ativacao explicita pela fazenda.",
    categoria: "vacinas",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    obrigatorio: false,
    referencia: "PNCRH / orientacao tecnica operacional por risco",
    calendario_base: {
      profile: "preventivo_anual",
      label: "Sequencia condicionada a risco configurado",
    },
    itens: [
      {
        item_code: "raiva_d1",
        tipo: "vacinacao",
        produto: "Vacina Raiva Herbivoros",
        intervalo_dias: 1,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Dose inicial somente por protocolo operacional ativo, risco medio/alto e ativacao explicita.",
        sexo_alvo: "todos",
        schedule_kind: "calendar_base",
        agenda_activation: {
          ...RABIES_OPERATIONAL_AGENDA_ACTIVATION,
          unknown_history_policy: "start_from_d1",
        },
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "none",
          label: "Raiva D1 - inicio operacional por risco",
        },
      },
      {
        item_code: "raiva_d2",
        depends_on_item_code: "raiva_d1",
        tipo: "vacinacao",
        produto: "Vacina Raiva Herbivoros",
        intervalo_dias: 30,
        dose_num: 2,
        gera_agenda: true,
        indicacao:
          "Reforco 30 dias apos conclusao valida de D1. Nao deve nascer sem D1 concluida.",
        sexo_alvo: "todos",
        schedule_kind: "after_previous_completion",
        depends_on: {
          milestone_code: "raiva_d1",
          interval_days: 30,
        },
        agenda_activation: RABIES_OPERATIONAL_AGENDA_ACTIVATION,
        calendario_base: {
          mode: "rolling_interval",
          anchor: "previous_completion",
          label: "Raiva D2 - 30 dias apos D1",
          intervalDays: 30,
        },
      },
      {
        item_code: "raiva_anual",
        depends_on_item_code: "raiva_d2",
        tipo: "vacinacao",
        produto: "Vacina Raiva Herbivoros",
        intervalo_dias: 365,
        dose_num: 3,
        gera_agenda: true,
        indicacao:
          "Reforco anual apos D2 e, depois, apos a ultima dose anual concluida.",
        sexo_alvo: "todos",
        schedule_kind: "rolling_from_last_completion",
        depends_on: {
          milestone_code: "raiva_d2",
          interval_days: 365,
        },
        agenda_activation: RABIES_OPERATIONAL_AGENDA_ACTIVATION,
        calendario_base: {
          mode: "rolling_interval",
          anchor: "previous_completion",
          label: "Raiva anual - 365 dias apos ultima conclusao valida",
          intervalDays: 365,
        },
      },
    ],
  },
  {
    id: "vac-clostridioses",
    canonical_key: "clostridioses",
    family_code: "clostridioses",
    nome: "Clostridioses (Manqueira/Polivalente)",
    descricao:
      "Prevencao contra Carbunculo Sintomatico, Gangrena Gasosa, Enterotoxemias e Botulismo.",
    categoria: "vacinas",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    obrigatorio: false,
    referencia: "SBMV / Embrapa",
    calendario_base: {
      profile: "preventivo_anual",
      label: "Revisao anual preventiva",
    },
    itens: [
      {
        item_code: "clostridio-anual",
        tipo: "vacinacao",
        produto: "Vacina Polivalente Clostridioses",
        intervalo_dias: 365,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Todo o rebanho. Animais jovens: primovacinacao aos 3-4 meses + reforco 4 semanas depois.",
        sexo_alvo: "todos",
        observacoes:
          "Essencial em sistemas intensivos e regioes com historico da doenca.",
        calendario_base: {
          mode: "rolling_interval",
          anchor: "calendar_month",
          label: "Revisao anual do rebanho",
          intervalDays: 365,
        },
      },
    ],
  },
  {
    id: "vac-reprodutiva",
    canonical_key: "reprodutiva",
    family_code: "reprodutiva",
    nome: "Reprodutiva (IBR/BVD/Leptospirose)",
    descricao:
      "Prevencao de perdas gestacionais e infertilidade causadas por virus e bacterias.",
    categoria: "vacinas",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    obrigatorio: false,
    referencia: "SBMV / Embrapa",
    calendario_base: {
      profile: "preventivo_sazonal",
      label: "Pre-estacao de monta",
    },
    itens: [
      {
        item_code: "reprodutiva-pre-estacao",
        tipo: "vacinacao",
        produto: "Vacina Reprodutiva (IBR/BVD/Lepto)",
        intervalo_dias: 365,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Femeas em idade reprodutiva e touros. Aplicar 30 dias antes da estacao de monta.",
        sexo_alvo: "todos",
        observacoes: "Primovacinacao requer reforco.",
        calendario_base: {
          mode: "campaign",
          anchor: "pre_breeding_season",
          label: "Aplicar 30 dias antes da estacao de monta",
          intervalDays: 365,
        },
      },
    ],
  },
  {
    id: "vermi-estrategica-seca",
    canonical_key: "controle_estrategico_parasitas",
    family_code: "controle_estrategico_parasitas",
    nome: "Controle Estrategico (5-7-9)",
    descricao:
      "Esquema classico de vermifugacao estrategica no inicio, meio e fim da seca (maio, julho, setembro).",
    categoria: "vermifugacao",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    referencia: "Embrapa Gado de Corte",
    calendario_base: {
      profile: "preventivo_sazonal",
      label: "Campanha estrategica da seca",
    },
    itens: [
      {
        item_code: "seca-maio",
        tipo: "vermifugacao",
        produto: "Vermifugo (Base Avermectina 1%)",
        intervalo_dias: 60,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Mes 5 (maio) - Inicio da seca. Reduzir carga parasitaria nos animais e pastagens.",
        calendario_base: {
          mode: "campaign",
          anchor: "calendar_month",
          label: "Campanha de maio",
          months: [5],
          intervalDays: 60,
        },
      },
      {
        item_code: "seca-julho",
        depends_on_item_code: "seca-maio",
        tipo: "vermifugacao",
        produto: "Vermifugo (Base Levamisol/Albendazol)",
        intervalo_dias: 60,
        dose_num: 2,
        gera_agenda: true,
        indicacao:
          "Mes 7 (julho) - Meio da seca. Rotacao de principio ativo para evitar resistencia.",
        calendario_base: {
          mode: "campaign",
          anchor: "calendar_month",
          label: "Campanha de julho",
          months: [7],
          intervalDays: 60,
        },
      },
      {
        item_code: "seca-setembro",
        depends_on_item_code: "seca-julho",
        tipo: "vermifugacao",
        produto: "Vermifugo (Base Moxidectina/Avermectina)",
        intervalo_dias: 60,
        dose_num: 3,
        gera_agenda: true,
        indicacao:
          "Mes 9 (setembro) - Fim da seca / inicio das chuvas. Preparacao para epoca das aguas.",
        calendario_base: {
          mode: "campaign",
          anchor: "calendar_month",
          label: "Campanha de setembro",
          months: [9],
          intervalDays: 60,
        },
      },
    ],
  },
  {
    id: "vermi-desmama",
    canonical_key: "vermifugacao_desmama",
    family_code: "vermifugacao_desmama",
    nome: "Vermifugacao a Desmama",
    descricao:
      "Controle parasitario em bezerros no momento da desmama (fase de alto estresse e suscetibilidade).",
    categoria: "vermifugacao",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    referencia: "Pratica Zootecnica Padrao",
    calendario_base: {
      profile: "janela_etaria",
      label: "Aplicacao na desmama",
    },
    itens: [
      {
        item_code: "desmama-endectocida",
        tipo: "vermifugacao",
        produto: "Vermifugo (Endectocida)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: true,
        indicacao: "Bezerros(as) na desmama (6-8 meses).",
        idade_min_dias: 180,
        idade_max_dias: 270,
        calendario_base: {
          mode: "age_window",
          anchor: "weaning",
          label: "Aplicacao na desmama (180 a 270 dias)",
          ageStartDays: 180,
          ageEndDays: 270,
        },
      },
    ],
  },
  {
    id: "med-cura-umbigo",
    canonical_key: "cura_umbigo",
    family_code: "cura_umbigo",
    nome: "Cura de Umbigo (Recem-Nascidos)",
    descricao:
      "Protocolo essencial para prevencao de onfaloflebites, miiases e infeccoes sistemicas.",
    categoria: "medicamentos",
    scope: "fazenda",
    status_legal: "boa_pratica",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    referencia: "Boas Praticas de Manejo (BPM)",
    calendario_base: {
      profile: "procedimento_imediato",
      label: "Manejo neonatal imediato",
    },
    itens: [
      {
        item_code: "cura-umbigo",
        tipo: "medicamento",
        produto: "Iodo 10% (tintura) + Repelente spray",
        intervalo_dias: 1,
        dose_num: 1,
        gera_agenda: false,
        indicacao:
          "Imediatamente apos o nascimento. Cortar umbigo se necessario (2 dedos). Mergulhar no iodo.",
        idade_min_dias: 0,
        idade_max_dias: 30,
        observacoes: "Repetir diariamente ate a secagem completa (3-5 dias).",
        calendario_base: {
          mode: "immediate",
          anchor: "birth",
          label: "Manejo imediato ao nascimento",
          ageStartDays: 0,
          ageEndDays: 30,
        },
      },
    ],
  },
  {
    id: "med-tpb",
    canonical_key: "tristeza_parasitaria_bovina",
    family_code: "tristeza_parasitaria_bovina",
    nome: "Tratamento Tristeza Parasitara (TPB)",
    descricao:
      "Protocolo terapeutico para casos de Babesiose e Anaplasmose (carrapato).",
    categoria: "medicamentos",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    referencia: "Protocolo Clinico Veterinario",
    calendario_base: {
      profile: "terapeutico",
      label: "Uso sob criterio clinico",
    },
    itens: [
      {
        item_code: "tpb-diminazeno",
        tipo: "medicamento",
        produto: "Diminazeno (Ganaseg/Outros)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Combate a Babesia. Aplicar intramuscular profunda conforme bula.",
        observacoes: "Dose geralmente 3,5mg/kg.",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "clinical_need",
          label: "Uso terapeutico sob criterio clinico",
        },
      },
      {
        item_code: "tpb-oxitetraciclina",
        tipo: "medicamento",
        produto: "Oxitetraciclina L.A.",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Combate a Anaplasma. Aplicar intramuscular profunda.",
        observacoes: "Dose geralmente 20mg/kg.",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "clinical_need",
          label: "Uso terapeutico sob criterio clinico",
        },
      },
      {
        item_code: "tpb-antitermico",
        tipo: "medicamento",
        produto: "Antitermico/Anti-inflamatorio (Dipirona/Melo)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Controle da febre e dor. Suporte.",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "clinical_need",
          label: "Uso terapeutico sob criterio clinico",
        },
      },
    ],
  },
  {
    id: "med-mastite-seca",
    canonical_key: "terapia_vaca_seca",
    family_code: "terapia_vaca_seca",
    nome: "Terapia de Vaca Seca (Mastite)",
    descricao:
      "Prevencao e cura de mastite no periodo seco em vacas leiteiras ou corte com alta producao.",
    categoria: "medicamentos",
    scope: "fazenda",
    status_legal: "recomendado",
    source_origin: "biblioteca_canonica_fazenda",
    activation_mode: "materializar_protocolo",
    referencia: "SBMV - Qualidade do Leite",
    calendario_base: {
      profile: "terapeutico",
      label: "Procedimento de secagem",
    },
    itens: [
      {
        item_code: "secagem-intramamario",
        tipo: "medicamento",
        produto: "Antibiotico Intramamario (Vaca Seca)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Vacas no encerramento da lactacao (60 dias antes do parto previsto).",
        sexo_alvo: "F",
        observacoes:
          "Aplicar em todos os quartos apos a ultima ordenha. Usar selante de teto se possivel.",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "dry_off",
          label: "Aplicar na secagem / ultima ordenha",
        },
      },
    ],
  },
];

export function normalizeStandardProtocolInterval(item: StandardProtocolItem) {
  return Number.isFinite(item.intervalo_dias) && item.intervalo_dias > 0
    ? Math.trunc(item.intervalo_dias)
    : 1;
}

export function buildStandardProtocolPayload(protocol: StandardProtocol) {
  return {
    origem: "template_padrao",
    source_origin: protocol.source_origin,
    scope: protocol.scope,
    activation_mode: protocol.activation_mode,
    status_legal: protocol.status_legal,
    family_code: protocol.family_code,
    regimen_version: STANDARD_PROTOCOL_LIBRARY_VERSION,
    canonical_key: protocol.canonical_key,
    referencia: protocol.referencia ?? null,
    standard_id: protocol.id,
    obrigatorio:
      protocol.status_legal === "obrigatorio" || Boolean(protocol.obrigatorio),
    biblioteca_base_versao: STANDARD_PROTOCOL_LIBRARY_VERSION,
    calendario_base: {
      version: STANDARD_PROTOCOL_LIBRARY_VERSION,
      profile: protocol.calendario_base.profile,
      label: protocol.calendario_base.label,
      categoria: protocol.categoria,
    },
  };
}

export function buildStandardProtocolItemPayload(
  protocol: Pick<StandardProtocol, "family_code">,
  item: StandardProtocolItem,
) {
  const regimen = inferSanitaryRegimenMilestone({
    familyCode: protocol.family_code,
    regimenVersion: STANDARD_PROTOCOL_LIBRARY_VERSION,
    milestoneCode: item.item_code,
    sequenceOrder: item.dose_num,
    dependsOnMilestone: item.depends_on_item_code ?? null,
    sexoAlvo: item.sexo_alvo ?? null,
    idadeMinDias: item.idade_min_dias ?? null,
    idadeMaxDias: item.idade_max_dias ?? null,
    scheduleKind: item.schedule_kind ?? null,
    payload: buildSanitaryBaseCalendarPayload(item.calendario_base),
  });

  return {
    family_code: protocol.family_code,
    indicacao: item.indicacao,
    sexo_alvo: item.sexo_alvo ?? null,
    idade_min_dias: item.idade_min_dias ?? null,
    idade_max_dias: item.idade_max_dias ?? null,
    observacoes: item.observacoes ?? null,
    item_code: item.item_code,
    milestone_code: regimen?.milestone_code ?? item.item_code,
    sequence_order: regimen?.sequence_order ?? item.dose_num,
    schedule_kind: regimen?.schedule_rule.kind ?? item.schedule_kind ?? null,
    depends_on_item_code: item.depends_on_item_code ?? null,
    depends_on: item.depends_on ?? null,
    agenda_activation: item.agenda_activation ?? null,
    ...buildSanitaryBaseCalendarPayload(item.calendario_base),
    ...buildSanitaryRegimenPayload(regimen),
  };
}
