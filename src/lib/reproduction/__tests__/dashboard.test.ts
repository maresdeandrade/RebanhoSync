import { describe, expect, it } from "vitest";
import type { Animal, Lote, ReproTipoEnum } from "@/lib/offline/types";
import type { ReproEventJoined } from "../selectors";
import { buildReproductionDashboard } from "../dashboard";

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function createAnimal(id: string, identificacao: string, loteId: string | null): Animal {
  const now = new Date().toISOString();
  return {
    id,
    fazenda_id: "farm-1",
    identificacao,
    nome: null,
    sexo: "F",
    status: "ativo",
    lote_id: loteId,
    categoria: null,
    data_nascimento: null,
    data_entrada: null,
    origem: null,
    peso_kg: null,
    raca: null,
    pai_id: null,
    mae_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function createLote(id: string, nome: string): Lote {
  const now = new Date().toISOString();
  return {
    id,
    fazenda_id: "farm-1",
    nome,
    status: "ativo",
    pasto_id: null,
    capacidade_ua: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function createEvent(
  animalId: string,
  occurredAt: string,
  tipo: ReproTipoEnum,
  payload: Record<string, unknown> = {},
): ReproEventJoined {
  return {
    id: `${animalId}-${tipo}-${occurredAt}`,
    fazenda_id: "farm-1",
    dominio: "reproducao",
    occurred_at: occurredAt,
    occurred_on: occurredAt.slice(0, 10),
    animal_id: animalId,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${animalId}-${tipo}`,
    client_tx_id: `tx-${animalId}-${tipo}`,
    client_recorded_at: occurredAt,
    server_received_at: occurredAt,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
    details: {
      evento_id: `${animalId}-${tipo}-${occurredAt}`,
      fazenda_id: "farm-1",
      tipo,
      macho_id: null,
      payload,
      client_id: "client-1",
      client_op_id: `op-${animalId}-${tipo}`,
      client_tx_id: `tx-${animalId}-${tipo}`,
      client_recorded_at: occurredAt,
      server_received_at: occurredAt,
      created_at: occurredAt,
      updated_at: occurredAt,
      deleted_at: null,
    },
  };
}

describe("buildReproductionDashboard", () => {
  it("organizes females by cycle stage and highlights pending actions", () => {
    const now = new Date();
    const animals = [
      createAnimal("a-serv", "F-101", "lote-a"),
      createAnimal("a-preg", "F-102", "lote-a"),
      createAnimal("a-post", "F-103", "lote-b"),
      createAnimal("a-open", "F-104", null),
    ];
    const lotes = [createLote("lote-a", "Matrizes 1"), createLote("lote-b", "Maternidade")];
    const events = [
      createEvent("a-serv", addDays(now, -40).toISOString(), "IA"),
      createEvent("a-preg", addDays(now, -20).toISOString(), "diagnostico", {
        schema_version: 1,
        resultado: "positivo",
        data_prevista_parto: addDays(now, 10).toISOString().slice(0, 10),
      }),
      createEvent("a-post", addDays(now, -20).toISOString(), "parto", {
        schema_version: 1,
        data_parto_real: addDays(now, -20).toISOString().slice(0, 10),
      }),
    ];

    const dashboard = buildReproductionDashboard({
      animals,
      lotes,
      events,
      now,
    });

    expect(dashboard.totals.femeasAtivas).toBe(4);
    expect(dashboard.totals.servidas).toBe(1);
    expect(dashboard.totals.prenhas).toBe(1);
    expect(dashboard.totals.paridas).toBe(1);
    expect(dashboard.totals.abertas).toBe(1);
    expect(dashboard.focus.diagnosticosPendentes).toBe(1);
    expect(dashboard.focus.partosProximos).toBe(1);
    expect(dashboard.focus.puerperioAtivo).toBe(1);
    expect(dashboard.focus.femeasAptas).toBe(1);

    expect(dashboard.animals[0]?.identificacao).toBe("F-101");
    expect(dashboard.animals[0]?.urgency).toBe("atencao");
    expect(dashboard.animals[0]?.actionLabel).toBe("Registrar diagnostico");
    expect(dashboard.animals[1]?.actionLabel).toBe("Registrar parto");
    expect(dashboard.agenda[0]?.title).toBe("Diagnostico previsto");

    const openAnimal = dashboard.animals.find((animal) => animal.id === "a-open");
    expect(openAnimal?.lane).toBe("vazias");
    expect(openAnimal?.actionHref).toContain("/animais/a-open/reproducao?tipo=cobertura");

    const postAnimal = dashboard.animals.find((animal) => animal.id === "a-post");
    expect(postAnimal?.loteNome).toBe("Maternidade");
    expect(postAnimal?.nextActionLabel).toBe("Fim do puerperio");
  });
});
