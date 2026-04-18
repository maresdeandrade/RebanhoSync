/**
 * Fixtures — Sanitary Scheduler Validation Matrix
 * 8 casos covering 4 modes + invalid scenarios
 * Ready-to-execute para Phase 5 validation
 */

import type {
  ProtocoloSanitarioItem,
  Animal,
  EventoSanitario,
} from "@/lib/offline/types";
import type {
  ComputeNextOccurrenceContext,
  ComputedOccurrence,
} from "@/lib/sanitario/schedulerIntegration";

// ============================================================================
// VALID CASES (Modo 1: Janela Etária)
// ============================================================================

/** Fixture 1: Brucelose em Bezerro 100d (sem vacinação prévia) */
export const bruceloseBezerra100d = {
  name: "brucelose.bezerra.100d",
  mode: "janela_etaria",
  description:
    "Bezerro nascido 100 dias atrás entra em janela de brucelose. Nunca vacinado.",

  // Domain: Protocolo Sanitário
  domain: {
    protocolId: "proto-brucelose-v1",
    itemId: "item-brucelose-initial",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "janela_etaria",
        anchor: "birth",
        minAgeMonths: 3,
        maxAgeMonths: 7,
        frequency: "once",
      },
    },
  } as ProtocoloSanitarioItem,

  // Subject: Animal
  subject: {
    animal: {
      id: "animal-bezerra-001",
      nome: "Bessie Jr",
      data_nascimento: "2026-01-13", // 100 dias atrás de 2026-04-13
      sexo: "F",
      categoria_zootecnica: "bezerro",
      peso: 80,
    } as Animal,
    fazendaId: "farm-go-central",
  } as ComputeNextOccurrenceContext,

  // History: Sem eventos prévios
  history: {
    priorEvents: [] as EventoSanitario[],
    priorAgendaItems: [] as Array<unknown>,
  },

  // Current moment
  now: new Date("2026-04-13"),

  // Expected output
  expectedResult: {
    materialize: true,
    reasonCode: "ready_janela_etaria",
    shouldScheduleAsap: false,
    dueDate: "2026-04-13", // Já está na janela
    priority: "normal",
    dedupKeyPattern: "sanitario:animal:bezerra-001:brucelose:*",
  } as Partial<ComputedOccurrence>,
};

/** Fixture 2: Raiva em Primípara (zona de risco) */
export const raivaRiscoPrimo = {
  name: "raiva.risco.primo",
  mode: "janela_etaria",
  description:
    "Primípara em zona de risco entra em janela de raiva (reforço). Vacinada há 12 meses.",

  domain: {
    protocolId: "proto-raiva-reforco-risco",
    itemId: "item-raiva-reforco-primo",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "janela_etaria",
        anchor: "parity",
        minAgeMonths: 0,
        maxAgeMonths: 6,
        geoInfo: { subregion: "risco" },
        frequency: "once",
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-primo-007",
      nome: "Linda",
      data_nascimento: "2024-04-13",
      sexo: "F",
      categoria_zootecnica: "novilha",
      // Parity anchor: data do primeiro parto = 2026-03-13 (data atual - 1 mês)
      payload: { first_parity_date: "2026-03-13" },
    } as Partial<Animal>,
    fazendaId: "farm-mg-risco",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [
      {
        id: "evt-raiva-inicial-2025",
        animal_id: "animal-primo-007",
        tipo: "vacinacao",
        payload: { produto: "Raiva (inativada)" },
        client_recorded_at: new Date("2025-04-13"),
      } as EventoSanitario,
    ],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready_janela_etaria_parity",
    shouldScheduleAsap: false,
    dueDate: "2026-04-13", // 1 mês pós-parto
    priority: "high", // Zona de risco
    dedupKeyPattern: "sanitario:animal:primo-007:raiva_reforco:*",
  } as Partial<ComputedOccurrence>,
};

// ============================================================================
// VALID CASES (Modo 2: Rotina Recorrente)
// ============================================================================

