import { describe, expect, it } from "vitest";
import {
  computeAnimalWithdrawal,
  computeLoteWithdrawal,
  addDaysNominal,
  getNominalDate,
  type SanitaryEventInputForReadModel,
  type WithdrawalReadModel,
} from "../compliance/withdrawalReadModel";

const MOCK_DATE = "2026-05-20";

describe("addDaysNominal & getNominalDate timezone safety", () => {
  it("soma dias nominalmente sem sofrer timezone shift", () => {
    expect(addDaysNominal("2026-05-31", 1)).toBe("2026-06-01");
    expect(addDaysNominal("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysNominal("2026-05-15", 10)).toBe("2026-05-25");
  });

  it("extrai data nominal de ISO String", () => {
    expect(getNominalDate("2026-05-20T14:32:00.000Z")).toBe("2026-05-20");
    expect(getNominalDate("2026-05-20T00:00:00-03:00")).toBe("2026-05-20");
  });
});

describe("computeAnimalWithdrawal core calculations", () => {
  it("retorna sem_evento_sanitario quando nao ha eventos para o animal", () => {
    const rm = computeAnimalWithdrawal("animal-1", [], MOCK_DATE);
    expect(rm.status).toBe("sem_evento_sanitario");
    expect(rm.carne?.status).toBe("sem_evento_sanitario");
    expect(rm.leite?.status).toBe("sem_evento_sanitario");
  });

  it("filtra e ignora eventos de outros animais", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-2",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Medicamento X",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Medicamento X",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 5,
            rastreabilidade: "completo",
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, MOCK_DATE);
    expect(rm.status).toBe("sem_evento_sanitario");
  });

  it("retorna sem_snapshot quando ha apenas eventos antigos legados sem snapshot e sem carencia configurada", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Medicamento Antigo",
        payload: {},
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, MOCK_DATE);
    expect(rm.status).toBe("sem_snapshot");
    expect(rm.carne?.status).toBe("sem_snapshot");
  });

  it("nao usa fallback legado em payload para calcular carencia", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Medicamento Antigo",
        payload: {
          carencia_regra_json: {
            carne_dias: 10,
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("sem_snapshot");
    expect(rm.carne?.status).toBe("sem_snapshot");
    expect(rm.carne?.limitations).toContain("Evento sem campos estruturados de carencia");
  });

  it("retorna sem_carencia_configurada quando o snapshot de insumo existe mas nao tem dias de carencia", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Vacina X",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Vacina X",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: null,
            carencia_leite_dias_snapshot: 0,
            rastreabilidade: "completo",
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, MOCK_DATE);
    expect(rm.status).toBe("sem_carencia_configurada");
    expect(rm.carne?.status).toBe("sem_carencia_configurada");
    expect(rm.leite?.status).toBe("sem_carencia_configurada");
  });

  it("calcula carencia_ativa de carne quando dentro da validade residual", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Vermifugo Y",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Vermifugo Y",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 10,
            rastreabilidade: "completo",
            principio_ativo_snapshot: "Ivermectina",
          },
        },
      },
    ];
    // referenceDate 2026-05-20 <= exp (2026-05-25) => Ativa!
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("carencia_ativa");
    expect(rm.carne?.status).toBe("carencia_ativa");
    expect(rm.carne?.fim).toBe("2026-05-25");
    expect(rm.carne?.principioAtivo).toBe("Ivermectina");
  });

  it("calcula carencia_expirada de carne quando ultrapassa a data final estimada", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-10T10:00:00Z",
        produto: "Vermifugo Y",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Vermifugo Y",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 5,
            rastreabilidade: "completo",
          },
        },
      },
    ];
    // referenceDate 2026-05-20 > exp (2026-05-15) => Expirada!
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("carencia_expirada");
    expect(rm.carne?.status).toBe("carencia_expirada");
    expect(rm.carne?.fim).toBe("2026-05-15");
  });

  it("calcula carencia_ativa e expirada de leite separadamente", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-18T10:00:00Z",
        produto: "Mastite Med",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Mastite Med",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 20, // expira 2026-06-07 (ativa)
            carencia_leite_dias_snapshot: 3,  // expira 2026-05-21 (expirada em 2026-05-22)
            rastreabilidade: "completo",
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-22");
    expect(rm.status).toBe("carencia_ativa");
    expect(rm.carne?.status).toBe("carencia_ativa");
    expect(rm.leite?.status).toBe("carencia_expirada");
  });

  it("aplica consolidacao de maior data quando ha multiplos eventos concorrentes ativos", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-15T10:00:00Z",
        produto: "Curto",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Curto",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 10, // expira 2026-05-25
            rastreabilidade: "completo",
          },
        },
      },
      {
        id: "evt-2",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-18T10:00:00Z",
        produto: "Longo",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Longo",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 15, // expira 2026-06-02
            rastreabilidade: "completo",
          },
        },
      },
    ];
    // Ambos sao ativos em 2026-05-20. O Longo deve prevalecer!
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("carencia_ativa");
    expect(rm.carne?.status).toBe("carencia_ativa");
    expect(rm.carne?.fim).toBe("2026-06-02");
    expect(rm.carne?.produtoNome).toBe("Longo");
  });

  it("ignora sumariamente eventos soft-deletados no calculo", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-18T10:00:00Z",
        produto: "Vacina Deletada",
        deleted_at: "2026-05-19T00:00:00Z", // Deletado!
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Vacina Deletada",
            produto_tipo_snapshot: "sanitario",
            carencia_carne_dias_snapshot: 10,
            rastreabilidade: "completo",
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("sem_evento_sanitario");
  });

  it("classifica como carencia_indeterminada e manual se a rastreabilidade for manual/texto livre", () => {
    const events: SanitaryEventInputForReadModel[] = [
      {
        id: "evt-1",
        animal_id: "animal-1",
        lote_id: null,
        occurred_at: "2026-05-18T10:00:00Z",
        produto: "Curandeiro Cha",
        payload: {
          insumo_snapshot: {
            produto_nome_snapshot: "Curandeiro Cha",
            produto_tipo_snapshot: null,
            rastreabilidade: "manual",
          },
        },
      },
    ];
    const rm = computeAnimalWithdrawal("animal-1", events, "2026-05-20");
    expect(rm.status).toBe("carencia_indeterminada");
    expect(rm.carne?.status).toBe("carencia_indeterminada");
    expect(rm.carne?.limitations).toContain("Produto manual/livre sem vinculo estruturado de catalogo");
  });
});

