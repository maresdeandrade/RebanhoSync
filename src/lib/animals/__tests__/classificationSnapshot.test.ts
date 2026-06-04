import { describe, expect, it } from "vitest";
import { resolveAnimalClassificationSnapshot } from "../classificationSnapshot";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";

const REFERENCE_DATE = "2026-05-30";

describe("resolveAnimalClassificationSnapshot", () => {
  // Test case 1: bezerro neonatal macho
  it("resolves bezerro neonatal macho correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2026-05-28", // 2 days old
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("bezerro");
    expect(snap.faseVeterinaria).toBe("neonatal");
    expect(snap.estadoProdutivoReprodutivo).toBe("inteiro");
    expect(snap.estagioVida).toBe("cria_neonatal");
    expect(snap.source).toBe("inferred");
    expect(snap.limitations).toHaveLength(0);
  });

  // Test case 2: bezerra em aleitamento
  it("resolves bezerra em aleitamento correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2026-03-01", // ~90 days old (< 210 weaning days)
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("bezerra");
    expect(snap.faseVeterinaria).toBe("pre_desmama");
    expect(snap.estadoProdutivoReprodutivo).toBe("desconhecido"); // conservative female repro
    expect(snap.estagioVida).toBe("cria_aleitamento");
    expect(snap.limitations).toContain("sem fato reprodutivo confirmado");
  });

  // Test case 3: animal desmamado
  it("resolves animal desmamado based on explicit weaning", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2026-03-01", // ~90 days old (usually pre-weaning)
        payload: {
          weaning: {
            completed_at: "2026-05-01", // Explicitly weaned
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.estagioVida).toBe("novilha"); // Weaned female under adult days is a novilha
    expect(snap.faseVeterinaria).toBe("pos_desmama");
  });

  // Test case 4: novilha
  it("resolves novilha correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2025-05-30", // 1 year old (365 days) -> above weaning, below adult (901 days)
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("novilha");
    expect(snap.estagioVida).toBe("novilha");
    expect(snap.faseVeterinaria).toBe("pos_desmama");
  });

  // Test case 5: garrote
  it("resolves garrote correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2025-05-30", // 1 year old
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("garrote");
    expect(snap.estagioVida).toBe("recria"); // Recria male is a garrote before candidate/adult days
    expect(snap.estadoProdutivoReprodutivo).toBe("inteiro");
  });

  // Test case 6: vaca adulta vazia com fato explícito
  it("resolves vaca adulta vazia with explicit fact", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2022-01-01",
        payload: {
          taxonomy_facts: {
            prenhez_confirmada: false, // Explicitly empty
            data_ultimo_parto: "2025-05-01",
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("vaca");
    expect(snap.estadoProdutivoReprodutivo).toBe("vazia");
    expect(snap.source).toBe("mixed"); // stored facts + inferred lifecycle
    expect(snap.limitations).toHaveLength(0);
  });

  // Test case 7: vaca prenhe com fato explícito
  it("resolves vaca prenhe with explicit fact", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2022-01-01",
        payload: {
          taxonomy_facts: {
            prenhez_confirmada: true,
            data_prevista_parto: "2026-09-01",
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("vaca");
    expect(snap.faseVeterinaria).toBe("gestante");
    expect(snap.estadoProdutivoReprodutivo).toBe("prenhe");
  });

  // Test case 8: vaca seca com fato explícito
  it("resolves vaca seca with explicit fact", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2022-01-01",
        payload: {
          taxonomy_facts: {
            secagem_realizada: true,
            data_secagem: "2026-05-01",
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("vaca");
    expect(snap.estadoProdutivoReprodutivo).toBe("seca");
  });

  // Test case 9: vaca em lactação com fato explícito
  it("resolves vaca em lactacao with explicit fact", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2022-01-01",
        payload: {
          taxonomy_facts: {
            em_lactacao: true,
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("vaca");
    expect(snap.estadoProdutivoReprodutivo).toBe("lactacao");
  });

  // Test case 10: touro reprodutor
  it("resolves touro reprodutor correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2022-01-01", // adult age
        papel_macho: "reprodutor",
        destino_produtivo: "reprodutor",
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("touro");
    expect(snap.estagioVida).toBe("touro");
    expect(snap.estadoProdutivoReprodutivo).toBe("reprodutor");
  });

  // Test case 11: macho castrado em recria
  it("resolves macho castrado em recria correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2025-05-30", // young/recria age
        destino_produtivo: "engorda",
        payload: {
          taxonomy_facts: {
            castrado: true,
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("garrote");
    expect(snap.estagioVida).toBe("recria");
    expect(snap.estadoProdutivoReprodutivo).toBe("castrado");
  });

  // Test case 12: macho castrado em terminação
  it("resolves macho castrado em terminacao correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2023-01-01", // adult age
        destino_produtivo: "abate",
        payload: {
          taxonomy_facts: {
            castrado: true,
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("boi_terminacao");
    expect(snap.estagioVida).toBe("terminacao");
    expect(snap.estadoProdutivoReprodutivo).toBe("terminacao");
  });

  // Test case 13: boi adulto
  it("resolves boi adulto correctly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2023-01-01", // adult age (731+ days)
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("garrote"); // Boi is boi_terminacao in category canonical enum if not reprodutor, or stays garrote? Let's check: category resolver returns garrote unless castrado or abate/engorda
    expect(snap.estagioVida).toBe("boi_adulto");
    expect(snap.estadoProdutivoReprodutivo).toBe("inteiro");
  });

  // Test case 14: animal sem sexo
  it("handles animal sem sexo properly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        data_nascimento: "2026-05-01",
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.categoriaZootecnica).toBe("desconhecida");
    expect(snap.faseVeterinaria).toBe("desconhecida");
    expect(snap.estadoProdutivoReprodutivo).toBe("desconhecido");
    expect(snap.limitations).toContain("sem sexo definido");
  });

  // Test case 15: animal sem data de nascimento
  it("handles animal sem data de nascimento properly", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.limitations).toContain("sem data de nascimento");
    expect(snap.estagioVida).toBe("desconhecido"); // cannot infer without age/weight
  });

  // Test case 16: animal sem estágio armazenado
  it("resolves correctly when animal sem estagio armazenado in payload", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2025-05-30",
        payload: {
          lifecycle: {}, // No estagio_vida stored
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.estagioVida).toBe("novilha"); // Inferred
  });

  // Test case 17: estágio armazenado
  it("respects and prefers explicit estagio armazenado", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2026-05-01", // ~30 days old -> normally cria_aleitamento
        payload: {
          lifecycle: {
            estagio_vida: "novilha", // Artificially stored as novilha
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.estagioVida).toBe("novilha");
  });

  // Test case 18: estágio inferido
  it("marks source correctly when estágio inferido", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2026-05-25", // 5 days old (<= 7 days config)
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.estagioVida).toBe("cria_neonatal");
    expect(snap.source).toBe("inferred");
  });

  // Test case 19: source = stored
  it("returns source = stored when all active resolved axes are stored", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        payload: {
          taxonomy_facts: {
            categoria: "vaca",
            prenhez_confirmada: true,
            em_lactacao: true,
          },
          lifecycle: {
            estagio_vida: "vaca_adulta",
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.source).toBe("stored");
  });

  // Test case 20: source = inferred
  it("returns source = inferred when all active resolved axes are inferred", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2025-05-30",
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.source).toBe("inferred");
  });

  // Test case 21: source = mixed
  it("returns source = mixed when there is a mix of stored and inferred axes", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2025-05-30", // Inferred life stage
        payload: {
          taxonomy_facts: {
            prenhez_confirmada: true, // Stored veterinary phase / repro state
          },
        },
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.source).toBe("mixed");
  });

  // Test case 22: limitations por dados ausentes
  it("gathers multiple limitations correctly when multiple essential data are missing", () => {
    const snap = resolveAnimalClassificationSnapshot({});

    expect(snap.limitations).toContain("sem data de nascimento");
    expect(snap.limitations).toContain("sem sexo definido");
  });

  // Test case 23: ausência de referenceDate impede inferência por idade
  it("adds limitation and refuses age-based inference when referenceDate is missing", () => {
    const snap = resolveAnimalClassificationSnapshot({
      sexo: "F",
      data_nascimento: "2025-05-30",
    });

    expect(snap.limitations).toContain("idade não calculável sem data de referência");
    expect(snap.estagioVida).toBe("desconhecido"); // Cannot be inferred without age (or weight)
  });

  // Test case 24: estado reprodutivo não é inferido sem fato confiável
  it("returns desconhecido for reproductive status when no trusted reproductive fact is available", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "F",
        data_nascimento: "2022-01-01", // Adult female
      },
      {
        referenceDate: REFERENCE_DATE,
      }
    );

    expect(snap.estadoProdutivoReprodutivo).toBe("desconhecido");
    expect(snap.limitations).toContain("sem fato reprodutivo confirmado");
  });

  it("does not expose sale, slaughter, or withdrawal authorization from productive destination", () => {
    const snap = resolveAnimalClassificationSnapshot(
      {
        sexo: "M",
        data_nascimento: "2023-01-01",
        destino_produtivo: "abate",
      },
      {
        referenceDate: REFERENCE_DATE,
      },
    );

    expect(snap.estagioVida).toBe("terminacao");
    expect(snap.estadoProdutivoReprodutivo).toBe("terminacao");

    const contract = snap as unknown as Record<string, unknown>;
    expect(contract.autorizaVenda).toBeUndefined();
    expect(contract.autorizaAbate).toBeUndefined();
    expect(contract.prontoVenda).toBeUndefined();
    expect(contract.aptoAbate).toBeUndefined();
    expect(contract.livreCarencia).toBeUndefined();
    expect(contract.semCarencia).toBeUndefined();
  });
});