/** Fixture 3: Raiva reforço com dependência (requer evento prior) */
export const raivaReforçoDependencia = {
  name: "raiva.reforco.dependencia",
  mode: "rotina_recorrente",
  description:
    "Reforço de raiva com dependência em evento anterior (dose 1). Intervalo 1 ano.",

  domain: {
    protocolId: "proto-raiva-v1",
    itemId: "item-raiva-reforco",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "rotina_recorrente",
        cycles: [
          {
            cycle: 1,
            dependsOn: { itemId: "item-raiva-inicial", eventMatch: "produto" },
            intervalMonths: 12,
          },
        ],
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-vaca-042",
      nome: "Malhada",
      data_nascimento: "2020-06-15",
      sexo: "F",
      categoria_zootecnica: "vaca",
    } as Animal,
    fazendaId: "farm-sp-interior",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [
      {
        id: "evt-raiva-dose1-2025",
        animal_id: "animal-vaca-042",
        tipo: "vacinacao",
        payload: { produto: "Raiva (inativada)", cycle: 1 },
        client_recorded_at: new Date("2025-04-13"),
      } as EventoSanitario,
    ],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready_rotina_recorrente",
    shouldScheduleAsap: false,
    dueDate: "2026-04-13", // Exatamente 12 meses após dose 1
    priority: "normal",
    dedupKeyPattern: "sanitario:animal:vaca-042:raiva_reforco:cycle_2:*",
  } as Partial<ComputedOccurrence>,
};

/** Fixture 4: Campanha de vacinação (maio em Goiás) */
export const campanhaMaioGO = {
  name: "campanha.maio.go",
  mode: "campanha",
  description:
    "Campanha de vacinação em Goiás — meses mai/jun/jul. Hoje é abril.",

  domain: {
    protocolId: "proto-campanha-mai-2026",
    itemId: "item-campanha-vacinacao",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "campanha",
        anchor: "none",
        campaignMonths: [5, 6, 7], // maio, junho, julho
        state: "GO",
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-touro-088",
      nome: "Brutus",
      data_nascimento: "2023-01-20",
      sexo: "M",
      categoria_zootecnica: "touro",
    } as Animal,
    fazendaId: "farm-go-central",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"), // Abril — fora da campanha

  expectedResult: {
    materialize: true,
    reasonCode: "ready_campanha",
    shouldScheduleAsap: false,
    dueDate: "2026-05-01", // Primeiro dia de maio
    priority: "normal",
    dedupKeyPattern: "sanitario:animal:touro-088:vacinacao:campanha:2026-05:*",
  } as Partial<ComputedOccurrence>,
};

