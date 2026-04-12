import type { SanitarioTipoEnum } from "@/lib/offline/types";
import {
  buildSanitaryBaseCalendarPayload,
  type SanitaryBaseCalendarRule,
} from "@/lib/sanitario/calendar";

export type StandardProtocolCategory =
  | "vacinas"
  | "vermifugacao"
  | "medicamentos";

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
  calendario_base: SanitaryBaseCalendarRule;
}

export interface StandardProtocol {
  id: string;
  nome: string;
  descricao: string;
  categoria: StandardProtocolCategory;
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

export const STANDARD_PROTOCOLS: StandardProtocol[] = [
  {
    id: "vac-brucelose",
    nome: "Brucelose (Obrigatoria - Femeas)",
    descricao:
      "Vacinacao obrigatoria de femeas entre 3 e 8 meses de idade com vacina B19. Zoonose grave.",
    categoria: "vacinas",
    obrigatorio: true,
    referencia: "MAPA - PNCEBT",
    calendario_base: {
      profile: "janela_etaria",
      label: "Janela etaria obrigatoria",
    },
    itens: [
      {
        item_code: "brucelose-b19",
        tipo: "vacinacao",
        produto: "Vacina Brucelose B19 (Viva)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Femeas (bezerras) entre 3 e 8 meses de idade. Obrigatoria marcacao com ferro candente ou tatuagem.",
        sexo_alvo: "F",
        idade_min_dias: 90,
        idade_max_dias: 240,
        observacoes:
          "Apenas medico veterinario ou vacinador auxiliar cadastrado pode aplicar. Vacina viva.",
        dedup_template: "vacina:brucelose:{animal_id}",
        calendario_base: {
          mode: "age_window",
          anchor: "birth",
          label: "Dose unica entre 90 e 240 dias",
          ageStartDays: 90,
          ageEndDays: 240,
        },
      },
    ],
  },
  {
    id: "vac-raiva",
    nome: "Raiva dos Herbivoros",
    descricao:
      "Vacinacao contra Raiva. Obrigatoria em regioes endemicas e recomendada em todo o territorio nacional.",
    categoria: "vacinas",
    obrigatorio: false,
    referencia: "MAPA - PNCRH",
    calendario_base: {
      profile: "preventivo_anual",
      label: "Revisao anual do rebanho",
    },
    itens: [
      {
        item_code: "raiva-anual",
        tipo: "vacinacao",
        produto: "Vacina Antirrabica",
        intervalo_dias: 365,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Todo o rebanho a partir de 3 meses. Primovacinacao requer reforco apos 30 dias.",
        sexo_alvo: "todos",
        idade_min_dias: 90,
        observacoes:
          "Em areas de foco, revacinacao pode ser semestral ou conforme determinacao da defesa sanitaria.",
        dedup_template: "vacina:raiva:{ano}",
        calendario_base: {
          mode: "rolling_interval",
          anchor: "calendar_month",
          label: "Revisao anual a partir de 90 dias",
          intervalDays: 365,
          ageStartDays: 90,
        },
      },
    ],
  },
  {
    id: "vac-clostridioses",
    nome: "Clostridioses (Manqueira/Polivalente)",
    descricao:
      "Prevencao contra Carbunculo Sintomatico, Gangrena Gasosa, Enterotoxemias e Botulismo.",
    categoria: "vacinas",
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
        dedup_template: "vacina:clostridio:{ano}",
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
    nome: "Reprodutiva (IBR/BVD/Leptospirose)",
    descricao:
      "Prevencao de perdas gestacionais e infertilidade causadas por virus e bacterias.",
    categoria: "vacinas",
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
        dedup_template: "vacina:reprodutiva:{ano}",
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
    nome: "Controle Estrategico (5-7-9)",
    descricao:
      "Esquema classico de vermifugacao estrategica no inicio, meio e fim da seca (maio, julho, setembro).",
    categoria: "vermifugacao",
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
        dedup_template: "vermi:579:maio:{ano}",
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
        dedup_template: "vermi:579:julho:{ano}",
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
        dedup_template: "vermi:579:setembro:{ano}",
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
    nome: "Vermifugacao a Desmama",
    descricao:
      "Controle parasitario em bezerros no momento da desmama (fase de alto estresse e suscetibilidade).",
    categoria: "vermifugacao",
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
        dedup_template: "vermi:desmama:{animal_id}",
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
    nome: "Cura de Umbigo (Recem-Nascidos)",
    descricao:
      "Protocolo essencial para prevencao de onfaloflebites, miiases e infeccoes sistemicas.",
    categoria: "medicamentos",
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
        dedup_template: "med:umbigo:{animal_id}",
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
    nome: "Tratamento Tristeza Parasitara (TPB)",
    descricao:
      "Protocolo terapeutico para casos de Babesiose e Anaplasmose (carrapato).",
    categoria: "medicamentos",
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
    nome: "Terapia de Vaca Seca (Mastite)",
    descricao:
      "Prevencao e cura de mastite no periodo seco em vacas leiteiras ou corte com alta producao.",
    categoria: "medicamentos",
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
        dedup_template: "med:secagem:{animal_id}",
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
    referencia: protocol.referencia ?? null,
    standard_id: protocol.id,
    obrigatorio: Boolean(protocol.obrigatorio),
    biblioteca_base_versao: STANDARD_PROTOCOL_LIBRARY_VERSION,
    calendario_base: {
      version: STANDARD_PROTOCOL_LIBRARY_VERSION,
      profile: protocol.calendario_base.profile,
      label: protocol.calendario_base.label,
      categoria: protocol.categoria,
    },
  };
}

export function buildStandardProtocolItemPayload(item: StandardProtocolItem) {
  return {
    indicacao: item.indicacao,
    sexo_alvo: item.sexo_alvo ?? null,
    idade_min_dias: item.idade_min_dias ?? null,
    idade_max_dias: item.idade_max_dias ?? null,
    observacoes: item.observacoes ?? null,
    item_code: item.item_code,
    depends_on_item_code: item.depends_on_item_code ?? null,
    ...buildSanitaryBaseCalendarPayload(item.calendario_base),
  };
}