describe("computeLoteWithdrawal aggregation", () => {
  it("retorna sem_evento_sanitario para lote vazio", () => {
    const rm = computeLoteWithdrawal("lote-1", []);
    expect(rm.status).toBe("sem_evento_sanitario");
  });

  it("retorna carencia_ativa se pelo menos um animal do lote tiver carencia ativa, agregando a maior data final", () => {
    const animal1: WithdrawalReadModel = {
      targetType: "animal",
      targetId: "animal-1",
      status: "sem_evento_sanitario",
      evaluatedAt: new Date().toISOString(),
    };
    
    const animal2: WithdrawalReadModel = {
      targetType: "animal",
      targetId: "animal-2",
      status: "carencia_ativa",
      carne: {
        status: "carencia_ativa",
        inicio: "2026-05-15",
        fim: "2026-05-25",
        dias: 10,
        produtoNome: "Med A",
        source: "event_sanitario_snapshot",
        limitations: [],
      },
      evaluatedAt: new Date().toISOString(),
    };

    const animal3: WithdrawalReadModel = {
      targetType: "animal",
      targetId: "animal-3",
      status: "carencia_ativa",
      carne: {
        status: "carencia_ativa",
        inicio: "2026-05-18",
        fim: "2026-06-02",
        dias: 15,
        produtoNome: "Med B",
        source: "event_sanitario_snapshot",
        limitations: ["parcial"],
      },
      evaluatedAt: new Date().toISOString(),
    };

    const rm = computeLoteWithdrawal("lote-1", [animal1, animal2, animal3]);
    expect(rm.status).toBe("carencia_ativa");
    expect(rm.carne?.status).toBe("carencia_ativa");
    expect(rm.carne?.fim).toBe("2026-06-02");
    expect(rm.carne?.produtoNome).toBe("Med B");
    expect(rm.carne?.limitations).toContain("parcial");
  });
});