/** Fixture 5: Vermifugação recorrente (6 meses) */
export const vermifugacaoRecorrente = {
  name: "vermifugacao.recorrente",
  mode: "rotina_recorrente",
  description:
    "Vermifugação a cada 6 meses. Última dose: 10 meses atrás. Vencida.",

  domain: {
    protocolId: "proto-vermifugo-v1",
    itemId: "item-vermifugo",
    tipo: "sanitario",
    payload: {
      calendario_base: {
        mode: "rotina_recorrente",
        cycles: [
          {
            cycle: 1,
            intervalMonths: 6,
          },
        ],
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-bezerro-156",
      nome: "Pequeno",
      data_nascimento: "2025-06-01",
      sexo: "M",
      categoria_zootecnica: "bezerro",
    } as Animal,
    fazendaId: "farm-mg-pastos",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [
      {
        id: "evt-vermifugo-2025",
        animal_id: "animal-bezerro-156",
        tipo: "sanitario",
        payload: { procedimento: "vermifugacao", produto: "Ivermectina" },
        client_recorded_at: new Date("2025-06-13"), // 10 meses atrás (agora é abril 2026)
      } as EventoSanitario,
    ],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready_rotina_recorrente_overdue",
    shouldScheduleAsap: true, // Vencida!
    dueDate: "2025-12-13", // Passou! (6 meses após 2025-06-13)
    priority: "high",
    dedupKeyPattern: "sanitario:animal:bezerro-156:vermifugacao:*",
  } as Partial<ComputedOccurrence>,
};

/** Fixture 6: Procedimento imediato (asap) */
export const procedimentoImediato = {
  name: "procedimento.imediato",
  mode: "procedimento_imediato",
  description:
    "Procedimento emergencial/imediato — sem data, executa hoje.",

  domain: {
    protocolId: "proto-emergency",
    itemId: "item-isolamento-animal",
    tipo: "procedimento",
    payload: {
      calendario_base: {
        mode: "procedimento_imediato",
        anchor: "none",
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-vaca-sick-999",
      nome: "Malhada Doente",
      data_nascimento: "2021-01-15",
      sexo: "F",
      categoria_zootecnica: "vaca",
    } as Animal,
    fazendaId: "farm-sp-interior",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready_procedimento_imediato",
    shouldScheduleAsap: true,
    dueDate: "2026-04-13", // Hoje
    priority: "critical",
    dedupKeyPattern: "sanitario:animal:vaca-sick-999:procedimento_imediato:*",
  } as Partial<ComputedOccurrence>,
};

// ============================================================================
// INVALID CASES
// ============================================================================

/** Fixture 7: Rotina recorrente com dependência cíclica (ERRO) */
export const invalidCicloDependencia = {
  name: "invalid.ciclo.dependencia",
  mode: "rotina_recorrente",
  description:
    "Ciclo de dependências — item X depende de Y, Y depende de X. Inválido.",

  domain: {
    protocolId: "proto-cyclic",
    itemId: "item-cyclic-a",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "rotina_recorrente",
        cycles: [
          {
            cycle: 1,
            dependsOn: { itemId: "item-cyclic-b", eventMatch: "any" },
            intervalMonths: 12,
          },
        ],
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-test-cyclic",
      nome: "Test",
      data_nascimento: "2024-01-01",
      sexo: "F",
      categoria_zootecnica: "novilha",
    } as Animal,
    fazendaId: "farm-test",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: false,
    reasonCode: "error_cyclic_dependency",
    shouldScheduleAsap: false,
    dueDate: null,
    priority: "none",
    errorDetails:
      "item-cyclic-a depends on item-cyclic-b, which depends on item-cyclic-a",
  } as Partial<ComputedOccurrence>,
};

/** Fixture 8: Campanha sem meses configurados (ERRO) */
export const invalidCampanhaSemMeses = {
  name: "invalid.campanha.sem_meses",
  mode: "campanha",
  description:
    "Campanha com modo 'campanha' mas sem meses definidos. Configuração inválida.",

  domain: {
    protocolId: "proto-bad-campaign",
    itemId: "item-bad-campaign",
    tipo: "vacinacao",
    payload: {
      calendario_base: {
        mode: "campanha",
        anchor: "none",
        campaignMonths: [], // VAZIO — inválido!
      },
    },
  } as ProtocoloSanitarioItem,

  subject: {
    animal: {
      id: "animal-test-nocampaign",
      nome: "Test",
      data_nascimento: "2024-01-01",
      sexo: "M",
      categoria_zootecnica: "bezerro",
    } as Animal,
    fazendaId: "farm-test",
  } as ComputeNextOccurrenceContext,

  history: {
    priorEvents: [],
    priorAgendaItems: [],
  },

  now: new Date("2026-04-13"),

  expectedResult: {
    materialize: false,
    reasonCode: "error_invalid_config",
    shouldScheduleAsap: false,
    dueDate: null,
    priority: "none",
    errorDetails: "Campaign mode requires non-empty campaignMonths",
  } as Partial<ComputedOccurrence>,
};

// ============================================================================
// Export: Matriz Completa
// ============================================================================

export const SANITARY_SCHEDULER_FIXTURES = [
  bruceloseBezerra100d,
  raivaRiscoPrimo,
  raivaReforçoDependencia,
  campanhaMaioGO,
  vermifugacaoRecorrente,
  procedimentoImediato,
  invalidCicloDependencia,
  invalidCampanhaSemMeses,
];

export const VALID_MODE_FIXTURES = [
  bruceloseBezerra100d,
  raivaRiscoPrimo,
  raivaReforçoDependencia,
  campanhaMaioGO,
  vermifugacaoRecorrente,
  procedimentoImediato,
];

export const INVALID_FIXTURES = [
  invalidCicloDependencia,
  invalidCampanhaSemMeses,
];

/**
 * Fixture statistics for validation
 */
export const FIXTURE_STATS = {
  total: SANITARY_SCHEDULER_FIXTURES.length,
  valid: VALID_MODE_FIXTURES.length,
  invalid: INVALID_FIXTURES.length,
  byMode: {
    janela_etaria: 2,
    rotina_recorrente: 3,
    campanha: 2,
    procedimento_imediato: 1,
  },
  coverage: {
    "Modo 1: Janela Etária": {
      fixtures: 2,
      descriptions: ["Bezerro na janela (simplicidade)", "Primípara com parity"],
    },
    "Modo 2: Rotina Recorrente": {
      fixtures: 3,
      descriptions: [
        "Simples (12m)",
        "Vencida (overdue)",
        "Com dependência cíclica (erro)",
      ],
    },
    "Modo 3: Campanha": {
      fixtures: 2,
      descriptions: ["Campanha válida (mai-gi-jul)", "Sem meses (erro)"],
    },
    "Modo 4: Procedimento Imediato": {
      fixtures: 1,
      descriptions: ["Emergência ASAP"],
    },
  },
};
